process.env.NODE_ENV = 'test';

const { expect, should } = require('chai');
import { Buy, Sell, Pair, Position } from '../src/db';
import { openPosition, updatePosition } from '../src/db/methods';

// if (!result) {
//   // console.log('Got to OPEN POSITION');
//   openPosition({ userId, price, volume, type });
// // if so, update/close the position as necessary
// } else {
//   // console.log('Got to UPDATE POSITION');
//   updatePosition({ userId, price, volume, type });
// }

describe('hooks', function() {
  
  beforeEach(function(done) {
    Position.findAll()
      .then(res => res.forEach(row => row.destroy()))
      .then(() => done());
  });

  describe('positions', function() {
    describe('openPosition', function() {
      it('should properly open a position', function(done) {
        openPosition({ userId: 999, price: 999.999, volume: 999, type: 'BUY' })
          .then(() => Position.find({ where: { userId: 999 }}))
          .then(({dataValues}) => expect(dataValues.volume).to.equal(999))
          .then(() => done())
          .catch(err => done(err));
      });
      it('should properly update a position', function(done) {
        updatePosition({ userId: 999, price: 999.999, volume: 990, type: 'SELL' })
          .then(() => Position.find({ where: { userId: 999 }}))
          .then(({dataValues}) => expect(dataValues.volume).to.equal(9))
          .then(() => done())
          .catch(err => done(err));
      });
    });
  });
});