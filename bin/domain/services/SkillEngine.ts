import { PlayerCore } from "../core/PlayerCore";
import { ClassingModule } from "../modules/classing";
import { ScoringModule } from "../modules/scoring";
import { SkillsModule} from "../modules/skills";
import { IncomingMessage } from "../ports/MessagePort";
import { AnyModifier, Skill, SkillEffect } from "../skills/Skill.types";

export class SkillEngine {
  /**
   * Try to execute every skill that matches the incoming message, in priority order.
   * Notes:
   * - Skills are already sorted by priority in the SkillsModule.
   * - Energy is checked per skill; failure to afford one skill does not block others.
   * - Stops only after all eligible skills are processed, returning concatenated feedback.
   */
  processToken(player: PlayerCore, data: IncomingMessage): string {
    const skillsMod  = player.get<SkillsModule>("skills");
    const classing   = player.tryGet<ClassingModule>("classing");
    const scoring    = player.tryGet<ScoringModule>("scoring");

    const skills = skillsMod.list();
    const mods   = skillsMod.state.activeModifiers;

    const warnings: string[] = [];
    const messages: string[] = [];

    for (const skill of skills) {
      if (!skill.validInput(data)) continue;

      const baseEnergy = typeof (skill as any).computeEnergy === "function"
        ? (skill as any).computeEnergy(player)
        : (skill.energyCost ?? 0);
      const effEnergy  = this.applyEnergyModifiers(skill, baseEnergy, mods);

      // energy check against classing (or another energy source)
      if (!classing || classing.state.currentEnergy < effEnergy) {
        if (classing && classing.state.currentEnergy < effEnergy) {
          warnings.push(`Not enough energy to use ${skill.skillName}. Need ${effEnergy}, you have ${classing.state.currentEnergy})`);
        }
        continue;
      }
      if (!skill.canExecute(player)) continue;

      // compute base
      const base = skill.use(player); // PURE
      const finalReward = this.applyRewardModifiers(skill, base.reward ?? 0, mods);
      const finalEffects = this.applyEffectModifiers(skill, base.effects ?? [], mods, player);
      this.consumeAppliedModifiers(skill, skillsMod);

      //Skill use event publication, to be used for SkillLog or other modules
      const success = base.success ?? true;
      player.ctx.bus.publish({
        type: "player:skill.used",
        payload: {
          playerId: player.identity.id,
          skillName: skill.skillName,
          energySpent: effEnergy,
          reward: finalReward,
          success,
          ...(base.logPayload ?? {})
        },
      });

      // commit: spend energy
      classing.state.currentEnergy -= effEnergy;

      // commit: reward (commits to scoring)
      // Negative rewards are valid for penalty skills such as GasIntake failures.
      if (scoring && finalReward !== 0) scoring.addCycleScore(Math.floor(finalReward));

      // commit: apply effects to modules
      for (const e of finalEffects) this.applyEffect(player, e);

      // collect per-skill feedback
      messages.push(`You used ${skill.skillName}, energy cost: ${effEnergy}, reward: ${finalReward.toFixed(2)})`);
      if (base.feedback?.length) messages.push(...base.feedback);
    }

    if (messages.length > 0 || warnings.length > 0) return [...messages, ...warnings].join("\n");
    return "NonSkill";
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

   /** Map effects → publish only; keep engine game-agnostic */
  private applyEffect(player: PlayerCore, e: SkillEffect) {
    if (e.type === "EMIT_EVENT") {
      player.ctx.bus.publish(e.event);
    }
  }

  private consumeAppliedModifiers(skill: Skill, skillsMod: SkillsModule) {
    const kept: SkillsModule["state"]["activeModifiers"] = [];
    for (const modifier of skillsMod.state.activeModifiers) {
      if (modifier.usesRemaining != null && this.appliesTo(skill, modifier)) {
        const remaining = modifier.usesRemaining - 1;
        if (remaining > 0) kept.push({ ...modifier, usesRemaining: remaining });
        continue;
      }
      kept.push(modifier);
    }
    skillsMod.state.activeModifiers = kept;
  }
}
