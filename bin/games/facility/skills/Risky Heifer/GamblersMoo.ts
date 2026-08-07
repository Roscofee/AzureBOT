import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { FacilityConfig } from "../../config";
import { consumeHeiferRollEffect } from "./heiferRollState";

const MOO_TRIGGER = /(?:^|[^\p{L}\p{N}])moo+(?:ing|s)?(?=$|[^\p{L}\p{N}])/u;

export class GamblersMoo implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
    triggerTokens: string[] = ["moo", "mooing", "moos", "mooo", "moooo"];
    energyCost: number = 10;
    priority: number = 5;

    private criticalThresholdBase = 40;
    private criticalThresholdCap = 50;
    private failureThreshold = 80;
    private criticalMultiplier = 1.5;
    private failureMultiplier = 0.6;

    constructor(args: {
        skillId: number;
        skillName: string;
        skillLevel: number;
        description: string;
        upgrade_description: string;
    }) {
        this.skillId = args.skillId;
        this.skillName = args.skillName;
        this.skillLevel = args.skillLevel;
        this.description = args.description;
        this.upgrade_description = args.upgrade_description;
    }

    validInput(data: IncomingMessage): boolean {
        const validMessageType = this.validMessageTypes.includes(data.Type);
        const content = (data.Content ?? "").toLowerCase();
        const canTrigger = MOO_TRIGGER.test(content);
        return validMessageType && canTrigger;
    }

    canExecute(player: PlayerCore): boolean {
        return true;
    }

    use(player: PlayerCore): SkillResult {
        const baseReward = 2;
        const playerRoll = Math.floor(Math.random() * 100) + 1;
        const criticalThreshold = this.getCriticalThreshold();
        const heiferRoll = consumeHeiferRollEffect(player);
        const forcedCrit = heiferRoll === "autoCrit";
        const forcedFail = heiferRoll === "autoFail";
        const safeNoCrit = heiferRoll === "safeNoCrit";
        const isCritical = forcedCrit || (!safeNoCrit && playerRoll <= criticalThreshold);
        const isFailure = forcedFail || (!forcedCrit && !safeNoCrit && (playerRoll > this.failureThreshold || playerRoll === 100));
        const reward = isCritical
            ? baseReward * this.criticalMultiplier
            : isFailure
                ? baseReward * this.failureMultiplier
                : baseReward;
        const outcome = isCritical ? "critical" : isFailure ? "fail" : "success";

        const name = player.identity.nickname ?? player.identity.name;
        if (isCritical) {
            console.log(`${name} triggered GamblersMoo CRITICAL (${reward.toFixed(2)} milk, roll ${playerRoll}/${criticalThreshold}${forcedCrit ? ", forced" : ""})`);
        } else if (isFailure) {
            console.log(`${name} triggered GamblersMoo FAIL (${reward.toFixed(2)} milk, roll ${playerRoll}>${this.failureThreshold}${forcedFail ? ", forced" : ""})`);
        } else {
            console.log(`${name} triggered GamblersMoo NORMAL (${reward.toFixed(2)} milk, roll ${playerRoll}${safeNoCrit ? ", fail-safe" : ""})`);
        }

        return { energy: this.computeEnergy(player), reward, outcome };
    }

    private getCriticalThreshold(): number {
        const maxLevel = FacilityConfig.skillMaxLevel(this.skillId);
        if (maxLevel <= 1) return this.criticalThresholdCap;
        const progress = Math.min(1, Math.max(0, (this.skillLevel - 1) / (maxLevel - 1)));
        return Math.round(
            this.criticalThresholdBase
            + ((this.criticalThresholdCap - this.criticalThresholdBase) * progress),
        );
    }

    computeEnergy(player: PlayerCore): number {
        const classing = player.tryGet<any>("classing");
        const base = this.energyCost;
        if (!classing) return base;
        if (this.skillLevel > 1) {
            const extra = Math.floor((classing.state.maxEnergy ?? 0) * 0.10);
            return base + extra;
        }
        return base;
    }
}
