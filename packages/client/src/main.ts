import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';
import { keepIntegerZoom } from './scale';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';
import { TitleScene } from './scenes/TitleScene';
import { installDebugHook } from './debug';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS_WIDTH, // 320x200 game units, ART_SCALE canvas pixels each (see config.ts)
  height: CANVAS_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true, // nearest-neighbour scaling, no smoothing
  scale: { mode: Phaser.Scale.NONE }, // we pick the zoom ourselves (integer only)
  scene: [BootScene, TitleScene, RoomScene],
});

keepIntegerZoom(game);
installDebugHook(game);
