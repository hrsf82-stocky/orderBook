// import '../db';
const { Buy, Sell, resolveOrder } = require('../db');

//TODO: setup connection to SQS
//TODO: handle incoming orders
//TODO: form outgoing profit messages


//////////////////////
// Start DB actions //
//////////////////////

// Uncomment to generate data upon start (REQUIRES DB WRITE):
// let fakeData = generateFakeData(1000);

Buy
  .sync()
  // .then(() => Buy.min('price'))
  // .then(res => console.log(res));
// .then(() => Buy.bulkCreate(fakeData.bids))
// .then(() => Buy.count())
// .then(results => console.log('BUYS: ', results))
// .then(() => console.log('startSort'))
// .then(() => topBuys());
// .then(() => Buy.max('price'))
// .then(result => console.log('max: ', result));

Sell
  .sync()
  .then(() => resolveOrder({ id: 2516623, type: 'SELL' }, { vol: 220 }));
// .then(() => console.log('startSort'))
// .then(() => topSells());
// .then(() => match({ payload: { orderType: 'BID', userId: 2, price: 1.0725, vol: 1}}));
// .then(() => Sell.min('price'))
// .then(result => Sell.findAll({ limit: 10, where: { price: result }, order: [[sequelize.col('createdAt'), 'ASC']]}))
// .then(results => console.log(results));
// .then(() => Sell.bulkCreate(fakeData.asks))
// .then(() => Sell.count())
// .then(results => console.log('SELLS: ', results));

console.log('Hello World');