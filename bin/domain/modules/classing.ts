import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";

export interface ClassProgress { classId: number; name: string; level: number; xp: number; xpToLevel: number; }
export interface ClassingApi {
  gainXp(amount: number): number; // returns levels gained
  info(): ClassProgress;
  printClassInfo(): string;
}
export type ClassingModule = PlayerModule & ClassingApi & { state: ClassProgress & { maxEnergy: number; currentEnergy: number } };

export const BASE_CLASS_ENERGY = 30;

export function calculateClassMaxEnergy(level: number, energyPerLevel: number, baseEnergy: number = BASE_CLASS_ENERGY): number {
  const safeLevel = Math.max(1, level || 1);
  return baseEnergy + (safeLevel - 1) * energyPerLevel;
}

export function createClassingModule(
  initial: Omit<ClassingModule["state"], "xpToLevel"> & { xpToLevel?: number },
  repo: PlayerRepo,
  messages: MessagePort,
  cfg: {
    baseXP: number;
    scaling: number;
    energyPerLevel: number;
    levelAnnouncements: number[];
    getClassMaxLevel?: (classId: number) => number;
    adjustXPGain?: (classId: number | undefined, currentLevel: number, baseGain: number) => number;
  } = { baseXP: 100, scaling: 1.5, energyPerLevel: 10, levelAnnouncements: [25, 50, 100] as number[] }
): ClassingModule {
  let player: PlayerCore;

  const xpToLevel = initial.xpToLevel ?? Math.floor(cfg.baseXP * Math.pow(initial.level || 1, cfg.scaling));
  const initialMaxEnergy = calculateClassMaxEnergy(initial.level ?? 1, cfg.energyPerLevel);
  const initialCurrentEnergy = Math.min(initial.currentEnergy ?? initialMaxEnergy, initialMaxEnergy);

  const mod: ClassingModule = {
    key: "classing",
    state: { ...initial, xpToLevel, maxEnergy: initialMaxEnergy, currentEnergy: initialCurrentEnergy },

    onAttach(p) { player = p; },

    gainXp(amount) {
      const maxLevel = cfg.getClassMaxLevel?.(this.state.classId) ?? 100;
      if (this.state.level >= maxLevel) return 0;

      const startingLevel = this.state.level;
      const applied = cfg.adjustXPGain ? cfg.adjustXPGain(this.state.classId, this.state.level, amount) : amount;
      const playerName = player.identity.nickname || player.identity.name;

      this.state.xp += applied;
      let levels = 0;

      while (this.state.xp >= this.state.xpToLevel) {
        this.state.xp -= this.state.xpToLevel;
        this.state.level++;
        this.state.maxEnergy = calculateClassMaxEnergy(this.state.level, cfg.energyPerLevel);
        this.state.currentEnergy = Math.min(this.state.currentEnergy + cfg.energyPerLevel, this.state.maxEnergy);

        // recompute xpToLevel
        this.state.xpToLevel = Math.floor(cfg.baseXP * Math.pow(this.state.level, cfg.scaling));

        console.log(`[CLASS XP] ${this.state.name} ${playerName} reached level ${this.state.level}`);
        if (cfg.levelAnnouncements.includes(this.state.level)) {
          messages.broadcast(`(\n${this.state.name} ${playerName}\nHas reached level ${this.state.level}`);
        }

        if (this.state.level >= maxLevel) {
          this.state.level = maxLevel;
          this.state.xp = 0;
          levels = this.state.level - startingLevel;
          break;
        }

        levels++;
      }

      return levels;
    },

    info() { return { classId: this.state.classId, name: this.state.name, level: this.state.level, xp: this.state.xp, xpToLevel: this.state.xpToLevel }; },

    printClassInfo() {
      if (this.state.classId === -1) {
        const pname = player?.identity?.nickname ?? player?.identity?.name ?? "<unknown>";
        console.log(`ERROR: ${pname} failed class info print: no class selected`);
        return `(ERROR: you haven't selected a class yet`;
      }

      let aux = `(\nGeneral class info:\n|| ${this.state.name} ||\n|| Level ${this.state.level}, XP: ${this.state.xp}/${this.state.xpToLevel}, Energy: ${this.state.currentEnergy}/${this.state.maxEnergy} ||\n`;
      const desc = (this.state as any).description;
      if (desc) aux += `-> ${desc}\n`;
      aux += `|| Skills: `;

      const skillsModule = player?.tryGet<any>("skills");
      const skills = skillsModule?.state?.skills ?? [];
      for (const skill of skills) {
        aux += ` ${skill.skillName} Lv[${skill.skillLevel}] `;
      }

      aux += `||\nFor more skill info use [/bot skills]`;
      messages.whisper(player.identity.id, aux);
    }
  };

  return mod;
}
