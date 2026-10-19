import type { SpeakersConfig } from '@grelok/engine';
import { wrapText } from './textPages';

// Everything about *who says what and for how long*, with no Phaser in sight - so it is easy to test.

/** What one `say` event turns into: narration for the text box, and spoken lines for above a speaker's head. */
export interface Interpreted {
  narration: string;
  speech: SpeechLine[];
}

export interface SpeechLine {
  /** A key of speakers.yml. */
  speaker: string;
  text: string;
}

/** Which speaker's `messages` list claims this message key? (A trailing * in the list matches any ending.) */
export function speakerForKey(config: SpeakersConfig, key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  for (const [id, speaker] of Object.entries(config.speakers)) {
    for (const pattern of speaker.messages ?? []) {
      if (pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern) return id;
    }
  }
  return undefined;
}

/**
 * Split a message on its double quotes: what is in quotes is spoken, the rest is narration.
 *   `Priest smiles. "Help me!" He hands you a jug.`  ->  narration "Priest smiles. He hands you a jug." + speech "Help me!"
 * The speaker is whoever owns the message key, or the default speaker (Grognak) when nobody does.
 */
export function interpretSay(config: SpeakersConfig, text: string, key?: string): Interpreted {
  const speaker = speakerForKey(config, key) ?? config.default;
  const narration: string[] = [];
  const speech: SpeechLine[] = [];
  text.split('"').forEach((part, i) => {
    const clean = part.trim().replace(/\s+/g, ' ');
    if (clean === '') return;
    if (i % 2 === 1) speech.push({ speaker, text: clean });
    else narration.push(clean);
  });
  return { narration: narration.join(' '), speech };
}

/** How long a line stays up, in seconds: a moment to notice it, plus reading time. */
export function speechDuration(text: string): number {
  const letters = text.replace(/\s+/g, ' ').trim().length;
  return Math.min(7, Math.max(1.5, 1 + letters * 0.06));
}

export const SPEECH_CHARS = 26;
export const SPEECH_LINES = 3;

/**
 * The speech waiting to be shown, one page at a time. A long line is cut into pages (like the text box does);
 * each page stays up for its `speechDuration`, or until the player clicks to skip it.
 * `update` is told how many seconds passed and whether to hold still (while narration covers the screen).
 */
export class SpeechQueue {
  private pages: SpeechLine[] = [];
  private elapsed = 0;

  say(speaker: string, text: string): void {
    const lines = wrapText(text, SPEECH_CHARS);
    for (let i = 0; i < lines.length; i += SPEECH_LINES) {
      this.pages.push({ speaker, text: lines.slice(i, i + SPEECH_LINES).join('\n') });
    }
  }

  /** The page on screen, if any. */
  get current(): SpeechLine | undefined {
    return this.pages[0];
  }

  get busy(): boolean {
    return this.pages.length > 0;
  }

  update(seconds: number, paused = false): void {
    if (paused || !this.current) return;
    this.elapsed += seconds;
    if (this.elapsed >= speechDuration(this.current.text)) this.skip();
  }

  /** Drop the page on screen and go to the next. */
  skip(): void {
    this.pages.shift();
    this.elapsed = 0;
  }

  clear(): void {
    this.pages = [];
    this.elapsed = 0;
  }
}
