const { INTEGER, FLOAT, STRING, JSONB } = require('sequelize');

module.exports = {
  userId: {
    type: INTEGER,
    allowNull: false,
    primaryKey: true,
    unique: true,
  },
  // LONG/SHORT
  type: {
    type: STRING,
  },
  volume: {
    type: INTEGER
  },
  price: {
    type: FLOAT
  },
  //an array of orders, in order, to resolve
  //TODO: figure out if this is the best way to do it
  orders: {
    type: JSONB
  }
};