// Shared game configuration types and helper factories

export type XPConfig = {
  baseXP: number;
  scaling: number;
  energyPerLevel: number;
  levelAnnouncements: number[];
  maxLevel?: number;
};

export type PricingConfig = {
  classPrices: Partial<Record<number, number>>;
  skill: {
    globalMultiplier?: number;
    overrides?: Partial<Record<number, number>>; // skill_id -> price
  };
};

export type XPGainRule = {
  fromLevel: number;          // threshold level (inclusive)
  multiplier?: number;        // multiply base XP gain
  flatBonus?: number;         // add flat XP to the result
};

export type LimitsConfig = {
  classMaxLevelDefault: number;
  classMaxLevelByClass: Partial<Record<number, number>>;
  skillMaxLevelDefault: number;
  skillMaxLevelBySkill: Partial<Record<number, number>>;
};

// Factory: resolve XP config by class id with default fallback
export function makeGetXPConfig(
  defaultXP: XPConfig,
  classXP: Partial<Record<number, XPConfig>>
) {
  return function getXPConfigFor(classId?: number): XPConfig {
    return (classId ? classXP[classId] : undefined) ?? defaultXP;
  };
}

// Factory: class max level resolver, considering per-class XPConfig.maxLevel and Limits
export function makeClassMaxLevel(
  limits: LimitsConfig,
  getXPConfigFor: (classId?: number) => XPConfig
) {
  return function classMaxLevel(classId?: number): number {
    const cfg = getXPConfigFor(classId);
    return cfg.maxLevel ?? limits.classMaxLevelByClass[(classId ?? -1)] ?? limits.classMaxLevelDefault;
  };
}

// Factory: skill max level resolver based on Limits only
export function makeSkillMaxLevel(limits: LimitsConfig) {
  return function skillMaxLevel(skillId?: number): number {
    return (skillId ? limits.skillMaxLevelBySkill[skillId] : undefined) ?? limits.skillMaxLevelDefault;
  };
}

// Factory: produce an XP gain adjuster from class rules
export function makeAdjustXPGain(
  rulesByClass: Partial<Record<number, XPGainRule[]>>
) {
  return function adjustXPGain(classId: number | undefined, currentLevel: number, baseGain: number): number {
    const rules = (classId ? rulesByClass[classId] : undefined) ?? [];
    if (!rules.length) return baseGain;
    const rule = [...rules]
      .sort((a, b) => b.fromLevel - a.fromLevel)
      .find((r) => currentLevel >= r.fromLevel);
    if (!rule) return baseGain;
    const mult = rule.multiplier ?? 1;
    const add = rule.flatBonus ?? 0;
    return Math.max(0, Math.floor(baseGain * mult + add));
  };
}

