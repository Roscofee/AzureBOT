import { AnyModifier } from "../../../domain/skills/Skill.types";
import { QualityModifier } from "../../../domain/modules/quality";

// Catalog of available global events
export type GlobalEventDef = {
  id: string;
  name: string;
  description?: string;
  priority: number;          // higher first
  weight?: number;           // tie-breaker random weight
  durationShifts?: number;   // how many shifts it stays active
  onFireMessage?: string;
  onEndMessage?: string;
  stats?: { target: "energy" | "xp" | "economy" | "score" | "custom"; op: "add" | "mult"; value: number }[];
  skills?: { skillName?: string; modifier: AnyModifier; remainingShifts?: number }[];
  quality?: { playerId?: number | "*"; modifier: QualityModifier; remainingShifts?: number }[];
};

export const globalEvents: GlobalEventDef[] = [
  {
    id: "EnduranceGasSurge",
    name: "Endurance Gas Surge",
    priority: 3,
    weight: 2,
    durationShifts: 1,
    onFireMessage: "(ENV) Gas mixture enriched — endurance boosted!",
    onEndMessage: "(ENV) Gas mixture back to normal.",
    stats: [{ target: "energy", op: "mult", value: 1.25 }],
    skills: [{ skillName: "GasIntake", modifier: { rewardMultiplier: 1.2 }, remainingShifts: 1 }],
  },
  {
    id: "HandlerKindness",
    name: "Handler Kindness",
    priority: 2,
    weight: 1,
    durationShifts: 1,
    onFireMessage: "(ENV) Handlers are lenient this shift; small bonuses applied.",
    stats: [{ target: "energy", op: "add", value: 10 }, { target: "xp", op: "mult", value: 1.1 }],
  },
];
