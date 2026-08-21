import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";
import { SkillOutcome } from "../skills/Skill.types";
import { ModifierModule } from "./modifiers";

export type OutcomeChances = { positive: number; negative: number };
export type QualityBand = "fragile" | "unstable" | "steady" | "inspired";

export type QualityModifier = {
  add?: number;
  mult?: number;
  successAdd?: number;
  failAdd?: number;
  successMult?: number;
  failMult?: number;
  clampMin?: number;
  clampMax?: number;
  remainingShifts?: number;
  sourceId?: string;
};

export type QualityModule = PlayerModule & {
  key: "quality";
  state: { qualityScore: number };
  getQualityScore(): number;
  getNormalizedQuality(): number;
  getBand(): QualityBand;
  getBandLabel(): string;
  getPayoutMultiplier(): number;
  printQualityInfo(): string;
  getQuality(): number;
  setQualityScore(value: number): void;
  reduceQualityByHalf(): void;
  adjustQuality(amount: number): void;
  isQualityAbove(threshold: number): boolean;
  resetQuality(value?: number): void;
  qualityScoreToOutcomeSmooth(): OutcomeChances;
  triggerRandomOutcome(): "positive" | "negative" | "none";
  tickShift(): void;
  applyProductionDecay(shiftProduction: number): number;
};

