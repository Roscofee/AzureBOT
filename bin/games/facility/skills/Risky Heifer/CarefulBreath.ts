import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { SkillsModule } from "../../../../domain/modules/skills";
import { GasIntake } from "./GasIntake";

export class CarefulBreath implements Skill {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;

  validMessageTypes: ChatMessageType[] = ["Emote"];
  triggerTokens: string[] = ["carefully", "careful"]; // kept for reference; regex used below
  energyCost: number = 20;
  priority: number = 5;

  private successRateIncrementBase = 0.1;
  private rewardModifierBase = 0.6;

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
      /\b(careful(ly)?\s+breath(s|ing)?)\b[.,!?;:]?/,
      /\bcontrolled\s+breath(s|ing)?\b[.,!?;:]?/,
      /\bslow(ly)?\s+breath(s|ing)?\b[.,!?;:]?/,
      /\bsteady\s+breath(s|ing)?\b[.,!?;:]?/
    ];

    return patterns.some((p) => p.test(input));
  }

  canExecute(player: PlayerCore): boolean {
    const skillsMod = player.tryGet<SkillsModule>("skills");
    if (!skillsMod) return false;

    const gas = skillsMod.list().find((s) => s instanceof GasIntake) as GasIntake | undefined;
    if (!gas) return false;

    // Avoid attempting to help if GasIntake is currently numbed
    if ((gas as any).gasNumb) return false;

    return true;
  }

  use(player: PlayerCore): SkillResult {
    const skillsMod = player.tryGet<SkillsModule>("skills");
    const name = player.identity.nickname ?? player.identity.name;
    if (!skillsMod) {
      console.log(`CAREFULBREATH: ${name} skills module not found`);
      return { energy: this.energyCost, reward: 0 };
    }

    const gas = skillsMod.list().find((s) => s instanceof GasIntake) as GasIntake | undefined;
    if (!gas) {
      console.log(`CAREFULBREATH: ${name} GasIntake skill not found`);
      return { energy: this.energyCost, reward: 0 };
    }

    const successRateIncrement = this.skillLevel * this.successRateIncrementBase;
    const rewardModifier = this.rewardModifierBase - this.skillLevel * 0.1;

    console.log(
      `CAREFULBREATH: ${name} setting GasIntake successRateModifier to ${successRateIncrement}`
    );
    gas.setSuccessRateModifier(successRateIncrement);

    console.log(
      `CAREFULBREATH: ${name} setting GasIntake rewardModifier to ${rewardModifier}`
    );
    gas.setRewardModifier(rewardModifier);

    return { energy: this.energyCost, reward: 0 };
  }

  reset(): void {}
}

export {};

