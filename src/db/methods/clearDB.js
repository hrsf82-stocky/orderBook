import { Buy, Sell, Pair, Position } from '..';

export const clearDB = () => {
  Buy
    .sync({ force: true })
    .then(() => Sell.sync({ force: true }))
    .then(() => Pair.sync({ force: true }))
    .then(() => Position.sync({ force: true }));
};
