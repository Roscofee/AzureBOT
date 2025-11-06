import type { Skill } from "./Skill.types";

export type SkillCtor = new (args: {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;
}) => Skill;

const registry = new Map<string, SkillCtor>();

export function registerSkill(name: string, ctor: SkillCtor) {
  if (registry.has(name)) throw new Error(`Skill '${name}' already registered`);
  registry.set(name, ctor);
}

export function createSkill(args: {
  skillId: number;
  skillName: string;
  skillLevel: number;
  description: string;
  upgrade_description: string;
}): Skill | null {
  const ctor = registry.get(args.skillName);
  if (!ctor) {
    console.warn(`Skill '${args.skillName}' not found in registry`);
    return null;
  }
  return new ctor(args);
}
