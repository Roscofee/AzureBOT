import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { SongNoteColor } from "../../../../domain/modules/song";
import { songEngine } from "../../../../domain/services/facility/SongEngine";
import { SkillEffect } from "../../../../domain/skills/Skill.types";

export const MOONSTREL_MAX_LEVEL = 10;

export function scaledMoonstrelEnergy(player: PlayerCore, base: number, skillLevel: number): number {
    const classing = player.tryGet<any>("classing");
    if (!classing || skillLevel <= 1) return base;
    return base + Math.floor((classing.state.maxEnergy ?? 0) * 0.1);
}

export function smallFlatReward(base: number, skillLevel: number, perLevel: number = 0.2): number {
    return Number((base + Math.max(0, skillLevel - 1) * perLevel).toFixed(2));
}

export function currentEnergyPercentCost(player: PlayerCore, startPercent: number, endPercent: number, skillLevel: number, maxLevel: number = MOONSTREL_MAX_LEVEL): number {
    const classing = player.tryGet<any>("classing");
    const currentEnergy = classing?.state?.currentEnergy ?? 0;
    if (currentEnergy <= 0) return 0;
    const progress = maxLevel <= 1 ? 1 : Math.min(1, Math.max(0, (skillLevel - 1) / (maxLevel - 1)));
    const percent = startPercent - ((startPercent - endPercent) * progress);
    return Math.max(1, Math.ceil(currentEnergy * percent));
}

export function isMoonstrelMaxLevel(skillLevel: number, maxLevel: number = MOONSTREL_MAX_LEVEL): boolean {
    return skillLevel >= maxLevel;
}

export function performMoonstrelNotes(
    player: PlayerCore,
    skillName: string,
    colors: SongNoteColor[],
): { effects: SkillEffect[]; feedback: string[] } {
    const effects: SkillEffect[] = [];
    const feedback: string[] = [];

    for (const color of colors) {
        const phrase = songEngine.performPhrase(player, {
            color,
            skillName,
            power: 1,
        });
        effects.push(...phrase.effects);
        feedback.push(...phrase.feedback);
    }

    return { effects, feedback };
}
