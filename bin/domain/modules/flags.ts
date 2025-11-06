import { PlayerCore, PlayerModule } from "../core/PlayerCore";

export interface FlagsApi<F extends Record<string, any>> {
  get<K extends keyof F>(k: K): F[K];
  set<K extends keyof F>(k: K, v: F[K]): void;
  has<K extends keyof F>(k: K): boolean;
  merge(patch: Partial<F>): void;
  all(): Readonly<F>;
}

export type FlagsModule<F extends Record<string, any> = Record<string, any>> =
  PlayerModule & FlagsApi<F> & { key: "flags"; state: F };

export function createFlagsModule<F extends Record<string, any>>(initial: F): FlagsModule<F> {
  let player: PlayerCore;
  const state: F = { ...initial };
  return {
    key: "flags",
    state,
    onAttach(p) { player = p; },
    get(k) { return this.state[k]; },
    set(k, v) { this.state[k] = v; },
    has(k) { return k in this.state; },
    merge(patch) { Object.assign(this.state, patch); },
    all() { return this.state },
  };
}