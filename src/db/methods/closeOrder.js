import { resolvePosition } from '.';
import { cache } from '..';

//destroy an order in the DB and return remaining volume to be processed
export const closeOrder = (order, incomingVol, type) => {
  let { userId, volume, price } = order.dataValues;
  // console.log('RECEIVED: ', userId, volume, price, incomingVol);
  // if the order is partially fulfilled, resolve the position and update the order
  if (incomingVol < volume) {
    let newVolume = volume - incomingVol;
    resolvePosition({userId, price, volume: incomingVol}, type);
    order.update({ volume: newVolume });
    if (type === 'BUY') {
      cache.bid_vol += newVolume;
    } else {
      cache.ask_vol += newVolume;
    }
    return 0;
  // if the order is completely fulfilled, resolve the position and destroy the order
  } else {
    resolvePosition({ userId, price, volume }, type);
    order.destroy();
    if (type === 'BUY') {
      cache.bid_vol += incomingVol;
    } else {
      cache.ask_vol += incomingVol;
    }
    return incomingVol - volume;
  }
};
