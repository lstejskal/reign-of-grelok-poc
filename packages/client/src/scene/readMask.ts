import Phaser from 'phaser';
import type { MaskImage } from '../walk/pathfinding';

/** Read the pixels of a loaded picture (Phaser keeps textures on the GPU side; a canvas gets us the numbers). */
export function readMask(textures: Phaser.Textures.TextureManager, key: string): MaskImage {
  const source = textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
