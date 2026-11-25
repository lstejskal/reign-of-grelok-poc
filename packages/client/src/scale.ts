import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';

/** Largest whole-number zoom that still fits the window (never below 1). */
export function integerZoom(winW: number, winH: number): number {
  return Math.max(1, Math.floor(Math.min(winW / CANVAS_WIDTH, winH / CANVAS_HEIGHT)));
}

/**
 * Keep the canvas at an integer multiple of its size (640x400). With a fractional zoom some
 * game pixels would be drawn 2 screen pixels wide and others 3, which looks uneven.
 */
export function keepIntegerZoom(game: Phaser.Game): void {
  const apply = () => game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight));
  apply();
  window.addEventListener('resize', apply);
}
