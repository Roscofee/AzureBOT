import { AnyModifier } from "../../../domain/skills/Skill.types";
import { QualityModifier } from "../../../domain/modules/quality";

const formatEventMessage = (title: string | undefined, description: string): string =>
  title ? `(\n${title}\n${description}` : `(\n${description}`;

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
    id: "HandlerKindness",
    name: "Handler Kindness",
    priority: 3,
    weight: 5,
    durationShifts: 1,
    onFireMessage: formatEventMessage("Handler Kindness", "Handlers are lenient this shift: +50% energy recovery and +10% xp bonus"),
    stats: [{ target: "energy", op: "mult", value: 1.5 }, { target: "xp", op: "mult", value: 1.1 }],
  },
  {
    id: "Lovely",
    name: "Song of the Honey Queen",
    description: "Sing a lovely tune for her Majesty!, moo has double rewards on this shift.",
    priority: 3,
    weight: 5,
    durationShifts: 1,
    onFireMessage: formatEventMessage("Song of the Honey Queen", "Sing a lovely tune for her Majesty! Moo rewards are doubled this shift."),
    onEndMessage: formatEventMessage(undefined, "The Honey Queen's song fades away."),
    skills: [
      {
        skillName: "Moo",
        modifier: { rewardMultiplier: 2, skillWhitelist: ["Moo", "GamblersMoo"] },
        remainingShifts: 1,
      },
    ],
  },
  {
    id: "Patty",
    name: "Strength of the Dawn Star",
    description: "The sunlight fills you up with determination, all energy costs are halved this shift.",
    priority: 3,
    weight: 4,
    durationShifts: 1,
    onFireMessage: formatEventMessage("Strength of the Dawn Star", "The sunlight fills you with determination. All energy costs are halved this shift."),
    onEndMessage: formatEventMessage(undefined, "The Dawn Star's blessing wanes."),
    skills: [
      {
        modifier: { energyCostMultiplier: 0.5 },
        remainingShifts: 1,
      },
    ],
  },
  {
    id: "Sonic",
    name: "Providence of the Azure Feline",
    description: "Take an inspiring breath of fresh lust, gas intake rewards doubled.",
    priority: 3,
    weight: 4,
    durationShifts: 1,
    onFireMessage: formatEventMessage("Providence of the Azure Feline", "Take an inspiring breath of fresh lust. Gas Intake rewards are doubled this shift."),
    onEndMessage: formatEventMessage(undefined, "The Azure Feline's providence passes."),
    skills: [
      {
        skillName: "GasIntake",
        modifier: { rewardMultiplier: 2, skillWhitelist: ["GasIntake"] },
        remainingShifts: 1,
      },
    ],
  },
];
