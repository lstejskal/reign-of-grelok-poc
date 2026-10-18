import { describe, expect, it } from 'vitest';
import { SentenceBuilder } from './SentenceBuilder';
import { TextPager, wrapText } from './textPages';
import { verbAt, verbRect } from './layout';
import { VERBS } from './verbs';

describe('SentenceBuilder', () => {
  it('a one-object verb: Look at + thing', () => {
    const b = new SentenceBuilder();
    b.selectVerb('look_at');
    expect(b.text).toBe('Look at');
    b.hover('standing_stone');
    expect(b.text).toBe('Look at standing stone');
    expect(b.pickObject('standing_stone')).toEqual({ verb: 'look_at', objects: ['standing_stone'] });
    expect(b.selectedVerb).toBeUndefined(); // back to idle
  });

  it('a two-object verb needs two picks and shows the preposition', () => {
    const b = new SentenceBuilder();
    b.selectVerb('use');
    expect(b.pickObject('pebble')).toBeUndefined();
    expect(b.text).toBe('Use pebble with');
    b.hover('zombie');
    expect(b.text).toBe('Use pebble with zombie');
    expect(b.pickObject('zombie')).toEqual({ verb: 'use', objects: ['pebble', 'zombie'] });

    b.hover(undefined);
    b.selectVerb('give');
    b.pickObject('gemstone');
    expect(b.text).toBe('Give gemstone to');
  });

  it('refuses to use a thing with itself', () => {
    const b = new SentenceBuilder();
    b.selectVerb('use');
    b.pickObject('pebble');
    b.hover('pebble');
    expect(b.text).toBe('Use pebble with'); // no "with pebble" preview
    expect(b.pickObject('pebble')).toBeUndefined();
    expect(b.pending).toEqual(['pebble']);
  });

  it('cancel() returns to idle, and choosing another verb starts over', () => {
    const b = new SentenceBuilder();
    b.selectVerb('use');
    b.pickObject('pebble');
    b.cancel();
    expect(b.selectedVerb).toBeUndefined();
    expect(b.pending).toEqual([]);

    b.selectVerb('use');
    b.pickObject('pebble');
    b.selectVerb('pick_up');
    expect(b.pending).toEqual([]);
    expect(b.text).toBe('Pick up');
  });

  it('with no verb chosen, things in the scene are walked to and carried things are looked at', () => {
    const b = new SentenceBuilder();
    expect(b.idle).toBe(true);
    expect(b.text).toBe('');

    b.hover('rubble');
    expect(b.text).toBe('Walk to rubble');
    expect(b.pickObject('rubble')).toBeUndefined(); // not a command: the scene walks there
    expect(b.idle).toBe(true);

    b.hover('pebble', true);
    expect(b.text).toBe('Look at pebble');
    expect(b.pickObject('pebble', true)).toEqual({ verb: 'look_at', objects: ['pebble'] });
  });

  it('right-click looks at the thing, whatever the sentence was', () => {
    const b = new SentenceBuilder();
    b.selectVerb('give');
    b.pickObject('gemstone');
    expect(b.lookAt('wizard')).toEqual({ verb: 'look_at', objects: ['wizard'] });
    expect(b.selectedVerb).toBeUndefined();
    expect(b.pending).toEqual([]);
  });
});

describe('verb grid layout', () => {
  it('finds every verb at its own button and nothing elsewhere', () => {
    VERBS.forEach((spec, i) => {
      const r = verbRect(i);
      expect(verbAt(r.x + 1, r.y + 1)).toBe(spec.verb);
      expect(verbAt(r.x + r.w - 1, r.y + r.h - 1)).toBe(spec.verb);
    });
    expect(verbAt(160, 50)).toBeUndefined();
  });
});

describe('text paging', () => {
  it('wraps without splitting words and keeps explicit line breaks', () => {
    expect(wrapText('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc']);
    expect(wrapText('one\ntwo', 20)).toEqual(['one', 'two']);
  });

  it('shows a long text a page at a time, then disappears', () => {
    const pager = new TextPager(5, 2);
    pager.set('aaaa bbbb cccc dddd eeee');
    expect(pager.current).toBe('aaaa\nbbbb');
    expect(pager.hasMore).toBe(true);
    expect(pager.next()).toBe(true);
    expect(pager.current).toBe('cccc\ndddd');
    pager.next();
    expect(pager.current).toBe('eeee');
    expect(pager.hasMore).toBe(false);
    expect(pager.next()).toBe(false);
    expect(pager.current).toBe('');
  });
});
