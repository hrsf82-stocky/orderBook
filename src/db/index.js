const Sequelize = require('sequelize');
const elasticsearch = require('elasticsearch');
const { orderSchema, pairSchema, positionSchema } = require('./schemas');
const { POSTGRES: { USER, PASSWORD, HOST }} = require('../../config');
const { generateFakeData } = require('./methods');
const { gte, lte } = Sequelize.Op;

//instrument, time, bid, ask, bid_vol, ask_vol
//bid/ask vol are the total of all new orders w/in that time period plus the total of all resolved orders w/in that time period
//in other words, vol movements

/////////////////////////////
// Sequelize setup/DB init //
/////////////////////////////

// setup Postgres
const sequelize = new Sequelize('orderBook', USER, PASSWORD, {
  host: HOST,
  dialect: 'postgres',
  sync: { force: true },
  syncOnAssociation: true,
  pool: { maxConnections: 25, maxIdleTime: 150},
  logging: false,
});

// confirm that the connection went through
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

/////////////////////////
// DB model definition //
/////////////////////////

// define a bids table, indexed on price and timestamp for fast queries
const Buy = sequelize.define('buy', orderSchema, {
  indexes: [ // A BTREE index with a ordered field
    {
      method: 'BTREE',
      fields: ['price', 'createdAt']
    }
  ]
});

// define an asks table, indexed on price and timestamp for fast queries
const Sell = sequelize.define('sell', orderSchema, {
  indexes: [ // A BTREE index with a ordered field
    {
      method: 'BTREE',
      fields: ['price', 'createdAt']
    }
  ]
});

// define a simple table to store the valid instruments
const Pair = sequelize.define('pair', pairSchema);

// define a table for open user positions
const Position = sequelize.define('position', positionSchema, {
  indexes: [
    {
      method: 'BTREE',
      fields: ['userId']
    },
  ]
});

Position.sync();
Pair.sync();

// set up one-to-many relationships b/w Pair->Buy and Pair->Sell
Buy.belongsTo(Pair, { as: 'pair' });
Pair.hasMany(Buy);
Sell.belongsTo(Pair, { as: 'pair' });
Pair.hasMany(Sell);


////////////////////////////////////////////
// Database query functions (TO BE MOVED) //
////////////////////////////////////////////

// Find the first 10 open orders in the Buy table
const topBuys = callback => {
  console.log('starting sort');
  return Buy
    .max('price')
    .then(max => Buy.findAll({
      limit: 10,
      where: { price: max }, 
      order: [[sequelize.col('price'), 'DESC'], [sequelize.col('createdAt'), 'ASC']]
    }))
    .then(results => callback(results));
};
//console.log('ORDERED: ', results.length, results[0], results[results.length - 1])

// Find the first 10 open orders in the Sell table
const topSells = callback => {
  console.log('starting sort');
  return Sell
    .min('price')
    .then(min => Sell.findAll({
      limit: 10,
      where: { price: min }, 
      order: [[sequelize.col('price'), 'ASC'], [sequelize.col('createdAt'), 'ASC']]
    }))
    .then(results => callback(results));
};

// Open a new user position
const openPosition = ({userId, price, volume, type}) => {
  type = (type === 'BUY') ? 'long' : 'short';
  // create a position w/ obj passed in
  // save to DB
  return Position.create({
    userId,
    price,
    volume,
    type,
    orders: [{ price, volume }],
  });
};

// Modify an existing position
const updatePosition = ({ userId, price, volume, type }) => {
  type = (type === 'BUY') ? 'long' : 'short';
  // find position by userId
  Position.findById(userId)
    .then(result => {
      // if (!result) {
      //   type = (type === 'long') ? 'BUY' : 'SELL';
      //   openPosition({ userId, price, volume, type });
      // }
      //if position type is the same as parameter, we add it to the list
      if (result.dataValues.type === type) {
        console.log(result.dataValues.orders);
        let newInfo = result.dataValues.orders.reduce((memo, el) => {
          memo.priceSum += el.price;
          memo.volSum += el.volume;
          return memo;
        }, { priceSum: price, volSum: volume });
        console.log(newInfo);
        // console.log('would write ', [...result.dataValues.orders, { price, volume }]);
        console.log('hi hi', result.dataValues);
        console.log('calculated price: ', (newInfo.priceSum / (result.dataValues.orders.length + 1)));
        console.log('calculated volume: ', (newInfo.volSum / (result.dataValues.orders.length + 1)));

        Position.update({
          price: (newInfo.priceSum / (result.dataValues.orders.length + 1)).toFixed(4),
          volume: (newInfo.volSum / (result.dataValues.orders.length + 1)),
          orders: [...result.dataValues.orders, { price, volume }],
        }, {
          where: { userId },
        }).then(res => console.log(res));

      //if position type is different, we need to resolve order
      } else {
        let profit = 0;
        let orders = [...result.dataValues.orders];
        for (let vol = 0; vol <= volume; vol) {
          let order = orders.shift();
          if (type === 'long') {
            if (vol + order.volume <= volume) {
              profit += (order.price - price) * order.volume;
              vol += order.volume;
            } else {
              profit += (order.price - price) * (volume - vol);
              vol += order.volume;
              order.unshift({ price: order.price, volume: (volume - vol)});
            }
          } else {
            if (vol + order.volume <= volume) {
              profit += (price - order.price) * order.volume;
              vol += order.volume;
            } else {
              profit += (price - order.price) * (volume - vol);
              vol += order.volume;
              order.unshift({ price: order.price, volume: (volume - vol)});
            }
          }
        }
        if (orders.length) {
          let newInfo = orders.reduce((memo, el) => {
            memo.priceSum += el.price;
            memo.volSum += el.volume;
            return memo;
          }, { priceSum: 0, volSum: 0 });
          result.update({
            price: (newInfo.priceSum / orders.length),
            volume: (newInfo.volume / orders.length),
            orders: [...orders],
          });
        } else {
          // result.destroy();
        }
      }
    });
  // update values
  // TODO: Send message to SQS with profit info
};

