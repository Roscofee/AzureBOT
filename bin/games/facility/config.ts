import {
  XPConfig,
  PricingConfig,
  XPGainRule,
  LimitsConfig,
  makeGetXPConfig,
  makeClassMaxLevel,
  makeSkillMaxLevel,
  makeAdjustXPGain,
} from "../../domain/core/game-config";
import { AnyModifier } from "../../domain/skills/Skill.types";

export type StatDelta = {
        target: "energy" | "xp" | "economy" | "score" | "production" | "custom";
        op: "add" | "mult";
        value: number;
        remainingShifts: number;
        sourceId?: string;
    };

export type SkillModEntry = {
        skillName?: string;           // optional: limit to one skill; omit to apply to all
        modifier: AnyModifier;
        remainingShifts: number;
        sourceId?: string;
};

export enum FacilityClassId {
  Volunteer = 1,
  Gambler = 2,
  Moonstrel = 3,
}

export const FacilityClasses = {
  Volunteer: { id: FacilityClassId.Volunteer, name: "Volunteer" },
  RiskyHeifer: { id: FacilityClassId.Gambler, name: "Risky Heifer" },
  Moonstrel: { id: FacilityClassId.Moonstrel, name: "Moonstrel" },
} as const;

export const acceptedClassNames: string[] = Object.values(FacilityClasses).map((c) => c.name);

export const defaultXP: XPConfig = {
  baseXP: 100,
  scaling: 1.5,
  energyPerLevel: 10,
  levelAnnouncements: [25, 50, 100],
};

export const classXP: Partial<Record<number, XPConfig>> = {
  //[FacilityClassId.Volunteer]: { baseXP: 90, scaling: 1.45, energyPerLevel: 12, levelAnnouncements: [20, 40, 60, 80, 100]}
};

export const getXPConfigFor = makeGetXPConfig(defaultXP, classXP);

// -------- Level Limits (Classes and Skills) --------
export const Limits: LimitsConfig = {
  // Default maximum class level if not overridden per class
  classMaxLevelDefault: 100,
  // Optional per-class overrides
  classMaxLevelByClass: {
    //[FacilityClassId.Volunteer]: 100,
  } as Partial<Record<number, number>>,

  // Default maximum skill level (used by upgrade flows)
  skillMaxLevelDefault: 10,
  // Optional per-skill overrides (keyed by skill_id)
  skillMaxLevelBySkill: {
     8: 8,
     2: 6,
     14: 1,
  } as Partial<Record<number, number>>,
};
export const classMaxLevel = makeClassMaxLevel(Limits, getXPConfigFor);
export const skillMaxLevel = makeSkillMaxLevel(Limits);

// -------- XP Gain Adjustments (by thresholds) --------
// Allows changing how much XP is awarded past certain levels for each class.
// Example: reduce XP gain to 75% after level 50, and to 50% after level 80.
export const xpGainRulesByClass: Partial<Record<number, XPGainRule[]>> = {
  [FacilityClassId.Volunteer]: [
    { fromLevel: 50, multiplier: 0.75 },
    { fromLevel: 80, multiplier: 0.5 },
  ],
};
export const adjustXPGain = makeAdjustXPGain(xpGainRulesByClass);

export const pricing: PricingConfig = {
  classPrices: {
    [FacilityClassId.Volunteer]: 0,
    [FacilityClassId.Gambler]: 1000,
    [FacilityClassId.Moonstrel]: 2500,
  },
  skill: {
    globalMultiplier: 1.0,
    overrides: {},
  },
};

export const starterSkillsByClass: Partial<Record<number, number[]>> = {
  [FacilityClassId.Volunteer]: [1],
  [FacilityClassId.Gambler]: [5],
  [FacilityClassId.Moonstrel]: [9, 14],
};

export const FacilityConfig = {
  acceptedClassNames,
  getXPConfigFor,
  classMaxLevel,
  skillMaxLevel,
  adjustXPGain,
  Limits,
  xpGainRulesByClass,
  pricing,
  starterSkillsByClass,
  defaultXP,
};

// ---- Game-specific domain event topics (publish/subscribe) ----
export const FacilityEvents = {
  message: {
    whisper: "facility:message.whisper" as const,
    broadcast: "facility:message.broadcast" as const,
  },
  scoring: {
    addCycle: "facility:scoring.cycle.add" as const,
    commitShift: "facility:scoring.shift.commit" as const,
  },
  shift: {
    adjustRecovery: "facility:shift.adjustRecovery" as const,
    extendRecovery: "facility:shift.adjustRecovery.extend" as const,
    tick: "facility:shift.tick" as const,
  },
  global: {
    extendStatDelta: "facility:global.statDelta.extend" as const,
    extendSkillModifier: "facility:global.skillModifier.extend" as const,
  },
} as const;
