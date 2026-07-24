import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { ModifierModule } from "../../../../domain/modules/modifiers";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { fromSkillModifier } from "../../modifierHelpers";
import { isMoonstrelMaxLevel, performMoonstrelNotes, scaledMoonstrelEnergy, smallFlatReward } from "./_shared";
import { matchesAnyTriggerToken } from "../triggerMatching";

const RESTORED_ENCORE_SOURCE = "skill:RestoringVerse:EncoreDiscount";

export class RestoringVerse implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["restore", "restoring", "restoringverse", "restoring verse"];
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

    canExecute(player: PlayerCore): boolean {
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!modifiers || !isMoonstrelMaxLevel(this.skillLevel)) return true;
        return !modifiers.has({ sourceId: RESTORED_ENCORE_SOURCE });
    }

    computeEnergy(player: PlayerCore): number {
        return scaledMoonstrelEnergy(player, this.energyCost, this.skillLevel);
    }

    use(player: PlayerCore): SkillResult {
        const reward = smallFlatReward(3.5, this.skillLevel);
        const phrase = performMoonstrelNotes(player, this.skillName, ["green"]);
        const feedback = [...(phrase.feedback ?? [])];
        if (isMoonstrelMaxLevel(this.skillLevel)) {
            const modifiers = player.tryGet<ModifierModule>("modifiers");
            modifiers?.addMany(fromSkillModifier({
                energyCostMultiplier: 0.7,
                skillWhitelist: ["Encore"],
                usesRemaining: 1,
            }, {
                id: `${RESTORED_ENCORE_SOURCE}:${player.identity.id}`,
                sourceType: "skill",
                sourceId: RESTORED_ENCORE_SOURCE,
                ownerPlayerId: player.identity.id,
            }));
            feedback.push(`${this.skillName} reduces the cost of your next Encore by 30%.`);
        }
        return { energy: this.computeEnergy(player), reward, effects: phrase.effects, feedback };
    }
}
