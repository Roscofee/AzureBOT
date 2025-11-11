import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { DomainEvent } from "../../../../domain/ports/DomainEvenPort";
import { FacilityEvents } from "../../config";
import { dialog } from "../../../../dialog/dialog";

export class GasIntake implements Skill {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;

  validMessageTypes: ChatMessageType[] = ["Emote"];
  triggerTokens: string[] = [
    "breathes",
    "breaths",
    "inhales",
    "wiffs",
    "wiff",
    "inhale",
    "breath",
  ];
  energyCost: number = 0;
  priority: number = 1;

  private gasNumb = false;
  private roundSuccesses = 0;
  private baseSuccess: number;
  private currentSuccess: number;
  private decayRate: number = 0.2; // 20 percentage points
  private rewardModifier: number = 1;
  private successRateModifier: number = 0;
  private scoreIncrease: number = 1;
  private failureMessage?: string;

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

    this.baseSuccess = Math.min(0.2 + 0.1 * this.skillLevel, 1);
    this.currentSuccess = this.baseSuccess;
    this.failureMessage = dialog.numbness.gasNumb;
  }

  setRewardModifier(rewardModifier: number) {
    this.rewardModifier = rewardModifier;
  }

  setSuccessRateModifier(successRateModifier: number) {
    this.successRateModifier = successRateModifier;
  }

  validInput(data: IncomingMessage): boolean {
    const validMessageType = this.validMessageTypes.includes(data.Type);
    const inputWords = (data.Content ?? "")
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ""))
      .filter((word) => word.length > 0);
    const canTrigger = this.triggerTokens.some((token) => inputWords.includes(token));
    return validMessageType && canTrigger;
  }

  canExecute(player: PlayerCore): boolean {
    if (this.gasNumb) {
      const name = player.identity.nickname ?? player.identity.name;
      console.log(`GASINTAKE: ${name} gasNumb true`);
      if (this.failureMessage) {
        const evt: DomainEvent = {
          type: FacilityEvents.message.whisper,
          payload: { playerId: player.identity.id, text: this.failureMessage },
        };
        player.ctx.bus.publish(evt);
      }
      return false;
    }
    return true;
  }

  use(player: PlayerCore): SkillResult {
    // d100 roll, inclusive 1..100
    const playerRoll = Math.floor(Math.random() * 100) + 1;

    const currentSucessRate = this.currentSuccess + this.successRateModifier;
    const normalizedSuccessRate = Math.round(currentSucessRate * 100);

    const name = player.identity.nickname ?? player.identity.name;
    console.log(`GASINTAKE: ${name} roll number ${this.roundSuccesses}, value ${playerRoll}`);
    console.log(`GASINTAKE: ${name} round base success chance ${this.currentSuccess}`);
    console.log(`GASINTAKE: ${name} success modifier ${this.successRateModifier}`);
    console.log(`GASINTAKE: ${name} current success chance ${currentSucessRate}`);
    console.log(`GASINTAKE: ${name} normalized final success chance ${normalizedSuccessRate}`);

    if (playerRoll <= normalizedSuccessRate) {
      console.log(`GASINTAKE: ${name} roll [${playerRoll}] success with threshold ${currentSucessRate}`);

      this.roundSuccesses++;

      const intervalReward = this.calculateReward();
      this.scoreIncrease += intervalReward * this.rewardModifier;
      this.reduceSuccessRate();

      console.log(`GASINTAKE: ${name} new threshold ${this.currentSuccess}`);
      console.log(`GASINTAKE: ${name} reward ${intervalReward}`);
      console.log(`GASINTAKE: ${name} reward modifier ${this.rewardModifier}`);
    } else {
      this.gasNumb = true;
      this.scoreIncrease *= -1;
      console.log(
        `GASINTAKE: ${name} failed roll [${playerRoll}] number ${this.roundSuccesses} with threshold ${this.baseSuccess}`
      );

      // Emit a whisper message via the domain event bus bridge
      const evt: DomainEvent = {
        type: FacilityEvents.message.whisper,
        payload: {
          playerId: player.identity.id,
          text: `(${name} coughs and gets a bit dizzy...)`,
        },
      };
      // reset knobs before returning on failure
      this.successRateModifier = 0;
      this.rewardModifier = 1;
      return { energy: this.energyCost, reward: this.scoreIncrease, effects: [{ type: "EMIT_EVENT", event: evt }] };
    }

    this.successRateModifier = 0;
    this.rewardModifier = 1;

    return { energy: this.energyCost, reward: this.scoreIncrease };
  }

  private reduceSuccessRate() {
    // decrease by 20 percentage points but clamp to 20% floor
    this.currentSuccess -= this.decayRate;
    if (this.currentSuccess < 0.2) this.currentSuccess = 0.2;
  }

  private calculateReward(): number {
    let reward = 0;
    if (this.roundSuccesses > 5) this.roundSuccesses = 5;
    switch (this.roundSuccesses) {
      case 1:
        reward = 2;
        break;
      case 2:
        reward = 2;
        break;
      case 3:
        reward = 3;
        break;
      case 4:
        reward = 4;
        break;
      case 5:
        reward = 5;
        break;
      default:
        reward = 0;
        break;
    }
    return reward;
  }

  reset(): void {
    if (this.gasNumb) this.scoreIncrease = 1;
    this.gasNumb = false;
    this.roundSuccesses = 0;
    this.rewardModifier = 1;
    this.successRateModifier = 0;
    this.currentSuccess = this.baseSuccess;
    const name = '<unknown>';
    console.log(`GASINTAKE: executing RESET at end of shift for ${name}`);
  }
}

export {};
