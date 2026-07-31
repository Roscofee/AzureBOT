import { PlayerCore } from "../core/PlayerCore";
import { ClassingModule } from "../modules/classing";
import { ModifierModule } from "../modules/modifiers";
import { ScoringModule } from "../modules/scoring";
import { SkillsModule } from "../modules/skills";
import { IncomingMessage } from "../ports/MessagePort";
import { SkillEffect, SkillOutcome } from "../skills/Skill.types";

export class SkillEngine {
  /**
   * Try to execute every skill that matches the incoming message, in priority order.
   * Notes:
   * - Skills are already sorted by priority in the SkillsModule.
   * - Energy is checked per skill; failure to afford one skill does not block others.
   * - Stops only after all eligible skills are processed, returning concatenated feedback.
   */
  processToken(player: PlayerCore, data: IncomingMessage): string {
    const skillsMod = player.get<SkillsModule>("skills");
    const modifiers = player.get<ModifierModule>("modifiers");
    const classing = player.tryGet<ClassingModule>("classing");
    const scoring = player.tryGet<ScoringModule>("scoring");

    const skills = skillsMod.list();
    const warnings: string[] = [];
    const messages: string[] = [];

    for (const skill of skills) {
      if (!skill.validInput(data)) continue;

      const resolveCtx = {
        playerId: player.identity.id,
        skillName: skill.skillName,
        actionType: "skillUse" as const,
      };

      const baseEnergy = typeof (skill as any).computeEnergy === "function"
        ? (skill as any).computeEnergy(player)
        : (skill.energyCost ?? 0);
      const resolvedEnergy = modifiers.resolveNumber("skill.energy", baseEnergy, resolveCtx);
      const effEnergy = baseEnergy > 0
        ? Math.max(10, resolvedEnergy)
        : resolvedEnergy;

      if (!classing || classing.state.currentEnergy < effEnergy) {
        if (classing && classing.state.currentEnergy < effEnergy) {
          warnings.push(`Not enough energy to use ${skill.skillName}. Need ${effEnergy}, you have ${classing.state.currentEnergy}`);
        }
        continue;
      }
      if (!skill.canExecute(player)) continue;

      const base = skill.use(player);
      const outcome: SkillOutcome = base.outcome ?? "success";
      const outcomeCtx = { ...resolveCtx, outcome };
      const finalReward = modifiers.resolveNumber("skill.reward", base.reward ?? 0, outcomeCtx);
      const finalEffects = modifiers.resolveEffects("skill.effect", base.effects ?? [], outcomeCtx);
      modifiers.consumeUses(outcomeCtx);

      player.ctx.bus.publish({
        type: "player:skill.used",
        payload: {
          playerId: player.identity.id,
          skillName: skill.skillName,
          energySpent: effEnergy,
          reward: finalReward,
          outcome,
          ...(base.logPayload ?? {}),
        },
      });

      classing.state.currentEnergy -= effEnergy;

      if (scoring && finalReward !== 0) scoring.addCycleScore(Math.floor(finalReward));

      for (const effect of finalEffects) this.applyEffect(player, effect);

      messages.push(`You used ${skill.skillName}, energy cost: ${effEnergy}, reward: ${finalReward.toFixed(2)}`);
      if (base.feedback?.length) messages.push(...base.feedback);
    }

    if (messages.length > 0 || warnings.length > 0) {
      const output = [...messages, ...warnings];
      output[output.length - 1] = `${output[output.length - 1]})`;
      return output.join("\n");
    }
    return "NonSkill";
  }

  /** Map effects -> publish only; keep engine game-agnostic */
  private applyEffect(player: PlayerCore, effect: SkillEffect) {
    if (effect.type === "EMIT_EVENT") {
      player.ctx.bus.publish(effect.event);
    }
  }
}
