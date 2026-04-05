import { DomainEvent } from "../ports/DomainEvenPort";

export type BullState = {
  level: number;
  energy: number;
  threshold: number;
  ready: boolean;
  step: number;
  cooldownShifts?: number; // shifts remaining where charge is blocked/reduced
};

export type BullModifier = {
  chargeMultiplier?: number;
  energyMaxBonus?: number;
  stepMultiplier?: number;
  cooldownMultiplier?: number;
  appliesTo?: { source?: "skill" | "emote" | "global"; skillWhitelist?: string[] };
  remainingShifts?: number;
};

export type BullChargeEvent = DomainEvent & {
  type: "bull:charge";
  payload: { playerId: number; amount: number; reason?: string };
};

export type BullFailEvent = DomainEvent & {
  type: "bull:fail";
  payload: { playerId: number; reason?: string };
};

export type BullConsumeEvent = DomainEvent & {
  type: "bull:consume";
  payload: { playerId: number; reason?: string };
};

export type BullModifierEvent = DomainEvent & {
  type: "bull:modifier";
  payload: { playerId: number; modifier: BullModifier; action: "add" | "remove" };
};

export type BullProgressEvent = DomainEvent & {
  type: "bull:progress";
  payload: { playerId: number; state: BullState; logPayload?: Record<string, unknown> };
};
