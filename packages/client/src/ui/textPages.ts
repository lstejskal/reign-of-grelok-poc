/** Break text into lines of at most `maxChars` characters (words are never split, "\n" starts a new line). */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/ +/).filter((w) => w !== '')) {
      if (line === '') line = word;
      else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * A long answer shown a few lines at a time: the player clicks to read on. Pure bookkeeping, no drawing.
 * (Step 10 reuses it for speech bubbles.)
 */
export class TextPager {
  private pages: string[][] = [];
  private index = 0;

  constructor(
    private readonly maxChars: number,
    private readonly linesPerPage: number,
  ) {}

  set(text: string): void {
    const lines = wrapText(text, this.maxChars);
    this.pages = [];
    for (let i = 0; i < lines.length; i += this.linesPerPage) this.pages.push(lines.slice(i, i + this.linesPerPage));
    this.index = 0;
  }

  clear(): void {
    this.pages = [];
    this.index = 0;
  }

  /** The lines of the page on screen ('' when there is nothing to show). */
  get current(): string {
    return (this.pages[this.index] ?? []).join('\n');
  }

  get hasMore(): boolean {
    return this.index < this.pages.length - 1;
  }

  /** Go to the next page; past the last one the text disappears. Returns whether something is still shown. */
  next(): boolean {
    this.index++;
    if (this.index >= this.pages.length) this.clear();
    return this.pages.length > 0;
  }
}
