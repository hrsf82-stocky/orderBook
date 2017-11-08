const Sequelize = require('sequelize');
const { orderSchema, pairSchema, positionSchema } = require('./schemas');
let { POSTGRES: { USER, PASSWORD, HOST }} = require('../../config');

//instrument, time, bid, ask, bid_vol, ask_vol
//bid/ask vol are the total of all new orders w/in that time period plus the total of all resolved orders w/in that time period
//in other words, vol movements

USER = process.env.PGUSER || USER;
PASSWORD = process.env.PGPASSWORD || PASSWORD;
HOST = process.env.PGHOST || HOST;

/////////////////////////////
// Sequelize setup/DB init //
/////////////////////////////

console.log(process.env.NODE_ENV);

const selectedDB = (process.env.NODE_ENV === 'development') ? 'orderBook' : 'mockOrderBook';

console.log(selectedDB);

// setup Postgres
const sequelize = new Sequelize(selectedDB, USER, PASSWORD, {
  host: HOST,
  port: 5432,
  dialect: 'postgres',
  // sync: { force: true },
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

Buy.sync();
Sell.sync();

// console.log('From Index: ', Buy);

let cache = {
  instrument: 'EURUSD',
  bid: null,
  ask: null,
  bid_vol: 0,
  ask_vol: 0,
};

//export DB tables
export {
  Buy,
  Sell,
  Pair,
  Position,
  sequelize,
  cache,
};
