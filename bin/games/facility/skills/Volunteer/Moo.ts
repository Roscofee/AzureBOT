import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";


export class Moo implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
    triggerTokens: string[] = ["moo", "mooing", "moo"];
    energyCost: number = 10;
    priority: number = 5;

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
        const canTrigger = content.includes(this.triggerTokens[0]);
        return validMessageType && canTrigger;
    }

    canExecute(player: PlayerCore): boolean {
        // Keep simple in current engine: energy cost is constant (engine checks availability)
        // If you want dynamic cost by level, engine computes energy before this call.
        return true;
    }

    use(player: PlayerCore): SkillResult {
        const baseIncrease = 3;
        const levelMultiplier = 1 + (0.1 * this.skillLevel);
        const scoreIncrease = baseIncrease * levelMultiplier;

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} triggered Moo skill (increase ${scoreIncrease.toFixed(2)})`);

        // Engine uses computeEnergy() for energy; return here for completeness
        return { energy: this.computeEnergy(player), reward: scoreIncrease };
    }

    computeEnergy(player: PlayerCore): number {
        // Dynamic cost: base 10; if level > 1, add 10% of max energy
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
