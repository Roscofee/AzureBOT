import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType, AnyModifier } from "../../../../domain/skills/Skill.types";
import { SkillsModule } from "../../../../domain/modules/skills";

export class Focus implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
    triggerTokens: string[] = ["focus", "focused", "focuses", "concentrates", "concentrating"];
    energyCost: number = 40;
    priority: number = 10;

    private rewardBoostBase = 0.39;
    private rewardBoostPerLevel = 0.01;
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
        const canTrigger = this.triggerTokens.some((token) => content.includes(token));
        return validMessageType && canTrigger;
    }

    canExecute(player: PlayerCore): boolean {
        const skillsMod = player.tryGet<SkillsModule>("skills");
        if (!skillsMod) return false;

        const hasPendingFocus = skillsMod.state.activeModifiers.some((m) =>
            m.usesRemaining != null &&
            m.usesRemaining > 0 &&
            m.rewardMultiplier != null &&
            m.skillWhitelist?.some((skillName) => this.boostedSkills.includes(skillName))
        );

        return !hasPendingFocus;
    }

    use(player: PlayerCore): SkillResult {
        const skillsMod = player.tryGet<SkillsModule>("skills");
        if (!skillsMod) return { energy: this.energyCost, reward: 0, success: true };

        const rewardBoost = this.rewardBoostBase + (this.rewardBoostPerLevel * this.skillLevel);
        const rewardMultiplier = 1 + rewardBoost;
        const focusModifier: AnyModifier = {
            rewardMultiplier,
            skillWhitelist: this.boostedSkills,
            usesRemaining: 1,
        };

        skillsMod.state.activeModifiers.push(focusModifier);

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} primed Focus for next milk skill (+${Math.round(rewardBoost * 100)}%)`);

        return {
            energy: this.energyCost,
            reward: 0,
        };
    }

    reset(): void {}
}
