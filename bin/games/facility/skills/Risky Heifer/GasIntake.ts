import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";
import { DomainEvent } from "../../../../domain/ports/DomainEvenPort";
import { FacilityConfig, FacilityEvents } from "../../config";
import { dialog } from "../../../../dialog/dialog";
import { consumeHeiferRollEffect } from "./heiferRollState";

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
  private decayRate: number = 0.10;
  private rewardModifier: number = 1;
  private successRateModifier: number = 0;
  private currentHaul: number = 0;
  private maxLevelCarryRetention: number = 0.5;
  private failureLossMultiplier: number = 0.65;
  private failureMessage?: string;
  private nextDecayMultiplier: number = 1;
  private nextRewardStepBonus: number = 0;

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

    this.baseSuccess = this.isMaxLevel()
      ? 0.9
      : Math.min(0.25 + 0.07 * this.skillLevel, 0.9);
    this.currentSuccess = this.baseSuccess;
    this.failureMessage = dialog.numbness.gasNumb;
  }

  setRewardModifier(rewardModifier: number) {
    this.rewardModifier = rewardModifier;
  }

  setSuccessRateModifier(successRateModifier: number) {
    this.successRateModifier = successRateModifier;
  }

  setNextDecayMultiplier(multiplier: number) {
    this.nextDecayMultiplier = multiplier;
  }

  setNextRewardStepBonus(bonus: number) {
    this.nextRewardStepBonus = bonus;
  }

  getRoundSuccesses(): number {
    return this.roundSuccesses;
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
    const heiferRoll = consumeHeiferRollEffect(player);
    const forcedCrit = heiferRoll === "autoCrit";
    const forcedFail = heiferRoll === "autoFail";
    const safeNoCrit = heiferRoll === "safeNoCrit";

    const currentSucessRate = this.currentSuccess + this.successRateModifier;
    const normalizedSuccessRate = Math.round(currentSucessRate * 100);

    const name = player.identity.nickname ?? player.identity.name;
    console.log(`GASINTAKE: ${name} roll number ${this.roundSuccesses}, value ${playerRoll}`);
    console.log(`GASINTAKE: ${name} round base success chance ${this.currentSuccess}`);
    console.log(`GASINTAKE: ${name} success modifier ${this.successRateModifier}`);
    console.log(`GASINTAKE: ${name} current success chance ${currentSucessRate}`);
    console.log(`GASINTAKE: ${name} normalized final success chance ${normalizedSuccessRate}`);

    if (forcedCrit || (!forcedFail && (safeNoCrit || playerRoll <= normalizedSuccessRate))) {
      console.log(`GASINTAKE: ${name} roll [${playerRoll}] success with threshold ${normalizedSuccessRate}${forcedCrit ? " forced crit" : safeNoCrit ? " fail-safe" : ""}`);

      this.roundSuccesses++;

      const intervalReward = this.calculateReward(player) * this.rewardModifier;
      if (this.isMaxLevel()) {
        this.currentHaul = intervalReward + this.currentHaul * this.maxLevelCarryRetention;
      } else {
        this.currentHaul += intervalReward;
      }
      const reward = this.isMaxLevel() ? this.currentHaul : intervalReward;
      this.reduceSuccessRate();

      console.log(`GASINTAKE: ${name} new threshold ${this.currentSuccess}`);
      console.log(`GASINTAKE: ${name} reward ${intervalReward}`);
      console.log(`GASINTAKE: ${name} reward modifier ${this.rewardModifier}`);
      this.successRateModifier = 0;
      this.rewardModifier = 1;
      this.nextRewardStepBonus = 0;
      return { energy: this.energyCost, reward, outcome: forcedCrit ? "critical" : "success" };
    } else {
      this.gasNumb = true;
      this.currentHaul *= -this.failureLossMultiplier;
      console.log(
        `GASINTAKE: ${name} failed roll [${playerRoll}] number ${this.roundSuccesses} with threshold ${normalizedSuccessRate}${forcedFail ? " forced" : ""}`
      );

      // Emit a broadcast message via the domain event bus bridge
      const evt: DomainEvent = {
        type: FacilityEvents.message.broadcast,
        payload: {
          playerId: player.identity.id,
          text: `(${name} coughs and gets a bit dizzy, overflowing the pump cups and loosing her current haul in the spill... [${playerRoll}/${normalizedSuccessRate}])`,
        },
      };
      // reset knobs before returning on failure
      this.successRateModifier = 0;
      this.rewardModifier = 1;
      this.nextDecayMultiplier = 1;
      this.nextRewardStepBonus = 0;
      return { energy: this.energyCost, reward: this.currentHaul, outcome: "fail", effects: [{ type: "EMIT_EVENT", event: evt }] };
    }
  }

  private reduceSuccessRate() {
    this.currentSuccess -= this.decayRate * this.nextDecayMultiplier;
    this.nextDecayMultiplier = 1;
    if (this.currentSuccess < 0.2) this.currentSuccess = 0.2;
  }

  private calculateReward(player: PlayerCore): number {
    let reward = 0;
    let whisperText: string | undefined;

    if (this.roundSuccesses > 5) this.roundSuccesses = 5;

    const rewardStep = Math.min(5, this.roundSuccesses + this.nextRewardStepBonus);

    switch (rewardStep) {
      case 1:
        whisperText = dialog.numbness.numbness4;
        reward = 2;
        break;
      case 2:
        whisperText = dialog.numbness.numbness5;
        reward = 4;
        break;
      case 3:
        whisperText = dialog.numbness.numbness6;
        reward = 7;
        break;
      case 4:
        whisperText = dialog.numbness.numbness7;
        reward = 11;
        break;
      case 5:
        whisperText = dialog.numbness.numbness8;
        reward = 16;
        break;
      default:
        reward = 0;
        break;
    }

    if (whisperText) {
      const evt: DomainEvent = {
        type: FacilityEvents.message.whisper,
        payload: { playerId: player.identity.id, text: whisperText },
      };
      player.ctx.bus.publish(evt);
    }

    return reward;
  }

  private isMaxLevel(): boolean {
    return this.skillLevel >= FacilityConfig.skillMaxLevel(this.skillId);
  }

  reset(): void {
    this.currentHaul = 0;
    this.gasNumb = false;
    this.roundSuccesses = 0;
    this.rewardModifier = 1;
    this.successRateModifier = 0;
    this.currentSuccess = this.baseSuccess;
    this.nextDecayMultiplier = 1;
    this.nextRewardStepBonus = 0;
    const name = '<unknown>';
    console.log(`GASINTAKE: executing RESET at end of shift for ${name}`);
  }
}

export {};
