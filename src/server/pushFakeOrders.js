const AWS = require('aws-sdk');
const { elasticClient } = require('../../workers/elasticSetup');
const { generateFakeData } = require('../db/methods/generateFakeData');

const sqsUrls = {
  ordersRequest: 'https://sqs.us-west-2.amazonaws.com/179737091880/ordersrequest.fifo',
};

// Load credentials and set the region from the JSON file
AWS.config.loadFromPath('./config.json');

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

let messageId = 20;

const randomOrder = price => {
  let userId = 222;
  let types = ['BUY', 'SELL'];
  let type = types[Math.round(Math.random())];
  // let type = 'SELL';
  let volume = parseInt(Math.random() * 1000);
  // let volume = 10000;
  if (type === 'BUY') {
    price = (price + (Math.random() * 0.1)).toFixed(4);
  } else {
    price = (price - (Math.random() * 0.1)).toFixed(4);
  }
  console.log('generated: ', { order: { userId, volume, price }, type });
  return { order: { userId, volume, price }, type };
};

const generateOrders = () => {
  let order = randomOrder(1.2);
  let params = {
    MessageBody: JSON.stringify(order),
    QueueUrl: sqsUrls.ordersRequest,
    DelaySeconds: 0,
    MessageGroupId: 'EURUSD',
    // MessageDeduplicationId: `${messageId++}`,
  };
  
  let { type } = order;
  let { userId, volume, price } = order.order;
  
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err, err.stack); // an error occurred
    } else {
      console.log(data.MessageId); // successful response
      elasticClient.index({
        type,
        id: data.MessageId,
        index: 'orders',
        body: {
          userId,
          volume,
          price: parseFloat(price),
        }
      }).then((err, res) => {
        if (err) {
          console.log(err);
        } else {
          console.log(res);
        }
      });
    }
  });
};

// elasticClient.indices
//   .create({ index: 'orders' })
//   .then((err, res, status) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log('created orders: ', res);
//     }
//   });
// generateOrders();

setInterval(generateOrders, 1000);