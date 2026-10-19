import { Engine } from '@grelok/engine';
import type { Command, EngineEvent, GameBundle } from '@grelok/engine';
import { MemoryStore, SaveStore } from './save/saveGame';

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
  private current: Engine;

  constructor(
    readonly bundle: GameBundle,
    engine: Engine,
    /** Where this game's saves live (in tests: memory). */
    readonly saves: SaveStore = new SaveStore(new MemoryStore(), bundle.id),
  ) {
    this.current = engine;
  }

  /** The engine that is running now. It is replaced as a whole when a game is started or loaded. */
  get engine(): Engine {
    return this.current;
  }

  /** Start over: a fresh engine at the game's start location. */
  newGame(): void {
    this.current = new Engine(this.bundle.logic, { startLocation: this.bundle.config.start });
  }

  /** Continue from a saved engine string (throws if it is damaged). */
  loadEngine(saved: string): void {
    this.current = Engine.deserialize(this.bundle.logic, saved);
  }

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
