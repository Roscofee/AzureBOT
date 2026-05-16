import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";
import { createSkill } from "../skills/SkillRegistry";

type SkillPricingCfg = {
  skill?: {
    globalMultiplier?: number;
    overrides?: Partial<Record<number, number>>;
  };
  skillMaxLevel?: (skillId?: number) => number;
};

export class SkillUpgradeService {
  constructor(private repo: PlayerRepo, private messages: MessagePort, private pricingCfg?: SkillPricingCfg) {}

  private calcPrice(raw: number, skillId: number): number {
    const override = this.pricingCfg?.skill?.overrides?.[skillId];
    if (override !== undefined) return override;
    const mult = this.pricingCfg?.skill?.globalMultiplier ?? 1.0;
    return Math.round(raw * mult);
  }

  /** Show current skills and their upgrade prices. */
  openUpgradeList(player: PlayerCore) {
    const skills = player.tryGet<any>("skills");
    const economy = player.tryGet<any>("economy");
    if (!skills || !economy) {
      this.messages.whisper(player.identity.id, "(ERROR: missing modules)");
      return;
    }

    const cur = economy.state.currency;
    let msg = `("\nYour current class skills available for upgrade:\n\nYou can upgrade a skill with /bot skillUpgrade <skill name>\n\nCurrent balance: ${cur} ACs\n`;
    for (const s of skills.state.skills) {
      const base = 1000 * (s.skillLevel ?? 1);
      const price = this.calcPrice(base, s.skillId);
      msg += `|| ${s.skillName} [Level ${s.skillLevel}], Price: ${price} Ac ||\n-> ${s.upgrade_description}\n`;
    }
    this.messages.whisper(player.identity.id, msg);
  }

  /** Upgrade a skill by name and reload the player's skill list. */
  async upgrade(player: PlayerCore, skillName: string | undefined) {
    if (!skillName) {
      this.messages.whisper(player.identity.id, "(ERROR: empty argument)");
      return;
    }
    const classing = player.tryGet<any>("classing");
    const economy = player.tryGet<any>("economy");
    const skillsModule = player.tryGet<any>("skills");
    if (!classing || !economy || !skillsModule) {
      this.messages.whisper(player.identity.id, "(ERROR: missing modules)");
      return;
    }

    const skill = skillsModule.state.skills.find((s: any) => String(s.skillName).toLowerCase() === String(skillName).toLowerCase());
    if (!skill) {
      let aux = "(\nSkill not found!\n\nYou must write the exact skill name\nYour options are:\n\n";
      for (const s of skillsModule.state.skills) aux += `${s.skillName}\n`;
      this.messages.whisper(player.identity.id, aux);
      return;
    }

    const curLevel = skill.skillLevel ?? 0;
    const maxLevel = this.pricingCfg?.skillMaxLevel?.(skill.skillId) ?? 10;
    if (curLevel >= maxLevel) {
      this.messages.whisper(player.identity.id, `(: ${skill.skillName} is already at max level ${maxLevel})`);
      return;
    }

    const base = 1000 * (curLevel || 1);
    const price = this.calcPrice(base, skill.skillId);
    if (economy.balance() < price) {
      this.messages.whisper(player.identity.id, "(==== \n ERROR: INSUFFICENT FUNDS \n ====");
      return;
    }

    const newLevel = (skill.skillLevel ?? 0) + 1;
    try {
      const newBalance = await this.repo.upgradeSkill(
        player.identity.id,
        skill.skillId,
        price,
        curLevel,
        newLevel,
      );
      economy.state.currency = newBalance;
      this.messages.whisper(player.identity.id, `(Balance updated: ${newBalance} ACs)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "INSUFFICIENT_FUNDS") {
        this.messages.whisper(player.identity.id, "(==== \n ERROR: INSUFFICENT FUNDS \n ====");
        return;
      }
      if (msg === "STALE_SKILL_LEVEL") {
        this.messages.whisper(player.identity.id, "(==== \n ERROR: SKILL STATE CHANGED, TRY AGAIN \n ====");
        return;
      }
      this.messages.whisper(player.identity.id, "(==== \n ERROR: SKILL UPGRADE FAILED \n ====");
      throw err;
    }

    // Reload class skills
    const fresh = await this.repo.obtainPlayerCurrentSkillsFromClass(player.identity.id, classing.state.classId);
    skillsModule.state.skills = [];
    for (const s of fresh) {
      const sk = createSkill({
        skillId: s.skill_id,
        skillName: s.skill_name,
        skillLevel: s.skill_level,
        description: s.skill_description,
        upgrade_description: s.upgrade_description,
      });
      if (sk) skillsModule.add(sk);
    }

    // Ensure skills are sorted by priority after reload
    if (Array.isArray(skillsModule.state.skills)) {
      skillsModule.state.skills.sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    this.messages.whisper(player.identity.id, "(==== \n SKILL UPGRADE SUCCESFUL \n ====");
  }
}
