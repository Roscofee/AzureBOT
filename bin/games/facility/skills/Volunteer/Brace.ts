import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { ModifierModule } from "../../../../domain/modules/modifiers";
import { MomentumModule } from "../../../../domain/modules/momentum";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { fromSkillModifier } from "../../modifierHelpers";

const BRACE_SOURCE_ID = "skill:Brace";

export class Brace implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["brace", "braces", "bracing"];
    energyCost: number = 15;
    priority: number = 10;

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
            /\bbrace(s|d|ing)?\b/,
            /\b(plant|plants|planted|planting)\s+(herself|himself|themself|themselves)\b/,
            /\b(steady|steadies|steadying)\s+(stance|posture)\b/,
        ];

        return patterns.some((p) => p.test(input));
    }

    canExecute(player: PlayerCore): boolean {
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!modifiers) return false;
        return !modifiers.has({ sourceId: BRACE_SOURCE_ID });
    }

    use(player: PlayerCore): SkillResult {
        const momentum = player.tryGet<MomentumModule>("momentum");
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!momentum || !modifiers) return { energy: this.energyCost, reward: 0, outcome: "fail" };

        if (!momentum.has(2)) {
            return {
                energy: this.energyCost,
                reward: 0,
                outcome: "fail",
                feedback: [`${this.skillName} fails because you need at least 2 Momentum.`],
            };
        }

        momentum.spend(2);

        const rewardMultiplier = 2 + (0.05 * this.skillLevel);
        modifiers.addMany(fromSkillModifier({
            rewardMultiplier,
            skillWhitelist: ["Moo"],
            usesRemaining: 1,
        }, {
            id: `${BRACE_SOURCE_ID}:${player.identity.id}`,
            sourceType: "skill",
            sourceId: BRACE_SOURCE_ID,
            ownerPlayerId: player.identity.id,
        }));

        return {
            energy: this.energyCost,
            reward: 0,
            feedback: [`${this.skillName} primes your next Moo for a critical payout.`],
        };
    }

    reset(): void {}
}
