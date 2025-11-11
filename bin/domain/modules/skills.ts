import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import type { SkillsApi, SkillsState } from "../skills/Skill.types";

export type SkillsModule = PlayerModule & SkillsApi & { state: SkillsState; key: "skills" };

export function createSkillsModule(): SkillsModule {
  let player: PlayerCore | undefined;
  return {
    key: "skills",
    state: { skills: [], activeModifiers: [] },
    onAttach(p) { player = p; },
    add(skill) { this.state.skills.push(skill); this.state.skills.sort((a,b) => b.priority - a.priority); },
    list() { return this.state.skills; },
    resetAll() { for (const s of this.state.skills) s.reset?.(); },
    applyModifiers(mods) { this.state.activeModifiers = mods; },
    printSkillsInfo() {
      let aux = `(Your current skills are:\n`;
      const classing = player?.tryGet<any>("classing");
      if (!classing || classing.state.classId === -1) {
        const pname = player?.identity?.nickname ?? player?.identity?.name ?? "<unknown>";
        console.log(`ERROR: ${pname} failed skill info print: no class selected`);
        return `(ERROR: you haven't selected a class yet`;
      }

      for (const skill of this.state.skills) {
        aux += `|| ${skill.skillName}, Level ${skill.skillLevel} ||\n` + `-> ${skill.description}\n`;
      }

      return aux;
    }
  };
}
