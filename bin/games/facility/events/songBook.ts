import { SongNoteCatalog, SongRecipe } from "../../../domain/modules/song";

export const songNotes: SongNoteCatalog = {
  white: {
    family: "self",
    tier: 0,
    label: "White Note",
    icon: "⬜",
    role: "Makes you more powerful through self-improvement.",
  },
  purple: {
    family: "self",
    tier: 1,
    label: "Purple Note",
    icon: "🟪",
    role: "An elevated self-improvement note with stronger personal scaling.",
  },
  red: {
    family: "drive",
    tier: 0,
    label: "Red Note",
    icon: "🟥",
    role: "Raises rewards and accelerates bull charge buildup.",
  },
  orange: {
    family: "drive",
    tier: 1,
    label: "Orange Note",
    icon: "🟧",
    role: "A stronger aggressive note with amplified payoff and momentum.",
  },
  green: {
    family: "restore",
    tier: 0,
    label: "Green Note",
    icon: "🟩",
    role: "Focuses on restorative effects such as energy recovery.",
  },
  lightBlue: {
    family: "guard",
    tier: 0,
    label: "Blue Note",
    icon: "🟦",
    role: "Raises tolerance to disruption and stabilizes performance.",
  },
  gold: {
    family: "crown",
    tier: 2,
    label: "Gold Note",
    icon: "🟨",
    role: "A rare crown note used for exceptionally powerful songs.",
  },
};

