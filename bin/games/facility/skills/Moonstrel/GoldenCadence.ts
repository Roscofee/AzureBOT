import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { currentEnergyPercentCost, performMoonstrelNotes } from "./_shared";

export class GoldenCadence implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["crown", "goldencadence", "golden cadence"];
    energyCost = 0;
    priority = 7;

    constructor(args: { skillId: number; skillName: string; skillLevel: number; description: string; upgrade_description: string; }) {
        this.skillId = args.skillId;
        this.skillName = args.skillName;
        this.skillLevel = args.skillLevel;
        this.description = args.description;
        this.upgrade_description = args.upgrade_description;
    }

    validInput(data: IncomingMessage): boolean {
        const content = (data.Content ?? "").toLowerCase();
        return this.validMessageTypes.includes(data.Type) && this.triggerTokens.some((token) => content.includes(token));
    }

    canExecute(player: PlayerCore): boolean { return true; }

    computeEnergy(player: PlayerCore): number {
        return currentEnergyPercentCost(player, 0.9, 0.7, this.skillLevel);
    }

    use(player: PlayerCore): SkillResult {
        const phrase = performMoonstrelNotes(player, this.skillName, ["gold"]);
        return { energy: this.computeEnergy(player), reward: 0, effects: phrase.effects, feedback: phrase.feedback };
    }
}
