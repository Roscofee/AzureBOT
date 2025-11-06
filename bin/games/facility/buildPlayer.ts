import { PlayerCore, PlayerIdentity } from "../../domain/core/PlayerCore";
import { createEconomyModule } from "../../domain/modules/economy";
import { createClassingModule } from "../../domain/modules/classing";
import { createSkillsModule } from "../../domain/modules/skills";
import { createScoringModule } from "../../domain/modules/scoring";
import type { PlayerRepo } from "../../domain/ports/PlayerRepo";
import type { MessagePort } from "../../domain/ports/MessagePort";
import type { DomainEventBus } from "../../domain/ports/DomainEvenPort";
import { asGamePlayer, ensureModules, PlayerFor } from "../../domain/core/game-schema";
import { FacilitySchema } from "./schema";
import { createFlagsModule } from "../../domain/modules/flags";

export type DairyPlayer = PlayerFor<typeof FacilitySchema>;

export interface BuildPlayerDeps {
  repo: PlayerRepo;
  messages: MessagePort;
  bus: DomainEventBus;
}

export type DairyFlags = {
  regular?: boolean;
  superadmin?: boolean;
  active: boolean;
};

export interface PlayerInitials {
  economy?: number; // starting currency
  classing?: {
    classId: number;
    name: string;
    level: number;
    xp: number;
    maxEnergy: number;
    currentEnergy: number;
  };
  scoring?: {
    shiftProduction?: number;
    sessionScore?: number;
    totalScore?: number;
    bestScore?: number;
  };
  flags?: Partial<DairyFlags>;
}

/**
 * Build a Facility (Dairy) player by composing required modules defined by FacilitySchema.
 */
export function buildDairyPlayer(identity: PlayerIdentity, deps: BuildPlayerDeps, init: PlayerInitials = {}): DairyPlayer {
  const { repo, messages, bus } = deps;

  // Create core
  const core = new PlayerCore(identity, { bus });

  // Attach required modules per schema
  core.attach(createSkillsModule());

  const econStart = init.economy ?? 0;
  core.attach(createEconomyModule(econStart, repo, messages));

  core.attach(
    createClassingModule(
      {
        classId: init.classing?.classId ?? -1,
        name: init.classing?.name ?? "NoClass",
        level: init.classing?.level ?? 1,
        xp: init.classing?.xp ?? 0,
        maxEnergy: init.classing?.maxEnergy ?? 0,
        currentEnergy: init.classing?.currentEnergy ?? 0,
      },
      repo,
      messages
    )
  );

  core.attach(
    createScoringModule(
      {
        cycleScore: init.scoring?.shiftProduction ?? 0,
        sessionScore: init.scoring?.sessionScore ?? 0,
        totalScore: init.scoring?.totalScore ?? 0,
        bestScore: init.scoring?.bestScore ?? 0,
      },
      repo
    )
  );

  const flagsDefaults: DairyFlags = { regular: false, superadmin: false, active: false};
  const flags = createFlagsModule<DairyFlags>({ ...flagsDefaults, ...(init.flags ?? {}) });
  core.attach(flags);

  // Ensure all required modules exist and narrow the type
  ensureModules(core, FacilitySchema);
  return asGamePlayer<typeof FacilitySchema>(core);
}