export const songBook: SongRecipe[] = [
  {
    id: "mirror-etude",
    name: "Mirror Etude",
    kind: "melody",
    pattern: ["self", "self"],
    scope: "self",
    variants: {
      S: {
        summary: "A simple reflective melody that adds +5 score per melody level each shift while active.",
        durationShifts: 2,
        shiftScorePerLevel: 5,
      },
      L: {
        summary: "A refined reflective melody that adds +5 score per melody level each shift and reduces energy costs by 15% while active.",
        durationShifts: 2,
        shiftScorePerLevel: 5,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.85 } },
        ],
      },
      XL: {
        summary: "A masterwork reflective melody that adds +5 score per melody level each shift and reduces energy costs by 20% while active.",
        durationShifts: 3,
        shiftScorePerLevel: 5,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.8 } },
        ],
      },
    },
  },
  {
    id: "stillwater-ward",
    name: "Stillwater Ward",
    kind: "melody",
    pattern: ["guard", "self"],
    scope: "self",
    variants: {
      S: {
        summary: "A calm ward melody that restores +10 energy per melody level each shift while active.",
        durationShifts: 2,
        shiftEnergyPerLevel: 10,
      },
      L: {
        summary: "A steadier ward melody that restores +10 energy per melody level each shift and improves quality generation by 25% while active.",
        durationShifts: 2,
        shiftEnergyPerLevel: 10,
        qualityModifiers: [
          { modifier: { successMult: 1.25 }, remainingShifts: 2 },
        ],
      },
      XL: {
        summary: "A crystalline ward melody that restores +10 energy per melody level each shift and improves quality generation by 30% while active.",
        durationShifts: 3,
        shiftEnergyPerLevel: 10,
        qualityModifiers: [
          { modifier: { successMult: 1.3 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "ember-renewal",
    name: "Ember Renewal",
    kind: "melody",
    pattern: ["restore", "drive"],
    scope: "self",
    variants: {
      S: {
        summary: "A warm renewal melody that increases bull charge generation by 10% while active.",
        durationShifts: 2,
        bullModifiers: [
          { modifier: { chargeMultiplier: 1.1 }, remainingShifts: 2 },
        ],
      },
      L: {
        summary: "A brighter renewal melody that increases bull charge generation by 20% and grants 75 extra XP each shift while active.",
        durationShifts: 2,
        shiftXpBonus: 75,
        bullModifiers: [
          { modifier: { chargeMultiplier: 1.2 }, remainingShifts: 2 },
        ],
      },
      XL: {
        summary: "An incandescent renewal melody that increases bull charge generation by 25% and grants 100 extra XP each shift while active.",
        durationShifts: 3,
        shiftXpBonus: 100,
        bullModifiers: [
          { modifier: { chargeMultiplier: 1.25 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "mirror-etude-fugue",
    name: "Mirror Etude Fugue",
    kind: "melody",
    pattern: ["self", "self", "drive"],
    notePattern: ["purple", "white", "red"],
    scope: "self",
    variants: {
      L: {
        summary: "A longer mirror refrain that adds +10 score per melody level each shift and reduces energy costs by 20% while active.",
        durationShifts: 3,
        shiftScorePerLevel: 10,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.8 } },
        ],
      },
    },
  },
  {
    id: "stillwater-reservoir",
    name: "Stillwater Reservoir",
    kind: "melody",
    pattern: ["guard", "self", "self"],
    notePattern: ["lightBlue", "purple", "white"],
    scope: "self",
    variants: {
      L: {
        summary: "A deeper ward refrain that restores +15 energy per melody level each shift and improves quality generation by 35% while active.",
        durationShifts: 3,
        shiftEnergyPerLevel: 15,
        qualityModifiers: [
          { modifier: { successMult: 1.35 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "ember-crescence",
    name: "Ember Crescence",
    kind: "melody",
    pattern: ["restore", "drive", "drive"],
    notePattern: ["green", "orange", "red"],
    scope: "self",
    variants: {
      XL: {
        summary: "A hotter renewal refrain that increases bull charge generation by 30% and grants 125 extra XP each shift while active.",
        durationShifts: 3,
        shiftXpBonus: 125,
        bullModifiers: [
          { modifier: { chargeMultiplier: 1.3 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "rallying-chorus",
    name: "Rallying Chorus",
    kind: "song",
    pattern: ["drive", "self", "guard"],
    scope: "others",
    variants: {
      S: {
        summary: "A supportive chorus that raises neighboring stations' rewards by 15% while active.",
        durationShifts: 2,
        skillModifiers: [
          { modifier: { rewardMultiplier: 1.15 } },
        ],
      },
      L: {
        summary: "A stronger chorus that raises neighboring stations' rewards by 25% while active.",
        durationShifts: 2,
        skillModifiers: [
          { modifier: { rewardMultiplier: 1.25 } },
        ],
      },
      XL: {
        summary: "A broad chorus that raises neighboring stations' rewards by 35% while active.",
        durationShifts: 3,
        skillModifiers: [
          { modifier: { rewardMultiplier: 1.35 } },
        ],
      },
    },
  },
  {
    id: "sheltering-hymn",
    name: "Sheltering Hymn",
    kind: "song",
    pattern: ["guard", "restore", "self"],
    scope: "others",
    variants: {
      S: {
        summary: "A careful hymn that improves neighboring stations' quality generation by 15% while active.",
        durationShifts: 2,
        qualityModifiers: [
          { modifier: { successMult: 1.15 }, remainingShifts: 2 },
        ],
      },
      L: {
        summary: "A firmer hymn that improves neighboring stations' quality generation by 25% while active.",
        durationShifts: 2,
        qualityModifiers: [
          { modifier: { successMult: 1.25 }, remainingShifts: 2 },
        ],
      },
      XL: {
        summary: "A bright hymn that improves neighboring stations' quality generation by 30% while active.",
        durationShifts: 3,
        qualityModifiers: [
          { modifier: { successMult: 1.3 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "cadence-of-ease",
    name: "Cadence of Ease",
    kind: "song",
    pattern: ["self", "restore", "drive"],
    scope: "others",
    variants: {
      S: {
        summary: "A practical cadence that reduces neighboring stations' energy costs by 10% while active.",
        durationShifts: 2,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.9 } },
        ],
      },
      L: {
        summary: "A softer cadence that reduces neighboring stations' energy costs by 15% and raises rewards by 15% while active.",
        durationShifts: 2,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.85, rewardMultiplier: 1.15 } },
        ],
      },
      XL: {
        summary: "A graceful cadence that reduces neighboring stations' energy costs by 20% and raises rewards by 20% while active.",
        durationShifts: 3,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.8, rewardMultiplier: 1.2 } },
        ],
      },
    },
  },
  {
    id: "grand-rally",
    name: "Grand Rally",
    kind: "song",
    pattern: ["drive", "self", "guard", "drive"],
    notePattern: ["orange", "purple", "lightBlue", "red"],
    scope: "others",
    variants: {
      L: {
        summary: "A drilled rally that sharply boosts neighboring stations' rewards and trims their energy costs while active.",
        durationShifts: 3,
        skillModifiers: [
          { modifier: { rewardMultiplier: 1.45, energyCostMultiplier: 0.85 } },
        ],
      },
    },
  },
  {
    id: "coronation-anthem",
    name: "Coronation Anthem",
    kind: "aria",
    pattern: ["self", "drive", "guard", "restore", "crown"],
    notePattern: ["purple", "orange", "lightBlue", "green", "gold"],
    scope: "others",
    requiresGold: true,
    ariaEffect: {
      summary: "A crowned aria that calls a powerful room-wide boon into being.",
      durationShifts: 1,
      globalEventId: "Lovely",
    },
  },
  {
    id: "sanctuary-procession",
    name: "Sanctuary Procession",
    kind: "song",
    pattern: ["guard", "restore", "self", "self"],
    notePattern: ["lightBlue", "green", "purple", "white"],
    scope: "others",
    variants: {
      L: {
        summary: "A longer procession that strongly improves neighboring stations' quality generation and lowers their energy costs while active.",
        durationShifts: 3,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.85 } },
        ],
        qualityModifiers: [
          { modifier: { successMult: 1.4 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "easing-cadence",
    name: "Easing Cadence",
    kind: "song",
    pattern: ["restore", "drive", "self", "drive"],
    notePattern: ["green", "orange", "purple", "red"],
    scope: "others",
    variants: {
      L: {
        summary: "A woven cadence that gives neighboring stations lighter energy costs, better rewards, and steadier quality generation while active.",
        durationShifts: 3,
        skillModifiers: [
          { modifier: { energyCostMultiplier: 0.75, rewardMultiplier: 1.25 } },
        ],
        qualityModifiers: [
          { modifier: { successMult: 1.15 }, remainingShifts: 3 },
        ],
      },
    },
  },
  {
    id: "coronation-anthem",
    name: "Coronation Anthem",
    kind: "aria",
    pattern: ["self", "drive", "guard", "restore", "crown"],
    scope: "others",
    requiresGold: true,
    ariaEffect: {
      summary: "A crowned aria that calls a powerful room-wide boon into being.",
      durationShifts: 1,
      globalEventId: "Lovely",
    },
  },
];
