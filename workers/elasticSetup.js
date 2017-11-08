const elasticsearch = require('elasticsearch');

const elasticClient = new elasticsearch.Client({
  host: 'localhost:9200',
  // log: 'trace'
});

elasticClient.ping({
  // ping usually has a 3000ms timeout 
  requestTimeout: 1000
}, function (error) {
  if (error) {
    console.trace('elasticsearch cluster is down!');
  } else {
    console.log('All is well');
  }
});

module.exports = {
  elasticClient
};

// create 'orders' index
// elasticClient.indices
//   .create({ index: 'orders' })
//   .then((err, res, status) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log('created orders: ', res);
//     }
//   });

//generate random orders
// let fakeData = generateFakeData(1, 1.0729);

// console.time('insert');
// fakeData.bids.forEach(order => {
//   elasticClient.index({
//     type: 'bid',
//     index: 'orders',
//     body: order,
//   });
// });

// fakeData.asks.forEach(order => {
//   elasticClient.index({
//     type: 'ask',
//     index: 'orders',
//     body: order,
//   });
// });
// console.timeEnd('insert');

// Create 'positions' index
// elasticClient.indices
//   .create({ index: 'positions' })
//   .then((err, res, status) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log('created positions: ', res);
//     }
//   });

// elasticClient.index({
//   id: 23, //userId
//   type: 'long',
//   body: [
//     {
//       price: 1.0729,
//       vol: 220,
//     },
//     {
//       price: 1.0730,
//       vol: 120,
//     }
//   ]
// }).then((err, res) => {
//   if (err) {
//     console.log(err);
//   } else {
//     console.log(res);
//   }
// }).then(() => elasticClient.search({
//   index: 'positions',
//   type: 'long',
// }).then((err, res) => {
//   if (err) {
//     console.log(err);
//   } else {
//     console.log(res);
//   }
// }));

// for (let i = 0; i < 100; i++) {
//   elasticClient.index({
//     id: i, //userId
//     index: 'positions',
//     type: 'long',
//     body: {
//       orders: [
//         {
//           price: 1.0729,
//           vol: 220,
//         },
//         {
//           price: 1.0730,
//           vol: 120,
//         }
//       ]
//     }
//   }).then((err, res) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log(res);
//     }
//   });
// }

// elasticClient.search({
//   index: 'positions',
//   type: 'long',
// }).then((err, res) => {
//   if (err) {
//     console.log(err);
//   } else {
//     console.log(res);
//   }
// });

// Delete 'positions' index
// elasticClient.indices
//   .delete({ index: 'positions' })
//   .then((err, res, status) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log('deleted positions: ', res);
//     }
//   });