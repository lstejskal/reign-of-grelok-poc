import type { Command, Engine, EngineEvent, GameBundle } from '@grelok/engine';

type Listener = (events: EngineEvent[]) => void;

/**
 * One running game: the data, the engine, and a way for the rest of the client to react to what happens.
 *
 * Everything that changes the game (the debug console now, mouse clicks later) goes through perform() /
 * performText(); everything that shows the game (scenes, UI, console log) subscribes with onEvents().
 * Neither side needs to know about the other.
 */
export class GameSession {
  private listeners = new Set<Listener>();

  constructor(
    readonly bundle: GameBundle,
    readonly engine: Engine,
  ) {}

  perform(command: Command): EngineEvent[] {
    return this.publish(this.engine.perform(command));
  }

  performText(line: string): EngineEvent[] {
    return this.publish(this.engine.performText(line));
  }

  /** Call `listener` with every batch of events. Returns a function that unsubscribes. */
  onEvents(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(events: EngineEvent[]): EngineEvent[] {
    if (events.length > 0) {
      for (const listener of this.listeners) listener(events);
    }
    return events;
  }
}
