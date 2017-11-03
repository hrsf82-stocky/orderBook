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

console.log(process.env.NODE_ENV);

const selectedDB = (process.env.NODE_ENV === 'development') ? 'orderBook' : 'mockOrderBook';

console.log(selectedDB);

// setup Postgres
const sequelize = new Sequelize(selectedDB, USER, PASSWORD, {
  host: HOST,
  dialect: 'postgres',
  sync: { force: true },
  syncOnAssociation: true,
  pool: { maxConnections: 50, maxIdleTime: 150},
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
  indexes: [ // A BTREE index with an ordered field
    {
      method: 'BTREE',
      fields: ['price', 'createdAt']
    }
  ]
});

// define an asks table, indexed on price and timestamp for fast queries
const Sell = sequelize.define('sell', orderSchema, {
  indexes: [ // A BTREE index with an ordered field
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

// Position.sync({force: true});
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
  // console.log('starting sort');
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
  // console.log('starting sort');
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
  // console.log('type: ', type);
  // convert the type name
  type = (type === 'BUY') ? 'long' : 'short';
  // console.log('type: ', type);
  // find position by userId
  Position.findById(userId)
    .then(result => {
      // if position type is the same as parameter, we add it to the list
      if (result.dataValues.type === type) {
        // console.log(result.dataValues.orders);
        // calculate the new sum of order prices and volumes to determine new overall position
        let newInfo = result.dataValues.orders.reduce((memo, el) => {
          memo.priceSum += el.price;
          memo.volSum += el.volume;
          return memo;
        }, { priceSum: price, volSum: volume });
        // console.log(newInfo);
        // console.log('would write ', [...result.dataValues.orders, { price, volume }]);
        // console.log('hi hi', result.dataValues);
        // console.log('calculated price: ', (newInfo.priceSum / (result.dataValues.orders.length + 1)));
        // console.log('calculated volume: ', newInfo.volSum);

        // update the position to reflect the calculated changes in price and volume
        Position.update({
          price: parseFloat((newInfo.priceSum / (result.dataValues.orders.length + 1)).toFixed(4)),
          volume: newInfo.volSum,
          orders: [...result.dataValues.orders, { price, volume }],
        }, {
          where: { userId },
        }).then(res => {
          // console.log(res);
        });

      //if position type is different, we need to resolve order
      } else {
        let profit = 0;
        // destroy or reverse the position if the order >= current position size
        if (volume >= result.dataValues.volume) {
          // calculate profit appropriately based on the position type
          if (result.dataValues.type === 'long') {
            profit = parseFloat(((price - result.dataValues.price) * result.dataValues.volume).toFixed(4));
          } else {
            profit = parseFloat(((result.dataValues.price - price) * result.dataValues.volume).toFixed(4));
          }
          //report the profit. TODO: send to message bus
          // console.log('profit: ', profit);
          //create a reverse position with the unresolved volume if there's a remainder
          if (volume > result.dataValues.volume) {
            //calculate the new sum of order prices and volumes to determine new overall position
            let newVolume = volume - result.dataValues.volume;
            result.update({
              price,
              type,
              volume: newVolume,
              orders: [{ price, volume: newVolume }],
            });
          //if no remainder, simply destroy the position
          } else {
            result.destroy();
          }
        } else {
          // create a shallow copy of the orders array to work with
          let orders = [...result.dataValues.orders];
          let vol = 0;
          // console.log('orders: ', orders);
          while (vol < volume) {
            // grab the next order in the position
            let order = orders.shift();
            // console.log('type: ', type);
            // console.log('order: ', order);
            // console.log('vol: ', vol);
            // console.log('volume: ', volume);
            // console.log('order vol: ', order.volume);
            if (type === 'long') {
              // if the order is completely fulfilled, calculate profit then throw away the order
              if (vol + order.volume <= volume) {
                profit += parseFloat(((order.price - price) * order.volume).toFixed(4));
                vol += order.volume;
              // else if order is partially fulfilled, calculate profit and remaining volume, then add it back in
              } else {
                profit += parseFloat(((order.price - price) * (volume - vol)).toFixed(4));
                orders.unshift({ price: order.price, volume: (volume - vol)});
                vol += order.volume;
                // console.log(order);
              }
            } else {
              // if the order is completely fulfilled, calculate profit then throw away the order
              if (vol + order.volume <= volume) {
                profit += parseFloat(((price - order.price) * order.volume).toFixed(4));
                vol += order.volume;
              // else if order is partially fulfilled, calculate profit and remaining volume, then add it back in
              } else {
                profit += parseFloat(((price - order.price) * (volume - vol)).toFixed(4));
                orders.unshift({ price: order.price, volume: (volume - vol)});
                vol += order.volume;
              }
            }
          }
          console.log('profit: ', profit);
          // if the position was not completely fulfilled, calculate new values based on partial fulfillment
          if (orders.length) {
            // calculate the new sum of order prices and volumes to determine new overall position
            let newInfo = orders.reduce((memo, el) => {
              memo.priceSum += el.price;
              memo.volSum += el.volume;
              return memo;
            }, { priceSum: 0, volSum: 0 });
            // write the new total volume and average price to the position
            result.update({
              price: (newInfo.priceSum / orders.length),
              volume: newInfo.volSum,
              orders: [...orders],
            }).then(res => {
              // console.log(res.dataValues);
            });
          // if the position was completely fulfilled, destroy it
          } else {
            result.destroy();
          }
        }
      }
    });
  // update values
  // TODO: Send message to SQS with profit info
};

// Create or update a position to reflect a completed order
const resolvePosition = ({userId, price, volume}, type) => {
  // check id to see if the user has an existing position
  Position.findById(userId)
    .then(result => {
      // if not, create a position for that user
      if (!result) {
        // console.log('Got to OPEN POSITION');
        openPosition({ userId, price, volume, type });
      // if so, update/close the position as necessary
      } else {
        // console.log('Got to UPDATE POSITION');
        updatePosition({ userId, price, volume, type });
      }
    });
};

// resolvePosition({ userId: 2, price: 1.0715, volume: 2 }, 'SELL');
// Position.find({where: {userId: 2}}).then(res => console.log(res.dataValues)).catch(() => console.log('not found'));

//destroy an order in the DB and return remaining volume to be processed
const closeOrder = (order, incomingVol, type) => {
  let { userId, volume, price } = order.dataValues;
  // console.log('RECEIVED: ', userId, volume, price, incomingVol);
  // if the order is partially fulfilled, resolve the position and update the order
  if (incomingVol < volume) {
    let newVolume = volume - incomingVol;
    resolvePosition({userId, price, volume: incomingVol}, type);
    order.update({ volume: newVolume });
    return 0;
  // if the order is completely fulfilled, resolve the position and destroy the order
  } else {
    resolvePosition({ userId, price, volume }, type);
    order.destroy();
    return incomingVol - volume;
  }
};

// Handle an incoming order from the queue/HTTP request
const processOrder = ({ type, order }) => {
  let { userId, volume, price } = order;
  // console.log('SAW', volume, price);
  // if the order is to buy, try to find a matching sell order or add it to the buy list
  if (type === 'BUY') {
    // console.log('HI BUY');
    // load the next 10 sell orders in line
    topSells(top => {
      // console.log('FOUND: ', top[0]);
      // if price is less than the best sell price listed, we know there's no match
      if (price < top[0].price) {
        // console.log('below best price, creating new order');
        Buy.create(order).then(result => {
          // console.log(result)
        });
      // if price is greater than the best sell price listed, we match the order
      } else {
        // console.log('above best price, resolving order');
        let remainingVol = volume;
        let i = 0;
        let reprocess = false;
        // we close listings until the entire order volume has been fulfilled
        while (remainingVol > 0 && i < top.length) {
          // it's possible that the next price in the list is higher than the previous, so we check
          if (price >= top[i].price) {
            // console.log('remaining: ', remainingVol);
            remainingVol = closeOrder(top[i], remainingVol, 'SELL');
            // console.log('new volume is: ', remainingVol);
            // console.log('Im gonna write: ', volume - remainingVol);
            resolvePosition({ userId, price: top[i].price, volume: volume - remainingVol }, type);
            i++;
          // if the order price no longer beats the listed price, we set the reprocess flag to true
          } else {
            reprocess = true;
            break;
          }
        }
        // if the top 10 listings did not fulfill the order, repeat the process
        if (reprocess || remainingVol) {
          order.volume = remainingVol;
          processOrder({ type, order });
        }
      }
    });
  // if the order is to sell, try to find a matching buy order or add it to the sell list
  } else if (type === 'SELL') {
    // console.log('HI SELL');
    // load the next 10 buy orders in line
    topBuys(top => {
      // console.log('FOUND: ', top[0]);
      // if price is greater than the best buy price listed, we know there's no match
      if (price > top[0].price) {
        // console.log('above best price, creating new order');        
        Sell.create(order).then(result => {
          // console.log('SELL RESULT: ', result)
        });
      // if price is less than the best buy price listed, we match the order
      } else {
        // console.log('beats best price, resolving order');        
        let remainingVol = volume;
        let i = 0;
        let reprocess = false;
        // we close listings until the entire order volume has been fulfilled
        while (remainingVol > 0 && i < top.length) {
          // it's possible that the next price in the list is lower than the previous, so we check
          if (price <= top[i].price) {
            // console.log('remaining: ', remainingVol);
            remainingVol = closeOrder(top[i], remainingVol, 'BUY');
            // console.log('new volume is: ', remainingVol);
            // console.log('Im gonna write: ', volume - remainingVol);
            resolvePosition({ userId, price: top[i].price, volume: volume - remainingVol }, type);
            i++;
          // if the order price no longer beats the listed price, we set the reprocess flag to true
          } else {
            reprocess = true;
            break;
          }
        }
        // if the top 10 listings did not fulfill the order, repeat the process
        if (reprocess || remainingVol) {
          order.volume = remainingVol;
          processOrder({ type, order });
        }
      }
    });
  }
};

// processOrder({type: 'SELL', order: { price: 1.01, volume: 1, userId: 1, }});

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
      // console.log(dataValues);
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
      // console.log(dataValues);
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
      .then(res => {
        // console.log('MATCHED: ', res[0].dataValues)
      });
  }
  if (orderType === 'ASK') {
    Buy
      .max('price')
      .then(res => {
        // console.log(res)
      });
  }
};



//export DB tables
module.exports = {
  Buy,
  Sell,
  Pair,
  sequelize,
  topBuys,
  topSells,
  processOrder,
  closeOrder,
  resolveOrder,
  openPosition,
  updatePosition,

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
