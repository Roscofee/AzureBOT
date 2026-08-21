import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { ModifierModule } from "../../../../domain/modules/modifiers";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { fromSkillModifier } from "../../modifierHelpers";
import { matchesAnyTriggerToken } from "../triggerMatching";

export class Focus implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["focus", "focused", "focuses", "concentrates", "concentrating"];
    energyCost: number = 10;
    priority: number = 10;

    private rewardBoostBase = 0.14;
    private rewardBoostPerLevel = 0.02;
    private boostedSkills = ["Moo", "LiftChest"];

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
        const canTrigger = matchesAnyTriggerToken(content, this.triggerTokens);
        return validMessageType && canTrigger;
    }

    canExecute(player: PlayerCore): boolean {
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!modifiers) return false;
        return !modifiers.has({ sourceId: `skill:${this.skillName}` });
    }

    use(player: PlayerCore): SkillResult {
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        const energy = this.computeEnergy(player);
        if (!modifiers) return { energy, reward: 0 };

        const rewardBoost = this.rewardBoostBase + (this.rewardBoostPerLevel * this.skillLevel);
        const rewardMultiplier = 1 + rewardBoost;
        modifiers.addMany(fromSkillModifier({
            rewardMultiplier,
            skillWhitelist: this.boostedSkills,
            usesRemaining: 1,
        }, {
            id: `skill:${this.skillName}:${player.identity.id}`,
            sourceType: "skill",
            sourceId: `skill:${this.skillName}`,
            ownerPlayerId: player.identity.id,
        }));

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} primed Focus for next milk skill (+${Math.round(rewardBoost * 100)}%)`);

        return {
            energy,
            reward: 0,
            feedback: [`${this.skillName} empowers your next milk skill by ${Math.round(rewardBoost * 100)}%.`],
        };
    }

    computeEnergy(player: PlayerCore): number {
        const classing = player.tryGet<any>("classing");
        if (!classing) return this.energyCost;

        const maxEnergy = classing.state.maxEnergy ?? 0;
        const scalingCost = Math.floor(maxEnergy * 0.1);
        return this.energyCost + scalingCost;
    }

    reset(): void {}
}
