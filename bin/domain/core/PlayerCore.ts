import { DomainEventBus } from "../ports/DomainEvenPort";

export type PlayerId = number;

export interface PlayerIdentity {
  id: PlayerId;
  name: string;
  nickname?: string;
}

export interface PlayerContext {
  // Ports available to modules (no concrete imports here)
  bus: DomainEventBus;
}

export interface PlayerModule {
  /** unique module key, e.g. "economy", "skills" */
  readonly key: string;
  /** lifecycle (optional) */
  onAttach?(player: PlayerCore): void;
  onDetach?(): void;
}

export class PlayerCore {
  readonly identity: PlayerIdentity;
  private modules = new Map<string, PlayerModule>();
  readonly ctx: PlayerContext;

  constructor(identity: PlayerIdentity, ctx: PlayerContext) {
    this.identity = identity;
    this.ctx = ctx;
  }

  attach<M extends PlayerModule>(mod: M): M {
    if (this.modules.has(mod.key)) throw new Error(`Module ${mod.key} exists`);
    this.modules.set(mod.key, mod);
    mod.onAttach?.(this);
    return mod;
  }

  get<M extends PlayerModule>(key: M["key"]): M {
    const m = this.modules.get(key);
    if (!m) throw new Error(`Module ${key} not found`);
    return m as M;
  }

  tryGet<M extends PlayerModule>(key: M["key"]): M | undefined {
    return this.modules.get(key) as M | undefined;
  }

  detach(key: string) {
    this.modules.get(key)?.onDetach?.();
    this.modules.delete(key);
  }
}
