const PD = require('probability-distributions');

/**
 * Use a Laplace probability distribution to generate fake orders 1000 at a time.
 
 * @param {int} quantity Every 1 quantity = 1000 data points
 */
module.exports.generateFakeData = (quantity, initialPrice = 1 + (Math.random() * 0.4)) => {
  let results = [];
  let bids = [];
  let asks = [];

  for (let i = 0; i < quantity; i++) {
    //generate 1000 data points per unit quantity
    PD.rlaplace(1000, initialPrice, 0.001).forEach(el => {
      // generate volume between 1 and 1001
      let volume = 1 + parseInt(Math.random() * 1000);
      // generate a userId between 1 and 101
      let userId = 1 + parseInt(Math.random() * 100);
      // truncate price after 4 decimal places
      let price = el.toFixed(4);
      // push to the appropriate arr
      if (price >= initialPrice) {
        asks.push({ userId, volume, price, pairPairId: 1 });
      } else {
        bids.push({ userId, volume, price, pairPairId: 1 });
      }
    });
  }
  // Uncomment these for 'debugging' purposes
  // console.log('initial: ', initialPrice);
  // console.log('bids: ', bids[0], bids.length);
  // console.log('asks: ', asks[0], asks.length);

  return { bids, asks, initialPrice };
};
