import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";

export class LiftChest implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["lift", "chest"];
    energyCost: number = 0;
    priority: number = 6;

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
            /\b(lift|lifts|lifting|raise|raises|raising|thrust|thrusts|thrusting|puff|puffs|puffing)\s+(up\s+)?(his|her|their)\s+(chest|breasts?)\b/,
            /\b(lift|lifts|lifting|raise|raises|raising|thrust|thrusts|thrusting|puff|puffs|puffing)\s+(up\s+)?(the)\s+(chest|breasts?)\b/,
            /\b(push|pushes|pushing)\s+(his|her|their)\s+(chest|breasts?)\s+(out|forward)\b/,
            /\b(push|pushes|pushing)\s+(the)\s+(chest|breasts?)\s+(out|forward)\b/,
        ];

        return patterns.some((p) => p.test(input));
    }

    canExecute(player: PlayerCore): boolean {
        const classing = player.tryGet<any>("classing");
        return !!classing && (classing.state.maxEnergy ?? 0) > 0;
    }

    use(player: PlayerCore): SkillResult {
        const baseIncrease = 8;
        const levelMultiplier = 1 + (0.1 * this.skillLevel);
        const scoreIncrease = baseIncrease * levelMultiplier;

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} triggered LiftChest skill (increase ${scoreIncrease.toFixed(2)})`);

        return { energy: this.computeEnergy(player), reward: scoreIncrease };
    }

    computeEnergy(player: PlayerCore): number {
        const classing = player.tryGet<any>("classing");
        if (!classing) return this.energyCost;
        return Math.max(1, Math.floor((classing.state.maxEnergy ?? 0) / 2));
    }
}

