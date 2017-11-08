import { Buy, sequelize } from '..';

// Find the first 10 open orders in the Buy table
export const topBuys = callback => {
  // console.log('starting sort');
  return Buy
    .max('price')
    .then(max => Buy.findAll({
      limit: 10,
      where: { price: max }, 
      order: [[sequelize.col('price'), 'DESC'], [sequelize.col('createdAt'), 'ASC']]
    }))
    .then(results => callback(results));
};
