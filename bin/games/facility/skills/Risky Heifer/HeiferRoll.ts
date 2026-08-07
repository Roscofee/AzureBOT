import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { ScoringModule } from "../../../../domain/modules/scoring";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { clearHeiferRollEffect, setHeiferRollEffect } from "./heiferRollState";

export class HeiferRoll implements Skill {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;

  validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
  triggerTokens: string[] = ["heiferroll", "roll"];
  energyCost = 40;
  priority = 6;

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
    return /\bheifer\s+roll\b|\broll\b/.test(input);
  }

  canExecute(player: PlayerCore): boolean {
    return true;
  }

  use(player: PlayerCore): SkillResult {
    const playerRoll = Math.floor(Math.random() * 4);
    const name = player.identity.nickname ?? player.identity.name;

    switch (playerRoll) {
      case 0:
        setHeiferRollEffect(player, "autoCrit");
        console.log(`HEIFERROLL: ${name} primed autoCrit`);
        return {
          energy: this.energyCost,
          reward: 0,
          feedback: ["(Heifer Roll primes your next GasIntake or GamblersMoo to automatically crit.)"],
        };
      case 1:
        setHeiferRollEffect(player, "autoFail");
        console.log(`HEIFERROLL: ${name} primed autoFail`);
        return {
          energy: this.energyCost,
          reward: 0,
          feedback: ["(Heifer Roll curses your next GasIntake or GamblersMoo to automatically fail.)"],
        };
      case 2:
        setHeiferRollEffect(player, "safeNoCrit");
        console.log(`HEIFERROLL: ${name} primed safeNoCrit`);
        return {
          energy: this.energyCost,
          reward: 0,
          feedback: ["(Heifer Roll steadies your next GasIntake or GamblersMoo: it cannot fail, but it cannot crit either.)"],
        };
      default: {
        clearHeiferRollEffect(player);
        const scoring = player.tryGet<ScoringModule>("scoring");
        const currentMilk = scoring?.totals().cycleScore ?? 0;
        const loss = currentMilk > 0 ? Math.ceil(currentMilk * 0.1) : 0;
        console.log(`HEIFERROLL: ${name} lost ${loss} current shift milk`);
        return {
          energy: this.energyCost,
          reward: -loss,
          outcome: "fail",
          feedback: loss > 0
            ? [`(Heifer Roll turns against you and burns ${loss} milk from your current shift haul.)`]
            : ["(Heifer Roll turns against you, but there is no current shift haul to burn.)"],
        };
      }
    }
  }
}
