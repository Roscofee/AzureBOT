import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { ModifierModule } from "../../../../domain/modules/modifiers";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { FacilityEvents } from "../../config";
import { fromSkillModifier } from "../../modifierHelpers";

export class SteadySelf implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["steady", "self", "steadyself", "steady self"];
    energyCost: number = 20;
    priority: number = 10;

    private energyReductionMultiplier = 0.5;
    private boostedSkills = ["Moo", "LiftChest"];
    private usesLeft: number;

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
        this.usesLeft = this.maxUsesPerShift();
    }

    validInput(data: IncomingMessage): boolean {
        const validMessageType = this.validMessageTypes.includes(data.Type);
        if (!validMessageType) return false;

        const input = (data.Content ?? "").toLowerCase();
        const normalized = input.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
        const directInvocations = new Set(["steady", "steadyself", "steady self"]);
        if (directInvocations.has(normalized)) return true;

        const patterns: RegExp[] = [
            /\b(steady|steadies|steadying |compose|composes|composing|center|centers|centering)\s+(himself|herself|themself|themselves)\b/,
            /\b(steady|steadies|steadying |compose|composes|composing|center|centers|centering)\s+(his|her|their)\s+(body|breathing|posture)\b/,
            /\b(regain|regains|regaining|recover|recovers|recovering)\s+(his|her|their)\s+(balance|composure|breathing)\b/,
        ];

        return patterns.some((p) => p.test(normalized));
    }

    canExecute(player: PlayerCore): boolean {
        if (this.usesLeft <= 0) return false;

        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!modifiers) return false;
        return !modifiers.has({ sourceId: `skill:${this.skillName}` });
    }

    use(player: PlayerCore): SkillResult {
        const modifiers = player.tryGet<ModifierModule>("modifiers");
        if (!modifiers) return { energy: this.energyCost, reward: 0, outcome: "fail" };

        modifiers.addMany(fromSkillModifier({
            energyCostMultiplier: this.energyReductionMultiplier,
            skillWhitelist: this.boostedSkills,
            usesRemaining: 1,
        }, {
            id: `skill:${this.skillName}:${player.identity.id}`,
            sourceType: "skill",
            sourceId: `skill:${this.skillName}`,
            ownerPlayerId: player.identity.id,
        }));
        this.usesLeft -= 1;

        const name = player.identity.nickname ?? player.identity.name;
        console.log(`${name} primed SteadySelf for next milk skill (energy x${this.energyReductionMultiplier.toFixed(2)})`);
        player.ctx.bus.publish({
            type: FacilityEvents.message.whisper,
            payload: {
                playerId: player.identity.id,
                text: `(SteadySelf uses left this shift: ${this.usesLeft}/${this.maxUsesPerShift()})`,
            },
        });

        return {
            energy: this.energyCost,
            reward: 0,
        };
    }

    reset(): void {
        this.usesLeft = this.maxUsesPerShift();
    }

    private maxUsesPerShift(): number {
        return 1 + Math.floor(this.skillLevel / 3);
    }
}
