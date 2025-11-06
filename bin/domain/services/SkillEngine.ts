import { PlayerCore } from "../core/PlayerCore";
import { ClassingModule } from "../modules/classing";
import { ScoringModule } from "../modules/scoring";
import { SkillsModule} from "../modules/skills";
import { IncomingMessage } from "../ports/MessagePort";
import { AnyModifier, Skill, SkillEffect } from "../skills/Skill.types";

export class SkillEngine {
  processToken(player: PlayerCore, data: IncomingMessage): string {
    const skillsMod  = player.get<SkillsModule>("skills");
    const classing   = player.tryGet<ClassingModule>("classing");
    const scoring    = player.tryGet<ScoringModule>("scoring");

    const skills = skillsMod.list();
    const mods   = skillsMod.state.activeModifiers;

    let used = false;
    for (const skill of skills) {
      if (!skill.validInput(data)) continue;

      const baseEnergy = skill.energyCost ?? 0;
      const effEnergy  = this.applyEnergyModifiers(skill, baseEnergy, mods);

      // energy check against classing (or another energy source)
      if (!classing || classing.state.currentEnergy < effEnergy) continue;
      if (!skill.canExecute(player)) continue;

      // compute base
      const base = skill.use(player); // PURE
      const finalReward = this.applyRewardModifiers(skill, base.reward ?? 0, mods);
      const finalEffects = this.applyEffectModifiers(skill, base.effects ?? [], mods, player);

      // commit: spend energy
      classing.state.currentEnergy -= effEnergy;

      // commit: reward (commits to scoring)
      if (scoring && finalReward > 0) scoring.addCycleScore(Math.floor(finalReward));

      // commit: apply effects to modules
      for (const e of finalEffects) this.applyEffect(player, e);

      used = true;
      // you can return a message per skill use if you want
      return `(You used ${skill.skillName}, energy: ${effEnergy}, reward: ${finalReward.toFixed(2)})`;
    }

    return used ? "" : "NonSkill";
  }

  private applyEnergyModifiers(skill: Skill, energy: number, mods: SkillsModule["state"]["activeModifiers"]) {
    let e = energy;
    for (const m of mods) {
      if (!this.appliesTo(skill, m)) continue;
      if (m.energyCostMultiplier != null) e = Math.ceil(e * m.energyCostMultiplier);
    }
    return e;
  }

  private applyRewardModifiers(skill: Skill, reward: number, mods: SkillsModule["state"]["activeModifiers"]) {
    let r = reward;
    for (const m of mods) {
      if (!this.appliesTo(skill, m)) continue;
      if (m.rewardMultiplier != null) r = Math.floor(r * m.rewardMultiplier);
    }
    return r;
  }

  private applyEffectModifiers(
    skill: Skill,
    effects: SkillEffect[],
    mods: AnyModifier[],
    player: PlayerCore
  ): SkillEffect[] {
    let out = effects.slice();
    for (const m of mods) {
      if (!this.appliesTo(skill, m) || !m.transformEffect) continue;
      out = out
        .map(e => m.transformEffect!(e, { player, skillName: skill.skillName }))
        .filter((e): e is SkillEffect => e != null);
    }
    return out;
  }

  private appliesTo(skill: Skill, m: { skillWhitelist?: string[]; skillBlacklist?: string[] }) {
    if (m.skillWhitelist && !m.skillWhitelist.includes(skill.skillName)) return false;
    if (m.skillBlacklist && m.skillBlacklist.includes(skill.skillName)) return false;
    return true;
  }

  /** Map effects → module mutations (centralized, testable) */
  private applyEffect(player: PlayerCore, e: SkillEffect) {
    switch (e.type) {
      case "QUALITY_ADJUST": {
        const q = player.tryGet<any>("quality");
        if (q) q.adjust(e.delta); // your QualityModule API
        break;
      }
      case "QUALITY_SET": {
        const q = player.tryGet<any>("quality");
        if (q) q.set(e.value);
        break;
      }
      case "BULL_CHARGE": {
        const b = player.tryGet<any>("bull");
        if (b) b.charge(e.delta);
        break;
      }
      case "SCORING_BONUS": {
        const s = player.tryGet<any>("scoring");
        if (s) s.addShiftProduction(e.delta);
        break;
      }
      case "EMIT_EVENT": {
        player.ctx.bus.publish(e.event);
        break;
      }
      default:
        // ignore unknown effect types to be forward-compatible
        break;
      }
  }
}
