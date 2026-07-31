import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { MomentumModule } from "../../../../domain/modules/momentum";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";

export class HeavyLift implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["heavy", "lift"];
    energyCost: number = 0;
    priority: number = 7;

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
        if (!validMessageType) return false;

        const input = (data.Content ?? "").toLowerCase();
        const patterns: RegExp[] = [
            /\bheavy\s+lift(s|ed|ing)?\b/,
            /\b(force|forces|forcing)\s+(up\s+)?(his|her|their|the)\s+(chest|breasts?)\s+hard\b/,
            /\bheave(s|d|ing)?\s+(up\s+)?(his|her|their|the)\s+(chest|breasts?)\b/,
        ];

        return patterns.some((p) => p.test(input));
    }

    canExecute(player: PlayerCore): boolean {
        const classing = player.tryGet<any>("classing");
        return !!classing && (classing.state.maxEnergy ?? 0) > 0;
    }

    use(player: PlayerCore): SkillResult {
        const momentum = player.tryGet<MomentumModule>("momentum");
        if (!momentum) return { energy: this.computeEnergy(player), reward: 0, outcome: "fail" };

        if (!momentum.has(3)) {
            return {
                energy: this.computeEnergy(player),
                reward: 0,
                outcome: "fail",
                feedback: [`${this.skillName} fails because you need at least 3 Momentum.`],
            };
        }

        momentum.spend(3);

        const baseIncrease = 16;
        const levelMultiplier = 1 + (0.10 * this.skillLevel);
        const scoreIncrease = baseIncrease * levelMultiplier;

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} triggered HeavyLift skill (increase ${scoreIncrease.toFixed(2)})`);

        return {
            energy: this.computeEnergy(player),
            reward: scoreIncrease,
            outcome: "success",
            feedback: [`${this.skillName} cashes out 3 Momentum for a powerful burst.`],
        };
    }

    computeEnergy(player: PlayerCore): number {
        const classing = player.tryGet<any>("classing");
        if (!classing) return this.energyCost;
        return Math.max(1, Math.floor((classing.state.maxEnergy ?? 0) * 0.65));
    }

    reset(): void {}
}
