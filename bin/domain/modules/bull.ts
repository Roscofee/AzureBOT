import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { BullState, BullModifier } from "../moduleTypes/Bull.types";

export type BullModule = PlayerModule & {
  key: "bull";
  state: BullState;
  modifiers: BullModifier[];
  addCharge(amount: number): { progressed: number; becameReady: boolean };
  fail(): { fromReady: boolean; progressed: number };
  consume(): { consumed: boolean };
  applyModifier(mod: BullModifier): void;
  tickShift(): void;
  getState(): BullState;
};

export function createBullModule(): BullModule {
  let player: PlayerCore | undefined;

  const state: BullState = {
    level: 1,
    energy: 0,
    threshold: 100,
    ready: false,
    step: 25,
    cooldownShifts: 0,
  };

  const modifiers: BullModifier[] = [];

  function energyCap() {
    return state.threshold + modifiers.reduce((acc, m) => acc + (m.energyMaxBonus ?? 0), 0);
  }

  function addCharge(amount: number): { progressed: number; becameReady: boolean } {
    if (state.cooldownShifts && state.cooldownShifts > 0) return { progressed: 0, becameReady: false };
    if (state.ready) return { progressed: 0, becameReady: false };
    const mult = modifiers.reduce((acc, m) => acc * (m.chargeMultiplier ?? 1), 1);
    const delta = Math.max(0, Math.floor(amount * mult));
    if (delta === 0) return { progressed: 0, becameReady: false };
    state.energy = Math.min(energyCap(), state.energy + delta);
    const becameReady = state.energy >= energyCap();
    if (becameReady) state.ready = true;
    return { progressed: delta, becameReady };
  }

  function fail(): { fromReady: boolean; progressed: number } {
    const stepMult = modifiers.reduce((acc, m) => acc * (m.stepMultiplier ?? 1), 1);
    const step = Math.max(1, Math.floor(state.step * stepMult));
    let fromReady = false;
    if (state.ready) {
      state.energy = Math.max(0, state.threshold - step);
      state.ready = false;
      fromReady = true;
    } else {
      state.energy = Math.max(0, state.energy - step);
    }
    return { fromReady, progressed: step };
  }

  function consume(): { consumed: boolean } {
    if (!state.ready) return { consumed: false };
    state.energy = 0;
    state.ready = false;
    return { consumed: true };
  }

  function applyModifier(mod: BullModifier) {
    modifiers.push(mod);
  }

  function tickShift() {
    if (state.cooldownShifts && state.cooldownShifts > 0) state.cooldownShifts -= 1;
    for (const m of modifiers) {
      if (m.remainingShifts != null) m.remainingShifts -= 1;
    }
    for (let i = modifiers.length - 1; i >= 0; i--) {
      if (modifiers[i].remainingShifts != null && modifiers[i].remainingShifts <= 0) {
        modifiers.splice(i, 1);
      }
    }
  }

  const mod: BullModule = {
    key: "bull",
    state,
    modifiers,
    onAttach(p) { player = p; },
    addCharge,
    fail,
    consume,
    applyModifier,
    tickShift,
    getState() {
      return { ...state };
    },
  };

  return mod;
}
