import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import type { SkillsApi, SkillsState } from "../skills/Skill.types";

export type SkillsModule = PlayerModule & SkillsApi & { state: SkillsState; key: "skills" };

export function createSkillsModule(): SkillsModule {
  let player: PlayerCore | undefined;
  return {
    key: "skills",
    state: { skills: [] },
    onAttach(p) { player = p; },
    add(skill) { this.state.skills.push(skill); this.state.skills.sort((a,b) => b.priority - a.priority); },
    list() { return this.state.skills; },
    resetAll() { for (const s of this.state.skills) s.reset?.(); },
    printSkillsInfo() {
      let aux = `(Your current skills are:\n`;
      const classing = player?.tryGet<any>("classing");
      if (!classing || classing.state.classId === -1) {
        const pname = player?.identity?.nickname ?? player?.identity?.name ?? "<unknown>";
        console.log(`ERROR: ${pname} failed skill info print: no class selected`);
        return `(ERROR: you haven't selected a class yet`;
      }

      for (const skill of this.state.skills) {
        const baseCost = typeof skill.computeEnergy === "function"
          ? skill.computeEnergy(player!)
          : (skill.energyCost ?? 0);
        aux += `|| ${skill.skillName}, Level ${skill.skillLevel}, Cost: ${baseCost} energy ||\n` + `-> ${skill.description}\n`;
      }

      return aux;
    }
  };
}
