import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { MomentumModule } from "../../../../domain/modules/momentum";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";

export class SecondWind implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["second", "wind", "SecondWind", "second wind"];
    energyCost: number = 0;
    priority: number = 9;

    private usedThisShift = false;

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
            /\bsecond\s+wind\b/,
            /\bfind(s|ing)?\s+(a\s+)?second\s+wind\b/,
            /\bcatch(es|ing)?\s+(a\s+)?second\s+wind\b/,
            /\brecover(s|ed|ing)?\s+(their|her|his)\s+wind\b/,
        ];

        return patterns.some((p) => p.test(input));
    }

    canExecute(player: PlayerCore): boolean {
        const classing = player.tryGet<any>("classing");
        return !!classing && (classing.state.maxEnergy ?? 0) > 0;
    }

    use(player: PlayerCore): SkillResult {
        const momentum = player.tryGet<MomentumModule>("momentum");
        const classing = player.tryGet<any>("classing");
        if (!momentum || !classing) return { energy: this.energyCost, reward: 0, outcome: "fail" };

        if (this.usedThisShift) {
            return {
                energy: this.energyCost,
                reward: 0,
                outcome: "fail",
                feedback: [`${this.skillName} has already been used this shift.`],
            };
        }

        const availableMomentum = momentum.state.stacks;
        if (availableMomentum <= 0) {
            return {
                energy: this.energyCost,
                reward: 0,
                outcome: "fail",
                feedback: [`${this.skillName} fails because you do not have any Momentum.`],
            };
        }

        const spent = momentum.spend(availableMomentum);
        const recoveryPerCharge = Math.floor((classing.state.maxEnergy ?? 0) * 0.10);
        const totalRecovery = spent * recoveryPerCharge;
        classing.state.currentEnergy = Math.min(
            classing.state.maxEnergy ?? classing.state.currentEnergy,
            classing.state.currentEnergy + totalRecovery,
        );
        this.usedThisShift = true;

        return {
            energy: this.energyCost,
            reward: 0,
            outcome: "success",
            feedback: [`${this.skillName} spends ${spent} Momentum and restores ${totalRecovery} energy.`],
        };
    }

    reset(): void {
        this.usedThisShift = false;
    }
}
