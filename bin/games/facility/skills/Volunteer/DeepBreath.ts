import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { SkillsModule } from "../../../../domain/modules/skills";
import { GasIntake } from "./GasIntake";

export class DeepBreath implements Skill {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;

  validMessageTypes: ChatMessageType[] = ["Emote"];
  triggerTokens: string[] = ["deep", "deeply"]; // regex below handles full phrases
  energyCost: number = 20;
  priority: number = 5;

  private successRateDecreaseBase = 0.2; // applied as negative to success rate
  private rewardModifierBase = 1.1;

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
      /\b(take(s|n)?\s+(a\s+)?)?deep\s+breath(s)?\b/,
      /\b(inhale(s|d)?|inhales\s+deeply)\b/,
      /\b(exhale(s|d)?|exhales\s+deeply)\b/,
      /\b(breathe(s|d|ing)?\s+deep(ly)?)\b/,
      /\b(big|long|slow)\s+breath(s)?\b/
    ];
    return patterns.some((p) => p.test(input));
  }

  canExecute(player: PlayerCore): boolean {
    const skillsMod = player.tryGet<SkillsModule>("skills");
    if (!skillsMod) return false;
    const gas = skillsMod.list().find((s) => s instanceof GasIntake) as GasIntake | undefined;
    if (!gas) return false;
    if ((gas as any).gasNumb) return false;
    return true;
  }

  use(player: PlayerCore): SkillResult {
    const skillsMod = player.tryGet<SkillsModule>("skills");
    const name = player.identity.nickname ?? player.identity.name;
    if (!skillsMod) {
      console.log(`DEEPBREATH: ${name} skills module not found`);
      return { energy: this.energyCost, reward: 0 };
    }
    const gas = skillsMod.list().find((s) => s instanceof GasIntake) as GasIntake | undefined;
    if (!gas) {
      console.log(`DEEPBREATH: ${name} GasIntake skill not found`);
      return { energy: this.energyCost, reward: 0 };
    }

    const successRateDecrease = -this.successRateDecreaseBase; // e.g., -0.2
    const rewardModifier = this.rewardModifierBase + this.skillLevel * 0.1;

    console.log(
      `DEEPBREATH: ${name} setting GasIntake successRateModifier to ${successRateDecrease}`
    );
    gas.setSuccessRateModifier(successRateDecrease);

    console.log(
      `DEEPBREATH: ${name} setting GasIntake rewardModifier to ${rewardModifier}`
    );
    gas.setRewardModifier(rewardModifier);

    return { energy: this.energyCost, reward: 0 };
  }

  reset(): void {}
}

export {};

