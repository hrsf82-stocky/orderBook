process.env.NODE_ENV = 'test';

const { expect, should } = require('chai');
import { Buy, Sell, Pair, Position } from '../src/db';
import { topBuys, topSells, processOrder, closeOrder } from '../src/db/methods';

describe('hooks', function() {
  
  beforeEach(function(done) {
    Buy.findAll()
      .then(res => res.forEach(row => row.destroy()))
      .then(() => Sell.findAll())
      .then(res => res.forEach(row => row.destroy()))
      .then(() => Position.findAll())
      .then(res => res.forEach(row => row.destroy()))
      .then(() => {
        let orders = [];
        for (let i = 1; i <= 10; i++) {
          orders.push({userId: i, volume: 1, price: 10});
        }
        return Buy
          .bulkCreate(orders);
      })
      // .then(() => topBuys(console.log))
      // .then(res => console.log(res))
      .then(() => {
        let orders = [];
        for (let i = 1; i <= 10; i++) {
          orders.push({userId: i, volume: 1, price: 10});
        }
        return Sell
          .bulkCreate(orders);
      })
      .then(() => done());
  });

  describe('orders', function() {
    // processOrder({order: {userId: 1, volume: 1, price: 1.0}, type: 'BUY'});
    describe('topBuys function', function() {
      it('should correctly return the first 10 BUY orders', function(done) {
        topBuys(top => expect(top.length).to.equal(10))
          .then(() => done())
          .catch(err => done(err));
      });
      it('should return the results in FIFO order', function(done) {
        topBuys(top => {
          expect(top[0].userId).to.equal(1);
          expect(top[9].userId).to.equal(10);
        }).then(() => done())
          .catch(err => done(err));
      });
    });

    describe('topSells function', function() {
      it('should correctly return the first 10 SELL orders', function(done) {
        topSells(top => expect(top.length).to.equal(10))
          .then(() => done())
          .catch(err => done(err));
      });
      it('should return the results in FIFO order', function(done) {
        topSells(top => {
          expect(top[0].userId).to.equal(1);
          expect(top[9].userId).to.equal(10);
        }).then(() => done())
          .catch(err => done(err));
      });
    });

    describe('processOrder', function() {
      it('should place an order in the list correctly', function(done) {
        processOrder({type: 'BUY', order: {userId: 666, price: 1, volume: 1}});
        Buy.min('price')
          .then(res => {
            expect(res).to.equal(1);
          })
          .then(() => done())
          .catch(err => done(err));
      });
    });

    describe('closeOrder', function() {
      it('should properly close an order', function(done) {
        Buy.find({ where: { userId: 1 }})
          .then(res => expect(closeOrder(res, 1, 'BUY').to.equal(0)))
          .then(() => done())
          .catch(err => done(err));
      });
    });
  });
});
