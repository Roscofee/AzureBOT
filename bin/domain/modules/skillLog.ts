import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";

export type SkillUseEntry = {
  skillName: string;
  energySpent: number;
  reward: number;
  success: boolean;
  logPayload?: Record<string, unknown>;
};

export type SkillLogModule = PlayerModule & {
  key: "skillLog";
  log: SkillUseEntry[];
  add(entry: SkillUseEntry): void;
  recent(n?: number): SkillUseEntry[];
  clear(): void;
};

export function createSkillLogModule(): SkillLogModule {
  let player: PlayerCore | undefined;
  let unsubscribe: (() => void) | undefined;

  const mod: SkillLogModule = {
    key: "skillLog",
    log: [],
    onAttach(p) {
      player = p;
      // listen for skill-used events for this player
      unsubscribe = player.ctx.bus.subscribe("player:skill.used", (evt: DomainEvent) => {
        const payload = evt.payload as { playerId: number } & Partial<SkillUseEntry>;
        if (!player || payload?.playerId !== player.identity.id) return;
        this.add({
          skillName: payload.skillName ?? "<unknown>",
          energySpent: payload.energySpent ?? 0,
          reward: payload.reward ?? 0,
          success: payload.success ?? true,
          logPayload: payload.logPayload
        });
      });
    },
    onDetach() { unsubscribe?.(); },
    add(entry) { this.log.push(entry); },
    recent(n = 10) { return this.log.slice(-n); },
    clear() { this.log = []; },
  };
  return mod;
}
