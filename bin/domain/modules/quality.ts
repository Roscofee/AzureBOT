import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";

export type OutcomeChances = { positive: number; negative: number };

export type QualityModifier = {
  add?: number;               // flat add to quality score before clamping (used for effective score)
  mult?: number;              // multiplier to quality score (used for effective score)
  successAdd?: number;        // flat add applied to success deltas only
  failAdd?: number;           // flat add applied to fail deltas only
  successMult?: number;       // multiplier applied to success deltas only
  failMult?: number;          // multiplier applied to fail deltas only
  clampMin?: number;          // optional lower bound after modifiers
  clampMax?: number;          // optional upper bound after modifiers
  remainingShifts?: number;   // shift-based expiry
  sourceId?: string;          // origin identifier for removal (e.g., global event id)
};

export type QualityModule = PlayerModule & {
  key: "quality";
  state: { qualityScore: number };
  modifiers: QualityModifier[];
  getQualityScore(): number;
  getNormalizedQuality(): number;
  getQuality(): number;
  setQualityScore(value: number): void;
  reduceQualityByHalf(): void;
  adjustQuality(amount: number): void;
  isQualityAbove(threshold: number): boolean;
  resetQuality(value?: number): void;
  qualityScoreToOutcomeSmooth(): OutcomeChances;
  triggerRandomOutcome(): "positive" | "negative" | "none";
  applyModifier(mod: QualityModifier): void;
  tickShift(): void;
  applyProductionDecay(shiftProduction: number): number; // returns applied decay
};

