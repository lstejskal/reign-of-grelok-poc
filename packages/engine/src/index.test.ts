import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from './index';

describe('engine package', () => {
  it('is wired into the workspace', () => {
    expect(ENGINE_NAME).toBe('grelok-engine');
  });
});
