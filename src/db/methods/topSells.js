import { Sell, sequelize } from '..';

// Find the first 10 open orders in the Sell table
export const topSells = callback => {
  // console.log('starting sort');
  return Sell
    .min('price')
    .then(min => Sell.findAll({
      limit: 10,
      where: { price: min }, 
      order: [[sequelize.col('price'), 'ASC'], [sequelize.col('createdAt'), 'ASC']]
    }))
    .then(results => callback(results));
};
