import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";
import { createSkill } from "../skills/SkillRegistry";

export class ClassSelectionService {
  constructor(private repo: PlayerRepo, private messages: MessagePort) {}

  /**
   * Load player's available classes (filtered by optional accepted names) and whisper a summary.
   */
  async listPlayerClasses(player: PlayerCore, acceptedNames: string[] = []) {
    const classes = await this.repo.obtainPlayerClass(player.identity.id, acceptedNames);
    if (!classes || classes.length === 0) {
      this.messages.whisper(player.identity.id, "(No classes available)");
      return;
    }

    let msg = "(\nYou can select a class with /bot select <ClassName>\n\nYour available classes are:\n";
    for (const c of classes) {
      msg += `|| ${c.class_name} (Level ${c.class_level}) ||\n-> ${c.class_description}\n`;
    }
    this.messages.whisper(player.identity.id, msg);
  }

  /**
   * Select a class by id or name; updates classing and skills modules and persists progress.
   */
  async select(player: PlayerCore, classIdentifier: number | string, acceptedNames: string[] = []) {
    const classes = await this.repo.obtainPlayerClass(player.identity.id, acceptedNames);
    const sel = classes.find((c: any) =>
      typeof classIdentifier === "number"
        ? c.class_id === classIdentifier
        : String(c.class_name).toLowerCase() === String(classIdentifier).toLowerCase()
    );
    if (!sel) {
      this.messages.whisper(player.identity.id, "(ERROR: class not found)");
      return;
    }

    // Update classing module state
    const classing = player.get<any>("classing");
    classing.state.classId = sel.class_id;
    classing.state.name = sel.class_name;
    classing.state.level = sel.class_level ?? 1;
    classing.state.xp = sel.class_exp ?? 0;
    // recompute xpToLevel (mirror defaults)
    classing.state.xpToLevel = Math.floor(100 * Math.pow(classing.state.level || 1, 1.5));
    classing.state.maxEnergy = sel.class_energy ?? classing.state.maxEnergy ?? 0;
    classing.state.currentEnergy = classing.state.maxEnergy;

    // Load current class skills from repo
    const skillsModule = player.get<any>("skills");
    const skills = await this.repo.obtainPlayerCurrentSkillsFromClass(player.identity.id, classing.state.classId);
    skillsModule.state.skills = [];
    for (const s of skills) {
      const skill = createSkill({
        skillId: s.skill_id,
        skillName: s.skill_name,
        skillLevel: s.skill_level,
        description: s.skill_description,
        upgrade_description: s.upgrade_description,
      });
      if (skill) skillsModule.add(skill);
    }

    // Persist class progress snapshot
    await this.repo.updateClassProgress({
      playerId: player.identity.id,
      classId: classing.state.classId,
      level: classing.state.level,
      xp: classing.state.xp,
      bestScore: 0,
      score: 0,
      energy: classing.state.maxEnergy,
    });

    const info = `(:: Class '${classing.state.name}' selected. Level ${classing.state.level}, XP ${classing.state.xp}/${classing.state.xpToLevel}, Energy ${classing.state.currentEnergy}/${classing.state.maxEnergy})`;
    this.messages.whisper(player.identity.id, info);
  }
}

