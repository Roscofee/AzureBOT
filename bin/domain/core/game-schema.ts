import { ClassingModule } from "../modules/classing";
import { EconomyModule } from "../modules/economy";
import { FlagsModule } from "../modules/flags";
import { ScoringModule } from "../modules/scoring";
import { SkillsModule } from "../modules/skills";
import { PlayerCore } from "./PlayerCore";


// Define the schema of a game in terms of required/optional module keys
export interface GameSchema {
  required: readonly string[];
  optional?: readonly string[];
}

// Supported module keys → concrete module types
export type ModuleKey = "economy" | "classing" | "skills" | "scoring";

export type ModuleOfKey<K extends string> =
  K extends "economy" ? EconomyModule :
  K extends "classing" ? ClassingModule :
  K extends "skills" ? SkillsModule :
  K extends "scoring" ? ScoringModule :
  K extends "flags" ? FlagsModule<any> : // generic by default; specialize per game if desired
  never;

// Player type specialized for a given game schema
export type PlayerFor<G extends GameSchema> = PlayerCore & {
  get<
    K extends Extract<G["required"][number] | NonNullable<G["optional"]>[number], ModuleKey>
  >(key: K): ModuleOfKey<K>;

  tryGet<
    K extends Extract<G["required"][number] | NonNullable<G["optional"]>[number], ModuleKey>
  >(key: K): ModuleOfKey<K> | undefined;
};

// Helper to cast a PlayerCore to a typed player for schema G
export function asGamePlayer<G extends GameSchema>(p: PlayerCore): PlayerFor<G> {
  return p as PlayerFor<G>;
}

// Runtime guard to ensure required modules exist; narrows type to PlayerFor<G>
export function ensureModules<G extends GameSchema>(p: PlayerCore, schema: G): asserts p is PlayerFor<G> {
  for (const k of schema.required) {
    // Using any here to avoid over-constraining keys at runtime
    if (!p.tryGet<any>(k)) throw new Error(`Missing required module: ${k}`);
  }
}

