import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";

export class GamblersMoo implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
    triggerTokens: string[] = ["moo", "mooing"];
    energyCost: number = 10;
    priority: number = 5;

    private criticalThresholdBase = 40;
    private failureThreshold = 80;
    private criticalMultiplier = 2;
    private failureMultiplier = 0.5;

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
        const canTrigger = this.triggerTokens.some((token) => content.includes(token));
        return validMessageType && canTrigger;
    }

    canExecute(player: PlayerCore): boolean {
        return true;
    }

    use(player: PlayerCore): SkillResult {
        const baseIncrease = 3;
        const levelMultiplier = 1 + (0.1 * this.skillLevel);
        const baseReward = baseIncrease * levelMultiplier;
        const playerRoll = Math.floor(Math.random() * 100) + 1;
        const criticalThreshold = Math.min(this.criticalThresholdBase + this.skillLevel, this.failureThreshold);
        const isCritical = playerRoll <= criticalThreshold;
        const isFailure = playerRoll > this.failureThreshold || playerRoll === 100;
        const reward = isCritical
            ? baseReward * this.criticalMultiplier
            : isFailure
                ? baseReward * this.failureMultiplier
                : baseReward;

        const name = player.identity.nickname ?? player.identity.name;
        if (isCritical) {
            console.log(`${name} triggered GamblersMoo CRITICAL (${reward.toFixed(2)} milk, roll ${playerRoll}/${criticalThreshold})`);
        } else if (isFailure) {
            console.log(`${name} triggered GamblersMoo FAIL (${reward.toFixed(2)} milk, roll ${playerRoll}>${this.failureThreshold})`);
        } else {
            console.log(`${name} triggered GamblersMoo NORMAL (${reward.toFixed(2)} milk, roll ${playerRoll})`);
        }

        return { energy: this.computeEnergy(player), reward };
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
