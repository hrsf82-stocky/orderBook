process.env.NODE_ENV = 'test';
const { expect } = require('chai');
import { generateFakeData } from '../src/db/methods';

describe('generateFakeData', function() {
  let num = 100;
  let generatedData = generateFakeData(num);
  let { bids, asks, initialPrice } = generatedData;
  it('should generate 1000x the input quantity', function() {
    expect(bids.length + asks.length).to.equal(1000 * num);
  });
  it('should filter bids and asks based on the initial price', function() {
    bids = bids.sort((a, b) => b.price - a.price);
    asks = asks.sort((a, b) => a.price - b.price);
    expect(bids[0].price < initialPrice).to.be.true;
    expect(asks[0].price >= initialPrice).to.be.true;
  });
});

//~666666 orders/second throughput