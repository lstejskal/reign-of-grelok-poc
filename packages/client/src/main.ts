import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { keepIntegerZoom } from './scale';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';
import { TitleScene } from './scenes/TitleScene';
import { installDebugHook } from './debug';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true, // nearest-neighbour scaling, no smoothing
  scale: { mode: Phaser.Scale.NONE }, // we pick the zoom ourselves (integer only)
  scene: [BootScene, TitleScene, RoomScene],
});

keepIntegerZoom(game);
installDebugHook(game);
