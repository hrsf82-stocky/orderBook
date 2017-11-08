import { Buy, Sell, cache } from '..';
import { sqs, sqsUrls } from '../../server';
const { extend } = require('lodash');

export const updatePrice = () => {
  //get current best prices
  let buyPrice;
  let sellPrice;
  Buy.max('price')
    .then(max => {
      console.log('max buy: ', max);
      buyPrice = max;
    }).then(() => Sell.min('price'))
    .then(min => {
      console.log('min sell: ', min);
      sellPrice = min;
    }).then(() => {
      if (cache.bid !== buyPrice || cache.ask !== sellPrice) {
        let message = extend(cache, { bid: buyPrice, ask: sellPrice, time: new Date().toISOString() });
        console.log('message: ', message, 'cache: ', cache);
        //send message to appropriate queue
        sqs.sendMessage({
          DelaySeconds: 0,
          QueueUrl: sqsUrls.priceQueue,
          MessageBody: JSON.stringify({ payload: message }),
        }, (err, data) => {
          if (err) {
            console.log(err);
          } else {
            console.log(data);
          }
        });
        //reset cache
        cache.bid_vol = 0;
        cache.ask_vol = 0;
      }
    });
};