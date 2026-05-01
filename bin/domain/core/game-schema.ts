import { BullModule } from "../modules/bull";
import { ClassingModule } from "../modules/classing";
import { EconomyModule } from "../modules/economy";
import { FlagsModule } from "../modules/flags";
import { QualityModule } from "../modules/quality";
import { SongModule } from "../modules/song";
import { ScoringModule } from "../modules/scoring";
import { SkillLogModule } from "../modules/skillLog";
import { SkillsModule } from "../modules/skills";
import { PlayerCore } from "./PlayerCore";

export interface GameSchema {
  required: readonly string[];
  optional?: readonly string[];
}

export type ModuleKey =
  | "economy"
  | "classing"
  | "skills"
  | "scoring"
  | "flags"
  | "skillLog"
  | "quality"
  | "bull"
  | "song";

export type ModuleOfKey<K extends string> =
  K extends "economy" ? EconomyModule :
  K extends "classing" ? ClassingModule :
  K extends "skills" ? SkillsModule :
  K extends "scoring" ? ScoringModule :
  K extends "flags" ? FlagsModule<any> :
  K extends "skillLog" ? SkillLogModule :
  K extends "quality" ? QualityModule :
  K extends "bull" ? BullModule :
  K extends "song" ? SongModule :
  never;

export type PlayerFor<G extends GameSchema> = PlayerCore & {
  get<
    K extends Extract<G["required"][number] | NonNullable<G["optional"]>[number], ModuleKey>
  >(key: K): ModuleOfKey<K>;

  tryGet<
    K extends Extract<G["required"][number] | NonNullable<G["optional"]>[number], ModuleKey>
  >(key: K): ModuleOfKey<K> | undefined;
};

export function asGamePlayer<G extends GameSchema>(p: PlayerCore): PlayerFor<G> {
  return p as PlayerFor<G>;
}

export function ensureModules<G extends GameSchema>(p: PlayerCore, schema: G): asserts p is PlayerFor<G> {
  for (const k of schema.required) {
    if (!p.tryGet<any>(k)) throw new Error(`Missing required module: ${k}`);
  }
}
