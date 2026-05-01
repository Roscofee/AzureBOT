import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { isMoonstrelMaxLevel, performMoonstrelNotes, scaledMoonstrelEnergy, smallFlatReward } from "./_shared";

export class MelodicMoo implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["moo", "mooing", "moo"];
    energyCost = 10;
    priority = 5;

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
        return scaledMoonstrelEnergy(player, this.energyCost, this.skillLevel);
    }

    use(player: PlayerCore): SkillResult {
        const reward = smallFlatReward(3, this.skillLevel);
        const phrase = performMoonstrelNotes(player, this.skillName, [isMoonstrelMaxLevel(this.skillLevel) ? "purple" : "white"]);
        return { energy: this.computeEnergy(player), reward, effects: phrase.effects, feedback: phrase.feedback };
    }
}
