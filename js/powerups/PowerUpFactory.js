import { PU } from '../config/PowerUpTypes.js';
import { BombHome } from './BombHome.js';
import { BombGarden } from './BombGarden.js';
import { Dynamite } from './Dynamite.js';
import { Tnt } from './Tnt.js';
import { Rocket } from './Rocket.js';
import { Firecracker } from './Firecracker.js';
import { RainbowBall } from './RainbowBall.js';
import { PaperPlane } from './PaperPlane.js';

export class PowerUpFactory {
  static getPowerUp(type) {
    if (!type) return null;
    switch (type) {
      case PU.HOME_BOMB:    return new BombHome();
      case PU.GARDEN_BOMB:  return new BombGarden();
      case PU.DYNAMITE:     return new Dynamite();
      case PU.TNT:          return new Tnt();
      case PU.ROCKET_H:     return new Rocket('horizontal');
      case PU.ROCKET_V:     return new Rocket('vertical');
      case PU.FIRECRACKER:  return new Firecracker();
      case PU.RAINBOW:      return new RainbowBall();
      case PU.PAPERPLANE:   return new PaperPlane();
      default:              return null;
    }
  }

  static getAffectedCells(type, r, c, board, targetColor = null, direction = null) {
    const pu = this.getPowerUp(type);
    if (pu) return pu.getAffectedCells(r, c, board, targetColor, direction);
    return [];
  }
}
