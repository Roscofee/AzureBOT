import { PlayerCore } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";
import { ChatMessageType, IncomingMessage } from "../ports/MessagePort";
export { ChatMessageType } from "../ports/MessagePort";

export type SkillEffect =
  | { type: "QUALITY_ADJUST"; delta: number }            // affects QualityModule
  | { type: "QUALITY_SET"; value: number }
  | { type: "BULL_CHARGE"; delta: number }               // affects BullModule
  | { type: "SCORING_BONUS"; delta: number }             // affects ScoringModule (optional)
  | { type: "EMIT_EVENT"; event: DomainEvent }
  // add other effect types as needed, all pure data

export interface SkillResult {
  energy: number;            // base energy cost (usually = skill.energyCost)
  reward: number;            // base reward (before modifiers)
  effects?: SkillEffect[];   // side-effects to apply to modules
}
export interface Skill {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;

  validMessageTypes: ChatMessageType[];
  triggerTokens: string[];
  energyCost: number;
  priority: number;

  validInput(data: IncomingMessage): boolean;
  canExecute(player: PlayerCore): boolean;

  /** Optional: compute dynamic energy cost based on player state */
  computeEnergy?(player: PlayerCore): number;

  /** PURE: compute base energy/reward + effects; no mutations here */
  use(player: PlayerCore): SkillResult;

  reset?(): void;
}

// 1) Split knobs
export interface RewardModifier { rewardMultiplier?: number; }
export interface EnergyModifier  { energyCostMultiplier?: number; }
export interface EffectModifier {
  transformEffect?(
    e: SkillEffect,
    ctx: { player: PlayerCore; skillName: string }
  ): SkillEffect | null;
}

// 2) Add the shared match selectors
export interface BaseModifier {
  skillWhitelist?: string[];
  skillBlacklist?: string[];
}

// 3) Single modifier type used everywhere
export type AnyModifier = BaseModifier & Partial<RewardModifier & EnergyModifier & EffectModifier>;

// 4) Use AnyModifier in state/api
export interface SkillsState {
  skills: Skill[];
  activeModifiers: AnyModifier[];
}

export interface SkillsApi {
  list(): ReadonlyArray<Skill>;
  add(skill: Skill): void;
  resetAll(): void;
  applyModifiers(mods: AnyModifier[]): void; // <- update
  printSkillsInfo(): string;
}
