const AWS = require('aws-sdk');
const { generateFakeData } = require('../db/methods');

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
  let volume = parseInt(Math.random() * 1000);
  if (type === 'BUY') {
    price = (price + (Math.random() * 0.1)).toFixed(4);
  } else {
    price = (price - (Math.random() * 0.1)).toFixed(4);
  }
  console.log('generated: ', { order: { userId, volume, price }, type });
  return { order: { userId, volume, price }, type };
};

const generateOrders = () => {
  let params = {
    MessageBody: JSON.stringify(randomOrder(1.2)),
    QueueUrl: sqsUrls.ordersRequest,
    DelaySeconds: 0,
    MessageGroupId: 'EURUSD',
    // MessageDeduplicationId: `${messageId++}`,
  };
  
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err, err.stack); // an error occurred
    } else {
      console.log(data); // successful response
    }
  });
};

// generateOrders();

setInterval(generateOrders, 100);