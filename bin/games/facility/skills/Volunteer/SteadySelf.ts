import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType, AnyModifier } from "../../../../domain/skills/Skill.types";
import { SkillsModule } from "../../../../domain/modules/skills";
import { FacilityEvents } from "../../config";

export class SteadySelf implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["steady", "self"];
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
        const patterns: RegExp[] = [
            /\b(steady|steadies|steadying|brace|braces|bracing|compose|composes|composing|center|centers|centering)\s+(himself|herself|themself|themselves)\b/,
            /\b(steady|steadies|steadying|brace|braces|bracing|compose|composes|composing|center|centers|centering)\s+(his|her|their)\s+(body|breathing|posture)\b/,
            /\b(regain|regains|regaining|recover|recovers|recovering)\s+(his|her|their)\s+(balance|composure|breathing)\b/,
        ];

        return patterns.some((p) => p.test(input));
    }

    canExecute(player: PlayerCore): boolean {
        if (this.usesLeft <= 0) return false;

        const skillsMod = player.tryGet<SkillsModule>("skills");
        if (!skillsMod) return false;

        const hasPendingSteadySelf = skillsMod.state.activeModifiers.some((m) =>
            m.usesRemaining != null &&
            m.usesRemaining > 0 &&
            m.energyCostMultiplier === this.energyReductionMultiplier &&
            m.skillWhitelist?.some((skillName) => this.boostedSkills.includes(skillName))
        );

        return !hasPendingSteadySelf;
    }

    use(player: PlayerCore): SkillResult {
        const skillsMod = player.tryGet<SkillsModule>("skills");
        if (!skillsMod) return { energy: this.energyCost, reward: 0, success: false };

        const steadyModifier: AnyModifier = {
            energyCostMultiplier: this.energyReductionMultiplier,
            skillWhitelist: this.boostedSkills,
            usesRemaining: 1,
        };

        skillsMod.state.activeModifiers.push(steadyModifier);
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