// Handle changes to an open position
const resolvePosition = ({userId, price, volume}, type) => {
  // check id to see if there's a position
  Position.findById(userId)
    .then(result => {
      if (!result) {
        console.log('Got to OPEN POSITION');
        openPosition({ userId, price, volume, type });
      } else {
        console.log('Got to UPDATE POSITION');
        // console.log(result.dataValues);
        updatePosition({ userId, price, volume, type });
      }
    });
  // if so, update/close position as necessary
  // if not, close the position
};

resolvePosition({ userId: 2, price: 1.0725, volume: 1 }, 'BUY');

// Close an open position
const closePosition = () => {
  // find position by userId
  // remove the position from the DB
  // Send message to SQS with profit info
};

//destroy an order in the DB and return remaining volume to be processed
const closeOrder = (order, incomingVol, type) => {
  let { userId, volume, price } = order.dataValues;
  console.log('RECEIVED: ', userId, volume, price, incomingVol);
  if (incomingVol < volume) {
    let newVolume = volume - incomingVol;
    resolvePosition({userId, price, volume: incomingVol}, type);
    // order.update({ volume: newVolume });
    return 0;
  } else {
    resolvePosition({ userId, price, volume }, type);
    // order.destroy();
    return incomingVol - volume;
  }
};

const processOrder = ({ type, order }) => {
  let { volume, price } = order;
  console.log('SAW', volume, price);
  if (type === 'BUY') {
    console.log('HI BUY');
    topBuys(top => {
      if (price < top[0].price) {
        Buy.create(order).then(result => console.log(result));
      } else {
        let remainingVol = volume;
        let i = 0;
        while (remainingVol > 0 && i < top.length) {
          remainingVol = closeOrder(top[i], remainingVol, type);
          i++;
        }
        if (remainingVol) {
          //somehow handle this situation where wasn't enough volume to completely resolve order
        }
      }
    });
  } else if (type === 'SELL') {
    console.log('HI SELL');
    topSells(top => {
      // console.log('FOUND: ', top[0]);
      if (price > top[0].price) {
        Sell.create(order).then(result => console.log('SELL RESULT: ', result));
      } else {
        let remainingVol = volume;
        let i = 0;
        while (remainingVol > 0 && i < top.length) {
          console.log('remaining: ', remainingVol);
          remainingVol = closeOrder(top[i], remainingVol, type);
          i++;
        }
        if (remainingVol) {
          //somehow handle this situation where wasn't enough volume to completely resolve order
        }
      }
    });
  }
};

processOrder({type: 'SELL', order: { price: 1.01, volume: 1, userId: 1, }});

// Handle an incoming order
const resolveOrder = ({ id, type }, { vol }) => {
  if (type === 'BUY') {
    Buy.findById(id).then(({ dataValues }) => {
      //compare volume
      if (vol > dataValues.vol) {
        // close the order and return remaining volume
      } else if (vol < dataValues.vol) {
        // modify the order
      } else {
        // close the order and return some indication that that's taken place
      }
      console.log(dataValues);
      //resolve the position
    });
  }
  if (type === 'SELL') {
    Sell.findById(id).then((result) => {
      let { dataValues } = result;
      //compare volume
      if (vol > dataValues.vol) {
        // close the order and return remaining volume
      } else if (vol < dataValues.vol) {
        // modify the order
      } else {
        // close the order and return some indication that that's taken place
      }
      console.log(dataValues);
      //check if it closes a position
      //if so, close the position
      //if not, open a position at this price
    });
  }
};


// Match an incoming order with an existing order
const match = ({ payload: { userId, orderType, vol, price }}) => {
  if (orderType === 'BID') {
    Sell
      .min('price')
      .then(min => Sell.findAll({
        limit: 10,
        where: { price: min }, 
        order: [[sequelize.col('price'), 'ASC'], [sequelize.col('createdAt'), 'ASC']]
      }))
      .then(res => console.log('MATCHED: ', res[0].dataValues));
  }
  if (orderType === 'ASK') {
    Buy
      .max('price')
      .then(res => console.log(res));
  }
};



//export DB tables
module.exports = {
  Buy,
  Sell,
  Pair,
  sequelize,
  resolveOrder,
  // elasticClient,
};

// const { generateFakeData } = require('./methods');

////////////////////
// Elastic search //
////////////////////

// const elasticClient = new elasticsearch.Client({
//   host: 'localhost:9200',
//   log: 'trace'
// });

// elasticClient.ping({
//   // ping usually has a 3000ms timeout 
//   requestTimeout: 1000
// }, function (error) {
//   if (error) {
//     console.trace('elasticsearch cluster is down!');
//   } else {
//     console.log('All is well');
//   }
// });
