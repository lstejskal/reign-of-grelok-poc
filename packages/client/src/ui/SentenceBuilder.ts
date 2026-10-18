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
 * With no verb chosen the sentence is "Walk to X" for things in the scene and "Look at X" for things you carry.
 * "Look at" and "Pick up" need one object; "Use" and "Give" need two ("Use pebble with stone").
 * cancel() goes back to idle from anywhere.
 */
export class SentenceBuilder {
  private verb: Verb | undefined;
  private objects: string[] = [];
  private hovered: string | undefined;
  private hoveredCarried = false;

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

  /** True while no verb is chosen. A click on a thing in the scene then means "walk there". */
  get idle(): boolean {
    return this.verb === undefined;
  }

  /**
   * What the mouse is over right now (only changes the preview text, never the state).
   * `carried` says the thing is in the inventory rather than in the scene.
   */
  hover(alias: string | undefined, carried = false): void {
    this.hovered = alias;
    this.hoveredCarried = carried;
  }

  /**
   * The player clicked a thing. Returns the finished Command, or undefined when the sentence needs more
   * (a second object) or the click makes no sense (using a thing with itself).
   */
  pickObject(alias: string, carried = false): Command | undefined {
    // With no verb chosen: a carried thing is looked at; a thing in the scene is not a command at all
    // (the scene walks there instead), so we return nothing.
    if (this.verb === undefined) return carried ? this.finish({ verb: DEFAULT_VERB, objects: [alias] }) : undefined;

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
    if (this.verb === undefined) {
      if (hovered === '') return '';
      return `${this.hoveredCarried ? 'Look at' : 'Walk to'} ${hovered}`;
    }

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
