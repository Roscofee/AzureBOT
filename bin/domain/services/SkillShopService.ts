import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";
import { createSkill } from "../skills/SkillRegistry";

type SkillPricingCfg = {
  skill?: {
    globalMultiplier?: number;
    overrides?: Partial<Record<number, number>>;
  };
};

export class SkillShopService {
  constructor(private repo: PlayerRepo, private messages: MessagePort, private pricingCfg?: SkillPricingCfg) {}

  private calcPrice(raw: number, skillId: number): number {
    const override = this.pricingCfg?.skill?.overrides?.[skillId];
    if (override !== undefined) return override;
    const mult = this.pricingCfg?.skill?.globalMultiplier ?? 1.0;
    return Math.round(raw * mult);
  }

  /** Show purchasable skills for the player's current class. */
  async openShop(player: PlayerCore) {
    const classing = player.tryGet<any>("classing");
    if (!classing) {
      this.messages.whisper(player.identity.id, "(ERROR: no class selected)");
      return;
    }
    const list = await this.repo.obtainPlayerClassSkillShop(player.identity.id, classing.state.classId);
    if (!list || list.length === 0) {
      this.messages.whisper(player.identity.id, "(No skills to purchase!)");
      return;
    }

    let msg = "(\nSkills available for purchase:\n\nYou can purchase a skill with /bot buySkill [skill name]\n\n";
    for (const s of list) {
      let req = `|| Requires: class level ${s.class_level_req}`;
      if (s.previous_skill_id) req += `, ${s.previous_skill_name} lv(${s.previous_skill_level_req})`;
      const price = this.calcPrice(s.price as number, s.skill_id);
      msg += `|| ${s.skill_name}, Price: ${price} Ac ||\n${req} ||\n-> ${s.skill_description}\n`;
    }
    this.messages.whisper(player.identity.id, msg);
  }

  /** Purchase a skill by exact name (case-insensitive). */
  async buy(player: PlayerCore, skillName: string | undefined) {
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

    const list = await this.repo.obtainPlayerClassSkillShop(player.identity.id, classing.state.classId);
    if (!list || list.length === 0) {
      this.messages.whisper(player.identity.id, "(No skills to purchase!)");
      return;
    }

    const candidate = list.find((s: any) => String(s.skill_name).toLowerCase() === String(skillName).toLowerCase());
    if (!candidate) {
      let aux = "(\nSkill not found!\n\nYou must write the exact skill name\nYour options are:\n\n";
      for (const s of list) aux += `${s.skill_name}\n`;
      this.messages.whisper(player.identity.id, aux);
      return;
    }

    // Requirements
    if (classing.state.level < candidate.class_level_req) {
      this.messages.whisper(player.identity.id, `(: skill ${candidate.skill_name} requires class level ${candidate.class_level_req})`);
      return;
    }
    if (candidate.previous_skill_id) {
      const have = skillsModule.state.skills.find((s: any) => s.skillId === candidate.previous_skill_id);
      if (!have) {
        this.messages.whisper(player.identity.id, `(: You must purchase ${candidate.previous_skill_name} first!)`);
        return;
      }
      if (have.skillLevel < candidate.previous_skill_level_req) {
        this.messages.whisper(player.identity.id, `(: You must have ${candidate.previous_skill_name} on level ${candidate.previous_skill_level_req} first!)`);
        return;
      }
    }

    // Price & spend
    const price = this.calcPrice(candidate.price as number, candidate.skill_id);
    if (!economy.spend(price)) {
      this.messages.whisper(player.identity.id, "(==== \n ERROR: INSUFFICENT FUNDS \n ====")
      return;
    }

    await this.repo.assignSkillToPlayer(player.identity.id, candidate.skill_id);

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

    this.messages.whisper(player.identity.id, "(==== \n SKILL PURCHASE SUCCESFUL \n ====");
  }
}
