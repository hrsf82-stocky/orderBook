process.env.NODE_ENV = 'development';

const AWS = require('aws-sdk');
// const { Buy, Sell, Pair, Position } = require('../db');
import { topBuys, topSells, processOrder, generateFakeData, updatePrice } from '../db/methods';
import { Buy, Sell, Pair, Position } from '../db';

// let { bids, asks } = generateFakeData(1, 1.2);
// Buy.bulkCreate(bids);
// Sell.bulkCreate(asks);
// Pair.create({name: 'EURUSD'});

// console.log('from Server: ', Sell);
// topBuys(console.log);

// processOrder({order: {userId: 1, volume: 1, price: 0.2}, type: 'BUY'});

//to 
// {payload: {instrument, time, bid, ask, bid_vol, ask_vol}}
// time: ISO string of time object
// new Date().toISOString();
// bid_vol, ask_vol are vol of fulfilled transactions since last price update

// updatePrice();

// let { bids, asks } = generateFakeData(10, 1.2);
// Buy.bulkCreate(bids).then(res => console.log(res));
// Sell.bulkCreate(asks).then(res => console.log(res));

export const sqsUrls = {
  ordersRequest: 'https://sqs.us-west-2.amazonaws.com/179737091880/ordersrequest.fifo',
  fulfilledorders: 'https://sqs.us-west-1.amazonaws.com/858778373274/FulfilledOrderQueue',
  priceQueue: 'https://sqs.us-west-1.amazonaws.com/287396276472/SQS_PRICES_QUEUE'
};

//TODO: setup connection to SQS
// Load credentials and set the region from the JSON file
AWS.config.loadFromPath('./config.json');

export const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const Consumer = require('sqs-consumer');

// processOrder({order: { userId: 123456789, volume: 1, price: 1.2209 }, type: 'BUY'});

const app = Consumer.create({
  queueUrl: sqsUrls.ordersRequest,
  batchSize: 5,
  handleMessage: (message, done) => {
    console.log(message);
    //JSON parse the order
    let theOrder = JSON.parse(message.Body);
    //convert price to float
    theOrder.order.price = parseFloat(theOrder.order.price);
    processOrder(theOrder);
    done();
  }
});

app.on('error', (err) => {
  console.log(err.message);
});

app.start();

//TODO: handle incoming orders
//TODO: form outgoing profit messages


//////////////////////
// Start DB actions //
//////////////////////

// Uncomment to generate data upon start (REQUIRES DB WRITE):
// console.time('fakeData');
// let fakeData = generateFakeData(1000, 1.2);
// console.timeEnd('fakeData');

// Buy
//   .sync()
  // .then(() => Buy.min('price'))
  // .then(res => console.log(res));
  // .then(() => {
  //   console.time('buys');
  //   return Buy.bulkCreate(fakeData.bids);
  // })
  // .then(() => {
  //   // console.timeEnd('buys');
  //   console.time('buysCount');
  //   return Buy.count();
  // })
  // .then(results => {
  //   console.timeEnd('buysCount');
  //   console.log('BUYS: ', results);
  // });
// .then(() => console.log('startSort'))
  // .then(() => {
  //   console.time('topBuys');
  //   topBuys(res => console.log(res[0]));
  //   console.timeEnd('topBuys');
  // });
// .then(() => Buy.max('price'))
// .then(result => console.log('max: ', result));

// Sell
//   .sync()
  // .then(() => resolveOrder({ id: 2516623, type: 'SELL' }, { vol: 220 }));
// .then(() => console.log('startSort'))
  // .then(() => {
  //   console.time('topSells');
  //   topSells(res => console.log(res[0]));
  //   console.timeEnd('topSells');
  // });
// .then(() => match({ payload: { orderType: 'BID', userId: 2, price: 1.0725, vol: 1}}));
// .then(() => Sell.min('price'))
// .then(result => Sell.findAll({ limit: 10, where: { price: result }, order: [[sequelize.col('createdAt'), 'ASC']]}))
// .then(results => console.log(results));
  // .then(() => {
  //   console.time('sells');
  //   return Sell.bulkCreate(fakeData.asks);
  // })
  // .then(() => {
  //   // console.timeEnd('sells');
  //   console.time('sellCount');
  //   return Sell.count();
  // })
  // .then(results => {
  //   console.timeEnd('sellCount');
  //   console.log('SELLS: ', results);
  // });

console.log('Hello World');
