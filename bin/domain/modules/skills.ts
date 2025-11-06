import { PlayerModule } from "../core/PlayerCore";
import type { SkillsApi, SkillsState } from "../skills/Skill.types";

export type SkillsModule = PlayerModule & SkillsApi & { state: SkillsState; key: "skills" };

export function createSkillsModule(): SkillsModule {
  return {
    key: "skills",
    state: { skills: [], activeModifiers: [] },
    add(skill) { this.state.skills.push(skill); this.state.skills.sort((a,b) => b.priority - a.priority); },
    list() { return this.state.skills; },
    resetAll() { for (const s of this.state.skills) s.reset?.(); },
    applyModifiers(mods) { this.state.activeModifiers = mods; }
  };
}