export function createQualityModule(initialQuality = 60): QualityModule {
  let player: PlayerCore | undefined;
  const unsubscribers: Array<() => void> = [];
  let recoveryStreak = 0;
  let positiveGainTriggersThisShift = 0;

  const clampScore = (value: number) => Math.max(0, Math.min(100, value));
  const state = { qualityScore: clampScore(initialQuality) };

  const getModifiers = () => player?.tryGet<ModifierModule>("modifiers");
  const getEffectiveScore = () => clampScore(
    getModifiers()?.resolveNumber("quality.score", state.qualityScore, { playerId: player?.identity.id ?? -1 }) ?? state.qualityScore
  );
  const getBandData = (score: number): {
    band: QualityBand;
    label: string;
    payoutMultiplier: number;
    positive: number;
    negative: number;
  } => {
    if (score <= 25) {
      return { band: "fragile", label: "Fragile", payoutMultiplier: 0.9, positive: 35, negative: 65 };
    }
    if (score <= 50) {
      return { band: "unstable", label: "Unstable", payoutMultiplier: 1.0, positive: 45, negative: 55 };
    }
    if (score <= 75) {
      return { band: "steady", label: "Steady", payoutMultiplier: 1.05, positive: 60, negative: 40 };
    }
    return { band: "inspired", label: "Inspired", payoutMultiplier: 1.15, positive: 75, negative: 25 };
  };

  const logQualityChange = (delta: number, newValue: number, reason?: string) => {
    const name = player?.identity.nickname ?? player?.identity.name ?? "<unknown>";
    const suffix = reason ? ` reason=${reason}` : "";
    console.log(`[QUALITY] ${name} delta=${delta >= 0 ? "+" : ""}${delta} total=${newValue}${suffix}`);
  };
  const scalePositiveGain = (baseGain: number, scoreBefore: number): number => {
    if (baseGain <= 0) return baseGain;

    let gain = baseGain;
    if (positiveGainTriggersThisShift >= 3 && positiveGainTriggersThisShift < 6) {
      gain = Math.ceil(gain / 2);
    } else if (positiveGainTriggersThisShift >= 6) {
      gain = 0;
    }

    if (scoreBefore > 75) {
      gain = Math.ceil(gain / 2);
    }

    positiveGainTriggersThisShift += 1;
    return gain;
  };

  const mod: QualityModule = {
    key: "quality",
    state,
    onAttach(p) {
      player = p;
      const bus = player.ctx.bus;
      unsubscribers.push(bus.subscribe("player:skill.used", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId: number; outcome?: SkillOutcome; skillName?: string };
        if (payload?.playerId !== player.identity.id) return;
        const outcome = payload.outcome ?? "success";
        const scoreBefore = getEffectiveScore();
        const baseDelta = outcome === "fail" ? -4 : outcome === "critical" ? 4 : 2;
        const scaled = getModifiers()?.resolveNumber("quality.delta", baseDelta, {
          playerId: player.identity.id,
          actionType: "skillUse",
          skillName: payload.skillName,
          outcome,
        }) ?? baseDelta;
        if (outcome === "fail") {
          recoveryStreak = 0;
          mod.adjustQuality(scaled);
          return;
        }

        let comebackBonus = 0;
        if (scoreBefore < 30) {
          recoveryStreak += 1;
          comebackBonus = recoveryStreak >= 2 ? 3 : 2;
        } else {
          recoveryStreak = 0;
        }
        const totalGain = scalePositiveGain(scaled + comebackBonus, scoreBefore);
        mod.adjustQuality(totalGain);
      }));

      unsubscribers.push(bus.subscribe("player:climax.orgasm", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId?: number; bullState?: { ready?: boolean } };
        if (payload?.playerId !== player.identity.id) return;
        const ready = payload?.bullState?.ready ?? false;
        if (ready) {
          const scoreBefore = getEffectiveScore();
          const orgasmGain = scoreBefore > 75 ? 3 : 8;
          mod.adjustQuality(scalePositiveGain(orgasmGain, scoreBefore));
        } else {
          mod.reduceQualityByHalf();
        }
      }));

      unsubscribers.push(bus.subscribe("player:climax.resist", (evt: DomainEvent) => {
        if (!player) return;
        const payload = evt.payload as { playerId?: number };
        if (payload?.playerId !== player.identity.id) return;
        const scoreBefore = getEffectiveScore();
        mod.adjustQuality(scalePositiveGain(2, scoreBefore));
      }));
    },
    onDetach() {
      while (unsubscribers.length) {
        const unsubscribe = unsubscribers.pop();
        try { unsubscribe?.(); } catch { /* ignore */ }
      }
    },
    getQualityScore() { return getEffectiveScore(); },
    getNormalizedQuality() { return Math.round(getEffectiveScore()); },
    getBand() { return getBandData(getEffectiveScore()).band; },
    getBandLabel() { return getBandData(getEffectiveScore()).label; },
    getPayoutMultiplier() { return getBandData(getEffectiveScore()).payoutMultiplier; },
    printQualityInfo() {
      const score = mod.getNormalizedQuality();
      const bandData = getBandData(getEffectiveScore());
      return `(` +
        `Quality: ${score}%\n` +
        `Current band: ${bandData.label}\n` +
        `Bonuses:\n` +
        `- Shift payout multiplier: x${bandData.payoutMultiplier.toFixed(2)}\n` +
        `- Positive payout chance (+25% AC at shift end): ${bandData.positive}%\n` +
        `- Negative payout chance (no extra AC at shift end): ${bandData.negative}%\n` +
        `Bands:\n` +
        `- Fragile (0-25): x0.90 payout, 35% chance for +25% AC\n` +
        `- Unstable (26-50): x1.00 payout, 45% chance for +25% AC\n` +
        `- Steady (51-75): x1.05 payout, 60% chance for +25% AC\n` +
        `- Inspired (76-100): x1.15 payout, 75% chance for +25% AC\n` +
        `)`;
    },
    getQuality() { return mod.getPayoutMultiplier(); },
    setQualityScore(value: number) {
      const newScore = clampScore(value);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "setQualityScore");
    },
    reduceQualityByHalf() {
      const newScore = clampScore(state.qualityScore - 10);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      recoveryStreak = 0;
      logQualityChange(delta, state.qualityScore, "heavyFailure");
    },
    adjustQuality(amount: number) {
      const newScore = clampScore(state.qualityScore + amount);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "adjustQuality");
    },
    isQualityAbove(threshold: number) { return getEffectiveScore() > threshold; },
    resetQuality(value: number = 60) {
      recoveryStreak = 0;
      positiveGainTriggersThisShift = 0;
      const newScore = clampScore(value);
      const delta = newScore - state.qualityScore;
      state.qualityScore = newScore;
      logQualityChange(delta, state.qualityScore, "resetQuality");
    },
    qualityScoreToOutcomeSmooth(): OutcomeChances {
      const { positive, negative } = getBandData(getEffectiveScore());
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
    tickShift() {
      recoveryStreak = 0;
      positiveGainTriggersThisShift = 0;
      if (getEffectiveScore() > 80) {
        mod.adjustQuality(-2);
      }
    },
    applyProductionDecay(shiftProduction: number) {
      const prod = Math.max(0, shiftProduction);
      const decay = prod < 10 ? 0 : prod < 20 ? 2 : prod < 35 ? 4 : 6;
      if (decay > 0) mod.adjustQuality(-decay);
      if (player) {
        player.ctx.bus.publish({
          type: "facility:message.whisper",
          payload: {
            playerId: player.identity.id,
            text: decay > 0
              ? `(Quality strain: -${decay} from last shift production ${prod.toFixed(2)})`
              : `(Quality held steady after last shift production ${prod.toFixed(2)})`,
          },
        });
        console.log(`[QUALITY] Player ${player.identity.id} prod=${prod.toFixed(2)} decay=${decay}`);
      }
      return decay;
    },
  };

  return mod;
}
