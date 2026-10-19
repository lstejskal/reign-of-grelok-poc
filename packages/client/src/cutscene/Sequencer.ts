import type { CutsceneStep, Facing, Point } from '@grelok/engine';

/**
 * Everything a cutscene can make happen. The Sequencer only calls these in order; HOW each one is drawn (tweens,
 * the walking sprite, the text box...) is the scene's business. Methods that return a Promise are waited for:
 * the next step starts when the promise resolves. That is the whole idea of a sequencer.
 */
export interface CutsceneActor {
  walk(to: Point): Promise<void>;
  face(facing: Facing): void;
  narrate(text: string): Promise<void>;
  say(speaker: string, text: string): Promise<void>;
  wait(seconds: number): Promise<void>;
  fade(to: 'out' | 'in'): Promise<void>;
  shake(seconds: number): Promise<void>;
  sfx(name: string): void;
  music(name: string): void;
  sync(): void;
  end(lines: string[]): void;
}

/** A short description of a step, for logs and tests ("wait 0.5", "sfx clang"). */
export function describeStep(step: CutsceneStep): string {
  switch (step.type) {
    case 'walk':
      return `walk ${step.to.join(',')}`;
    case 'face':
      return `face ${step.facing}`;
    case 'narrate':
      return `narrate ${step.message ?? step.text}`;
    case 'say':
      return `say ${step.speaker}`;
    case 'wait':
    case 'shake':
      return `${step.type} ${step.seconds}`;
    case 'fade':
      return `fade ${step.to}`;
    case 'sfx':
    case 'music':
      return `${step.type} ${step.name}`;
    case 'sync':
      return 'sync';
    case 'end':
      return 'end';
  }
}

/**
 * Plays cutscenes: runs the steps one after another, waiting for each to finish. While anything is playing
 * `running` is true, and the scene uses that to lock the player's input.
 *
 * A cutscene started while another plays waits its turn. If a step throws, the error is reported and the
 * cutscene stops - but `running` always goes back to false, so the game can never stay locked.
 */
export class Sequencer {
  private chain: Promise<void> = Promise.resolve();
  private waiting = 0;
  /** What has been played, in order (the last 50 steps): handy in tests and when debugging a cutscene. */
  readonly log: string[] = [];

  constructor(private readonly onError: (error: unknown) => void = console.error) {}

  get running(): boolean {
    return this.waiting > 0;
  }

  /** Play `steps` (after any cutscene already playing). Resolves when they are all done. */
  play(steps: readonly CutsceneStep[], actor: CutsceneActor, messageText: (key: string) => string): Promise<void> {
    this.waiting++;
    const run = async () => {
      try {
        for (const step of steps) {
          this.log.push(describeStep(step));
          if (this.log.length > 50) this.log.shift();
          await this.perform(step, actor, messageText);
        }
      } catch (error) {
        this.onError(error);
      } finally {
        this.waiting--;
      }
    };
    this.chain = this.chain.then(run);
    return this.chain;
  }

  private async perform(step: CutsceneStep, actor: CutsceneActor, messageText: (key: string) => string): Promise<void> {
    switch (step.type) {
      case 'walk':
        return actor.walk(step.to);
      case 'face':
        return actor.face(step.facing);
      case 'narrate':
        return actor.narrate(step.message !== undefined ? messageText(step.message) : (step.text ?? ''));
      case 'say':
        return actor.say(step.speaker, step.text);
      case 'wait':
        return actor.wait(step.seconds);
      case 'fade':
        return actor.fade(step.to);
      case 'shake':
        return actor.shake(step.seconds);
      case 'sfx':
        return actor.sfx(step.name);
      case 'music':
        return actor.music(step.name);
      case 'sync':
        return actor.sync();
      case 'end':
        return actor.end(step.lines);
    }
  }
}
