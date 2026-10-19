import { describe, expect, it } from 'vitest';
import type { SpeakersConfig } from '@grelok/engine';
import { SpeechQueue, interpretSay, speakerForKey, speechDuration } from './speech';

const config: SpeakersConfig = {
  default: 'grognak',
  speakers: {
    grognak: { name: 'Grognak', color: '#ffe040' },
    smith: { name: 'Smith', color: '#ff9a3c', messages: ['talk_to_smith', 'ask_smith_about_*'] },
  },
};

describe('speakerForKey', () => {
  it('matches exact keys and trailing-* patterns', () => {
    expect(speakerForKey(config, 'talk_to_smith')).toBe('smith');
    expect(speakerForKey(config, 'ask_smith_about_grelok')).toBe('smith');
    expect(speakerForKey(config, 'talk_to_smithy')).toBeUndefined();
    expect(speakerForKey(config, undefined)).toBeUndefined();
  });
});

describe('interpretSay', () => {
  it('splits narration from quoted speech and gives the words to the key\'s speaker', () => {
    const got = interpretSay(config, 'Smith grins. "Hello!"  He   waves.', 'talk_to_smith');
    expect(got).toEqual({ narration: 'Smith grins. He waves.', speech: [{ speaker: 'smith', text: 'Hello!' }] });
  });

  it('gives quotes nobody claims to the default speaker', () => {
    expect(interpretSay(config, 'Say "hm".', 'other').speech).toEqual([{ speaker: 'grognak', text: 'hm' }]);
  });

  it('keeps a message without quotes as pure narration', () => {
    expect(interpretSay(config, 'You picked up pebble.', 'x')).toEqual({ narration: 'You picked up pebble.', speech: [] });
  });
});

describe('speechDuration', () => {
  it('grows with the text but stays between 1.5 and 7 seconds', () => {
    expect(speechDuration('Hi')).toBe(1.5);
    expect(speechDuration('x'.repeat(50))).toBeCloseTo(4);
    expect(speechDuration('x'.repeat(500))).toBe(7);
  });
});

describe('SpeechQueue', () => {
  it('cuts long speech into pages of three lines', () => {
    const q = new SpeechQueue();
    q.say('smith', 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen');
    expect(q.current?.text.split('\n').length).toBe(3);
    q.skip();
    expect(q.current?.text).toBeDefined();
    q.skip();
    expect(q.busy).toBe(false);
  });

  it('moves on by itself when the time is up, and waits while paused', () => {
    const q = new SpeechQueue();
    q.say('a', 'Hi');
    q.say('b', 'There');
    q.update(10, true);
    expect(q.current?.speaker).toBe('a'); // paused: nothing happens
    q.update(1);
    expect(q.current?.speaker).toBe('a');
    q.update(1);
    expect(q.current?.speaker).toBe('b');
  });

  it('clear() forgets everything', () => {
    const q = new SpeechQueue();
    q.say('a', 'Hi');
    q.clear();
    expect(q.busy).toBe(false);
  });
});
