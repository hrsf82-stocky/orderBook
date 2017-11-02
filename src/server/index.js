process.env.NODE_ENV = 'development';

const AWS = require('aws-sdk');
const { Buy, Sell, Pair, topBuys, topSells, processOrder } = require('../db');
const { generateFakeData } = require('../db/methods');

const sqsUrls = {
  ordersRequest: 'https://sqs.us-west-2.amazonaws.com/179737091880/ordersrequest.fifo',
};

//TODO: setup connection to SQS
// Load credentials and set the region from the JSON file
AWS.config.loadFromPath('./config.json');

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const Consumer = require('sqs-consumer');

const app = Consumer.create({
  queueUrl: sqsUrls.ordersRequest,
  handleMessage: (message, done) => {
    console.log(message);
    processOrder(message.Body);
    done();
  }
});

app.on('error', (err) => {
  console.log(err.message);
});

app.start();
// const queueListen = () => {

//   let params = {
//     QueueUrl: sqsUrls.ordersRequest,
//     MaxNumberOfMessages: 1,
//     AttributeNames: ['All'],
//     // WaitTimeSeconds: 20,
//   };

//   sqs.receiveMessage(params, (err, data) => {
//     if (err) {
//       console.log(err, err.stack); // an error occurred
//     } else {
//       if (data.Messages) {
//         console.log(data.Messages);           // successful response
//         console.log('keys: ', Object.keys(data));
//         console.log('attributes: ', data.Messages[0].Attributes);
//         sqs.deleteMessage({
//           QueueUrl: sqsUrls.ordersRequest,
//           ReceiptHandle: data.Messages[0].ReceiptHandle,
//         }, (err, data) => {
//           if (err) {
//             console.log('there were an error', err, err.stack);
//           } else {
//             console.log('deleted: ', data);
//           }
//         });
//       } else {
//         console.log('no messages...', data);
//       }
//     }
//   });
// };

// setInterval(queueListen, 2500);

//TODO: handle incoming orders
//TODO: form outgoing profit messages


//////////////////////
// Start DB actions //
//////////////////////

// Uncomment to generate data upon start (REQUIRES DB WRITE):
// console.time('fakeData');
// let fakeData = generateFakeData(1000, 1.2);
// console.timeEnd('fakeData');

Buy
  .sync()
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

Sell
  .sync()
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
