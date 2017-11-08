import { Position } from '..';
import { openPosition, updatePosition } from '.';

// Create or update a position to reflect a completed order
export const resolvePosition = ({userId, price, volume}, type) => {
  // check id to see if the user has an existing position
  Position.findById(userId)
    .then(result => {
      // if not, create a position for that user
      if (!result) {
        // console.log('Got to OPEN POSITION', userId, result);
        openPosition({ userId, price, volume, type });
      // if so, update/close the position as necessary
      } else {
        // console.log('Got to UPDATE POSITION', userId, result);
        updatePosition({ userId, price, volume, type });
      }
    });
};