export function createQualityModule(initialQuality = 50): QualityModule {
  let player: PlayerCore | undefined;
  const unsubscribers: Array<() => void> = [];

  const state = { qualityScore: Math.max(0, initialQuality) };
  const modifiers: QualityModifier[] = [];

  const getEffectiveScore = () => {
    const add = modifiers.reduce((acc, m) => acc + (m.add ?? 0), 0);
    const mult = modifiers.reduce((acc, m) => acc * (m.mult ?? 1), 1);
    const clampMin = Math.max(0, Math.max(...modifiers.map(m => m.clampMin ?? 0), 0));
    const clampMaxRaw = modifiers.map(m => m.clampMax).filter((v): v is number => v != null);
    const clampMax = clampMaxRaw.length ? Math.min(...clampMaxRaw) : Number.POSITIVE_INFINITY;

    const raw = (state.qualityScore + add) * mult;
    return Math.min(clampMax, Math.max(clampMin, raw));
  };

  const logQualityChange = (delta: number, newValue: number, reason?: string) => {
    const name = player?.identity.nickname ?? player?.identity.name ?? "<unknown>";
    const suffix = reason ? ` reason=${reason}` : "";
    console.log(`[QUALITY] ${name} delta=${delta >= 0 ? "+" : ""}${delta} total=${newValue}${suffix}`);
  };

  const mod: QualityModule = {
    key: "quality",
    state,
    modifiers,
    onAttach(p) {
      player = p;
      const bus = player.ctx.bus;
      unsubscribers.push(bus.subscribe("player:skill.used", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId: number; success?: boolean };
        if (payload?.playerId !== player.identity.id) return;
        const baseDelta = payload.success === false ? -5 : 5;
        const mult = modifiers.reduce((acc, m) => {
          const mval = baseDelta >= 0
            ? (m.successMult ?? m.mult ?? 1)
            : (m.failMult ?? m.mult ?? 1);
          return acc * mval;
        }, 1);
        const add = modifiers.reduce((acc, m) => {
          const aval = baseDelta >= 0
            ? (m.successAdd ?? m.add ?? 0)
            : (m.failAdd ?? m.add ?? 0);
          return acc + aval;
        }, 0);
        const scaled = Math.round(baseDelta * mult + add);
        mod.adjustQuality(scaled);
      }));


      unsubscribers.push(bus.subscribe("player:climax.orgasm", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId?: number; bullState?: { ready?: boolean } };
        if (payload?.playerId !== player.identity.id) return;
        const ready = payload?.bullState?.ready ?? false;
        if (ready) {
          mod.adjustQuality(50);
        } else {
          mod.reduceQualityByHalf();
        }
      }));


      unsubscribers.push(bus.subscribe("player:climax.resist", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId?: number };
        if (payload?.playerId !== player.identity.id) return;
        mod.adjustQuality(5);
      }));


      unsubscribers.push(bus.subscribe("quality:modifier", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId?: number | "*"; modifier: QualityModifier; action: "add" | "remove" | "extend"; shifts?: number };
        if (payload.playerId !== "*" && payload.playerId !== player.identity.id) return;
        if (payload.action === "add") {
          modifiers.push({ ...payload.modifier });
        } else if (payload.action === "extend" && payload.modifier.sourceId) {
          for (const modifier of modifiers) {
            if (modifier.sourceId === payload.modifier.sourceId) {
              modifier.remainingShifts = (modifier.remainingShifts ?? 0) + (payload.shifts ?? 1);
            }
          }
        } else if (payload.modifier.sourceId) {
          for (let i = modifiers.length - 1; i >= 0; i--) {
            if (modifiers[i].sourceId === payload.modifier.sourceId) modifiers.splice(i, 1);
          }
        }
      }));
    },
    onDetach() {
      while (unsubscribers.length) {
        const u = unsubscribers.pop();
        try { u?.(); } catch { /* ignore */ }
      }
    },
    
    getQualityScore() { return getEffectiveScore(); },
    
    getNormalizedQuality() { return Math.round(getEffectiveScore()); },
    
    getQuality() { return getEffectiveScore() / 100; },
    
    setQualityScore(value: number) {
      const newScore = Math.max(0, value);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "setQualityScore");
    },
    
    reduceQualityByHalf() {
      const newScore = Math.max(0, state.qualityScore / 2);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "reduceQualityByHalf");
    },
    
    adjustQuality(amount: number) {
      const newScore = Math.max(0, state.qualityScore + amount);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "adjustQuality");
    },
    
    isQualityAbove(threshold: number) { return getEffectiveScore() > threshold; },
    
    resetQuality(value: number = 100) {
      const newScore = Math.max(0, value);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "resetQuality");
    },
    
    qualityScoreToOutcomeSmooth(): OutcomeChances {
      const effective = getEffectiveScore();
      const steepness = 0.05;
      const midpoint = 75;
      const positive = 100 / (1 + Math.exp(-steepness * (effective - midpoint)));
      const negative = 100 - positive;
      return { positive, negative };
    },
    triggerRandomOutcome(): "positive" | "negative" | "none" {
      const { positive, negative } = mod.qualityScoreToOutcomeSmooth();
      const total = positive + negative;
      const posNorm = (positive / total) * 100;
      const negNorm = (negative / total) * 100;
      const roll = Math.random() * 100;
      if (roll < posNorm) return "positive";
      if (roll < posNorm + negNorm) return "negative";
      return "none";
    },
    applyModifier(m: QualityModifier) { modifiers.push(m); },
    tickShift() {
      for (const m of modifiers) {
        if (m.remainingShifts != null) m.remainingShifts -= 1;
      }
      for (let i = modifiers.length - 1; i >= 0; i--) {
        if (modifiers[i].remainingShifts != null && modifiers[i].remainingShifts <= 0) {
          modifiers.splice(i, 1);
        }
      }
    },
    applyProductionDecay(shiftProduction: number) {
      const prod = Math.max(0, shiftProduction);
      // Decay scales from 5 (minimum) up to 20 as production approaches 25
      // decay = clamp(5, 20, 5 + 15 * (prod / 25))
      const decay = Math.round(Math.min(20, Math.max(5, 5 + 15 * (prod / 25))));
      mod.adjustQuality(-decay);
      if (player) {
        player.ctx.bus.publish({
          type: "facility:message.whisper",
          payload: { playerId: player.identity.id, text: `(Quality decayed by ${decay} due to last shift production ${prod.toFixed(2)})` },
        });
        console.log(`[QUALITY] Player ${player.identity.id} prod=${prod.toFixed(2)} decay=${decay}`);
      }
      return decay;
    },
  };

  return mod;
}
