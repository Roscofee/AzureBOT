import { PlayerCore } from "../../../../domain/core/PlayerCore";

export type HeiferRollEffect =
  | "autoCrit"
  | "autoFail"
  | "safeNoCrit";

type HeiferRollState = {
  nextEffect?: HeiferRollEffect;
};

const stateByPlayerId = new Map<number, HeiferRollState>();

function ensureState(player: PlayerCore): HeiferRollState {
  const existing = stateByPlayerId.get(player.identity.id);
  if (existing) return existing;
  const created: HeiferRollState = {};
  stateByPlayerId.set(player.identity.id, created);
  return created;
}

export function setHeiferRollEffect(player: PlayerCore, effect: HeiferRollEffect): void {
  ensureState(player).nextEffect = effect;
}

export function consumeHeiferRollEffect(player: PlayerCore): HeiferRollEffect | undefined {
  const state = ensureState(player);
  const effect = state.nextEffect;
  state.nextEffect = undefined;
  return effect;
}

export function clearHeiferRollEffect(player: PlayerCore): void {
  ensureState(player).nextEffect = undefined;
}
