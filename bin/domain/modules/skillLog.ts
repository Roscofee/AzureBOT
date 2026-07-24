import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";
import { SkillOutcome } from "../skills/Skill.types";

export type SkillUseEntry = {
  skillName: string;
  energySpent: number;
  reward: number;
  outcome: SkillOutcome;
  shiftNumber: number;
  logPayload?: Record<string, unknown>;
};

export type SkillLogModule = PlayerModule & {
  key: "skillLog";
  log: SkillUseEntry[];
  add(entry: SkillUseEntry): void;
  recent(n?: number): SkillUseEntry[];
  lastSuccessfulSkills(n?: number, predicate?: (entry: SkillUseEntry) => boolean): SkillUseEntry[];
  endsWithSuccessfulPattern(pattern: string[], predicate?: (entry: SkillUseEntry) => boolean): boolean;
  getShiftNumber(): number;
  clear(): void;
};

export function createSkillLogModule(): SkillLogModule {
  let player: PlayerCore | undefined;
  let unsubscribers: Array<() => void> = [];
  let currentShiftNumber = 0;

  const mod: SkillLogModule = {
    key: "skillLog",
    log: [],
    onAttach(p) {
      player = p;
      // listen for skill-used events for this player
      unsubscribers.push(player.ctx.bus.subscribe("player:skill.used", (evt: DomainEvent) => {
        const payload = evt.payload as { playerId: number } & Partial<SkillUseEntry>;
        if (!player || payload?.playerId !== player.identity.id) return;
        this.add({
          skillName: payload.skillName ?? "<unknown>",
          energySpent: payload.energySpent ?? 0,
          reward: payload.reward ?? 0,
          outcome: payload.outcome ?? "success",
          shiftNumber: payload.shiftNumber ?? currentShiftNumber,
          logPayload: payload.logPayload
        });
      }));
      unsubscribers.push(player.ctx.bus.subscribe("facility:shift.tick", () => {
        currentShiftNumber += 1;
      }));
    },
    onDetach() {
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers = [];
    },
    add(entry) {
      this.log.push({
        ...entry,
        shiftNumber: entry.shiftNumber ?? currentShiftNumber,
      });
    },
    recent(n = 10) { return this.log.slice(-n); },
    lastSuccessfulSkills(n = 10, predicate) {
      const matches: SkillUseEntry[] = [];

      for (let index = this.log.length - 1; index >= 0 && matches.length < n; index -= 1) {
        const entry = this.log[index];
        if (entry.outcome !== "success" && entry.outcome !== "critical") continue;
        if (predicate && !predicate(entry)) continue;
        matches.push(entry);
      }

      return matches.reverse();
    },
    endsWithSuccessfulPattern(pattern, predicate) {
      if (!pattern.length) return false;

      const entries = this.lastSuccessfulSkills(pattern.length, predicate);
      if (entries.length !== pattern.length) return false;

      return pattern.every((skillName, index) => entries[index].skillName === skillName);
    },
    getShiftNumber() { return currentShiftNumber; },
    clear() {
      this.log = [];
      currentShiftNumber += 1;
    },
  };
  return mod;
}
