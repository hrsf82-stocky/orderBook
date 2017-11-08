import { Buy, Sell, Position } from '..';
import { topBuys, topSells, resolvePosition, closeOrder, updatePrice } from '.';

// console.log('HI SELL: ', Sell);

// Handle an incoming order from the queue/HTTP request
export const processOrder = ({ type, order }) => {
  let { userId, volume, price } = order;
  // console.log('SAW', volume, price);
  // if the order is to buy, try to find a matching sell order or add it to the buy list
  if (type === 'BUY') {
    // console.log('HI BUY');
    // load the next 10 sell orders in line
    topSells(top => {
      // console.log('FOUND: ', top[0]);
      try {
        // if price is less than the best sell price listed, we know there's no match
        // alternatively, if there's no results, this is the first order
        if (!top || price < top[0].price) {
          // console.log('below best price, creating new order');
          return Buy.create(order);
        // if price is greater than the best sell price listed, we match the order
        } else {
          // console.log('above best price, resolving order');
          let remainingVol = volume;
          let i = 0;
          let reprocess = false;
          // we close listings until the entire order volume has been fulfilled
          while (remainingVol > 0 && i < top.length) {
            // it's possible that the next price in the list is higher than the previous, so we check
            if (price >= top[i].price) {
              // console.log('remaining: ', remainingVol);
              remainingVol = closeOrder(top[i], remainingVol, 'SELL');
              // console.log('new volume is: ', remainingVol);
              // console.log('Im gonna write: ', volume - remainingVol);
              resolvePosition({ userId, price: top[i].price, volume: volume - remainingVol }, type);
              i++;
            // if the order price no longer beats the listed price, we set the reprocess flag to true
            } else {
              reprocess = true;
              break;
            }
          }
          // if the top 10 listings did not fulfill the order, repeat the process
          if (reprocess || remainingVol) {
            order.volume = remainingVol;
            processOrder({ type, order });
          }
        }
      } catch (err) {
        console.log('error: ', err, ' ...retrying');
        processOrder({type, order});
      }
    });
  // if the order is to sell, try to find a matching buy order or add it to the sell list
  } else if (type === 'SELL') {
    // console.log('HI SELL');
    // load the next 10 buy orders in line
    topBuys(top => {
      try {
        // console.log('FOUND: ', top[0]);
        // if price is greater than the best buy price listed, we know there's no match
        // alternatively, if there's no results, this is the first order
        if (!top || price > top[0].price) {
          // console.log('above best price, creating new order');        
          return Sell.create(order);
        // if price is less than the best buy price listed, we match the order
        } else {
          // console.log('beats best price, resolving order');        
          let remainingVol = volume;
          let i = 0;
          let reprocess = false;
          // we close listings until the entire order volume has been fulfilled
          while (remainingVol > 0 && i < top.length) {
            // it's possible that the next price in the list is lower than the previous, so we check
            if (price <= top[i].price) {
              // console.log('remaining: ', remainingVol);
              remainingVol = closeOrder(top[i], remainingVol, 'BUY');
              // console.log('new volume is: ', remainingVol);
              // console.log('Im gonna write: ', volume - remainingVol);
              resolvePosition({ userId, price: top[i].price, volume: volume - remainingVol }, type);
              i++;
            // if the order price no longer beats the listed price, we set the reprocess flag to true
            } else {
              reprocess = true;
              break;
            }
          }
          // if the top 10 listings did not fulfill the order, repeat the process
          if (reprocess || remainingVol) {
            order.volume = remainingVol;
            processOrder({ type, order });
          }
        }
      } catch (err) {
        console.log('error: ', err, ' ...retrying');
        processOrder({type, order});
      }
    });
  }
  updatePrice();
};
