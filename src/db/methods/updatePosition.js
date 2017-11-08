import { Position } from '..';
import { elasticClient } from '../../../workers/elasticSetup';
import { sqs, sqsUrls } from '../../server';

// Modify an existing position
export const updatePosition = ({ userId, price, volume, type }) => {
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
        elasticClient.index({
          type,
          id: userId,
          index: 'positions',
          body: {
            price: parseFloat((newInfo.priceSum / (result.dataValues.orders.length + 1)).toFixed(4)),
            volume: newInfo.volSum,
          }
        });
        return Position.update({
          price: parseFloat((newInfo.priceSum / (result.dataValues.orders.length + 1)).toFixed(4)),
          volume: newInfo.volSum,
          orders: [...result.dataValues.orders, { price, volume }],
        }, {
          where: { userId },
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
          sqs.sendMessage({
            DelaySeconds: 0,
            QueueUrl: sqsUrls.fulfilledorders,
            MessageBody: JSON.stringify({
              userId,
              profit,
              pair: 'EURUSD',
            }),
          }, (err, data) => {
            if (err) {
              console.log(err);
            } else {
              console.log(data);
            }
          });

          console.log('profit: ', profit);
          //create a reverse position with the unresolved volume if there's a remainder
          if (volume > result.dataValues.volume) {
            //calculate the new sum of order prices and volumes to determine new overall position
            let newVolume = volume - result.dataValues.volume;
            if (process.env.NODE_ENV === 'development') {
              elasticClient.index({
                type,
                id: userId,
                index: 'positions',
                body: {
                  price,
                  volume: newVolume,
                }
              });
            }
            return result.update({
              price,
              type,
              volume: newVolume,
              orders: [{ price, volume: newVolume }],
            });
          //if no remainder, simply destroy the position
          } else {
            return result.destroy();
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
          sqs.sendMessage({
            DelaySeconds: 0,
            QueueUrl: sqsUrls.fulfilledorders,
            MessageBody: JSON.stringify({
              userId,
              profit,
              pair: 'EURUSD',
            }),
          }, (err, data) => {
            if (err) {
              console.log(err);
            } else {
              console.log(data);
            }
          });
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
            if (process.env.NODE_ENV === 'development') {
              elasticClient.index({
                type,
                id: userId,
                index: 'positions',
                body: {
                  price: (newInfo.priceSum / orders.length),
                  volume: newInfo.volSum,
                }
              });
            }
            return result.update({
              price: (newInfo.priceSum / orders.length),
              volume: newInfo.volSum,
              orders: [...orders],
            });
          // if the position was completely fulfilled, destroy it
          } else {
            return result.destroy();
          }
        }
      }
    });
  // update values
  // TODO: Send message to SQS with profit info
};
