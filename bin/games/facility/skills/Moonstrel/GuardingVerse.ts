import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { isMoonstrelMaxLevel, performMoonstrelNotes, scaledMoonstrelEnergy, smallFlatReward } from "./_shared";
import { matchesAnyTriggerToken } from "../triggerMatching";

export class GuardingVerse implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["guard", "guardingverse", "guarding verse"];
    energyCost = 20;
    priority = 6;

    constructor(args: { skillId: number; skillName: string; skillLevel: number; description: string; upgrade_description: string; }) {
        this.skillId = args.skillId;
        this.skillName = args.skillName;
        this.skillLevel = args.skillLevel;
        this.description = args.description;
        this.upgrade_description = args.upgrade_description;
    }

    validInput(data: IncomingMessage): boolean {
        const content = (data.Content ?? "").toLowerCase();
        return this.validMessageTypes.includes(data.Type) && matchesAnyTriggerToken(content, this.triggerTokens);
    }

    canExecute(player: PlayerCore): boolean { return true; }

    computeEnergy(player: PlayerCore): number {
        return scaledMoonstrelEnergy(player, this.energyCost, this.skillLevel);
    }

    use(player: PlayerCore): SkillResult {
        const reward = smallFlatReward(3.5, this.skillLevel);
        const colors = isMoonstrelMaxLevel(this.skillLevel) ? ["lightBlue", "gold"] as const : ["lightBlue"] as const;
        const phrase = performMoonstrelNotes(player, this.skillName, [...colors]);
        return { energy: this.computeEnergy(player), reward, effects: phrase.effects, feedback: phrase.feedback };
    }
}
