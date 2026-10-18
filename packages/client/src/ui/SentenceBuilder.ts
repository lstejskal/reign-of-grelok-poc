import { Thing } from '@grelok/engine';
import type { Command, Verb } from '@grelok/engine';
import { DEFAULT_VERB, VERBS } from './verbs';
import type { VerbSpec } from './verbs';

/**
 * The state machine behind the sentence line. It knows nothing about Phaser or the mouse; the scene feeds it
 * what the player did and asks it two things: "what does the sentence say right now?" (`text`) and
 * "is the sentence finished?" (the Command returned by pickObject).
 *
 *   idle --selectVerb--> verb chosen --pickObject--> [first object chosen --pickObject-->] Command, back to idle
 *
 * "Look at" and "Pick up" need one object; "Use" and "Give" need two ("Use pebble with stone").
 * cancel() goes back to idle from anywhere.
 */
export class SentenceBuilder {
  private verb: Verb | undefined;
  private objects: string[] = [];
  private hovered: string | undefined;

  constructor(
    private readonly specs: readonly VerbSpec[] = VERBS,
    private readonly nameOf: (alias: string) => string = Thing.aliasToName,
  ) {}

  get selectedVerb(): Verb | undefined {
    return this.verb;
  }

  /** The things already picked for the sentence under construction. */
  get pending(): readonly string[] {
    return this.objects;
  }

  /** Choosing a verb always starts a new sentence. */
  selectVerb(verb: Verb): void {
    if (!this.specs.some((s) => s.verb === verb)) return;
    this.verb = verb;
    this.objects = [];
  }

  /** What the mouse is over right now (only changes the preview text, never the state). */
  hover(alias: string | undefined): void {
    this.hovered = alias;
  }

  /**
   * The player clicked a thing. Returns the finished Command, or undefined when the sentence needs more
   * (a second object) or the click makes no sense (using a thing with itself).
   */
  pickObject(alias: string): Command | undefined {
    if (this.verb === undefined) return this.finish({ verb: DEFAULT_VERB, objects: [alias] });

    const spec = this.specs.find((s) => s.verb === this.verb)!;
    if (spec.objects === 1) return this.finish({ verb: spec.verb, objects: [alias] });

    const [first] = this.objects;
    if (first === undefined) {
      this.objects = [alias];
      return undefined;
    }
    if (alias === first) return undefined;
    return this.finish({ verb: spec.verb, objects: [first, alias] });
  }

  /** Right-click: look at the thing, whatever the sentence was. */
  lookAt(alias: string): Command {
    return this.finish({ verb: 'look_at', objects: [alias] });
  }

  cancel(): void {
    this.verb = undefined;
    this.objects = [];
  }

  /** The sentence as shown on screen, including a preview of the thing under the mouse. */
  get text(): string {
    const hovered = this.hovered === undefined ? '' : this.nameOf(this.hovered);
    if (this.verb === undefined) return hovered;

    const spec = this.specs.find((s) => s.verb === this.verb)!;
    const words = [spec.label];
    const [first] = this.objects;
    if (first !== undefined) {
      words.push(this.nameOf(first), spec.preposition ?? '');
      if (this.hovered !== first) words.push(hovered);
    } else {
      words.push(hovered);
    }
    return words.filter((w) => w !== '').join(' ');
  }

  private finish(command: Command): Command {
    this.cancel();
    return command;
  }
}
