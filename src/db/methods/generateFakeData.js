const PD = require('probability-distributions');

/**
 * Use a Laplace probability distribution to generate fake orders 1000 at a time.
 
 * @param {int} quantity Every 1 quantity = 1000 data points
 */
module.exports = (quantity, initialPrice = 1 + (Math.random() * 0.4)) => {
  let results = [];
  let bids = [];
  let asks = [];

  for (let i = 0; i < quantity; i++) {
    //generate 1000 data points
    PD.rlaplace(1000, initialPrice, 0.001).forEach(el => {
      let volume = 1 + parseInt(Math.random() * 1000);
      let userId = 1 + parseInt(Math.random() * 100);
      let price = el.toFixed(4);
      if (price >= initialPrice) {
        asks.push({ userId, volume, price, pairPairId: 1 });
      } else {
        bids.push({ userId, volume, price, pairPairId: 1 });
      }
    });
  }
  console.log('initial: ', initialPrice);
  console.log('bids: ', bids[0], bids.length);
  console.log('asks: ', asks[0], asks.length);

  return { bids, asks, initialPrice };
};