import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { DomainEvent } from "../ports/DomainEvenPort";
import { SkillLogModule, SkillUseEntry } from "./skillLog";

export type MomentumState = {
  stacks: number;
  maxStacks: number;
  spentThisShift: number;
  allyTriggersThisShift: number;
  perfectFormUsesLeft: number;
  spotterUsedThisShift: boolean;
};

export type MomentumConfig = {
  trackedClassName?: string;
  unlockLevel?: number;
  primerSkills?: string[];
  payoffSkills?: string[];
  successfulOutcomes?: SkillUseEntry["outcome"][];
};

export type MomentumModule = PlayerModule & {
  key: "momentum";
  state: MomentumState;
  gain(amount?: number): number;
  spend(amount?: number): number;
  setMaxStacks(maxStacks: number): void;
  has(amount?: number): boolean;
  atCap(): boolean;
  lastSuccessfulSkills(n?: number, predicate?: (entry: SkillUseEntry) => boolean): SkillUseEntry[];
  endsWithSuccessfulPattern(pattern: string[], predicate?: (entry: SkillUseEntry) => boolean): boolean;
  markSpotterUsed(used?: boolean): void;
  setPerfectFormUses(uses: number): void;
  consumePerfectFormUse(): number;
  resetShift(): void;
};

export function createMomentumModule(
  initial?: Partial<MomentumState>,
  config?: MomentumConfig,
): MomentumModule {
  let player: PlayerCore | undefined;
  let unsubscribers: Array<() => void> = [];

  const state: MomentumState = {
    stacks: Math.max(0, initial?.stacks ?? 0),
    maxStacks: Math.max(1, initial?.maxStacks ?? 3),
    spentThisShift: Math.max(0, initial?.spentThisShift ?? 0),
    allyTriggersThisShift: Math.max(0, initial?.allyTriggersThisShift ?? 0),
    perfectFormUsesLeft: Math.max(0, initial?.perfectFormUsesLeft ?? 0),
    spotterUsedThisShift: initial?.spotterUsedThisShift ?? false,
  };

  const trackedClassName = config?.trackedClassName ?? "Volunteer";
  const unlockLevel = Math.max(1, config?.unlockLevel ?? 11);
  const primerSkills = new Set(config?.primerSkills ?? ["Focus", "SteadySelf", "Brace"]);
  const payoffSkills = new Set(config?.payoffSkills ?? ["Moo", "LiftChest", "HeavyLift"]);
  const successfulOutcomes = new Set(config?.successfulOutcomes ?? ["success", "critical"]);

  const getSkillLog = (): SkillLogModule | undefined => player?.tryGet<SkillLogModule>("skillLog");
  const isTrackedClass = (): boolean => {
    const classing = player?.tryGet<any>("classing");
    return classing?.state?.name === trackedClassName;
  };
  const isUnlocked = (): boolean => {
    const classing = player?.tryGet<any>("classing");
    return (classing?.state?.level ?? 0) >= unlockLevel;
  };

  const clampStacks = () => {
    state.stacks = Math.max(0, Math.min(state.maxStacks, state.stacks));
  };

  return {
    key: "momentum",
    state,
    onAttach(p) {
      player = p;
      clampStacks();
      unsubscribers.push(player.ctx.bus.subscribe("player:skill.used", (evt: DomainEvent) => {
        const payload = evt.payload as {
          playerId: number;
          skillName?: string;
          outcome?: SkillUseEntry["outcome"];
        };

        if (!player || payload?.playerId !== player.identity.id) return;
        if (!isTrackedClass()) return;
        if (!isUnlocked()) return;

        const skillName = payload.skillName ?? "";
        const outcome = payload.outcome ?? "success";
        if (!successfulOutcomes.has(outcome)) return;

        if (!payoffSkills.has(skillName)) return;

        const recent = getSkillLog()?.lastSuccessfulSkills(2) ?? [];
        const previousSkill = recent.length >= 2 ? recent[recent.length - 2]?.skillName : undefined;
        if (!previousSkill || !primerSkills.has(previousSkill)) return;

        this.gain(1);
      }));
      unsubscribers.push(player.ctx.bus.subscribe("facility:shift.tick", () => {
        this.resetShift();
      }));
    },
    onDetach() {
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers = [];
    },
    gain(amount = 1) {
      const previousStacks = state.stacks;
      state.stacks += Math.max(0, amount);
      clampStacks();
      const gained = state.stacks - previousStacks;
      if (gained > 0 && player) {
        player.ctx.bus.publish({
          type: "facility:message.whisper",
          payload: {
            playerId: player.identity.id,
            text: `(Momentum +${gained}: ${state.stacks}/${state.maxStacks})`,
          },
        });
      }
      return state.stacks;
    },
    spend(amount = 1) {
      const safeAmount = Math.max(0, amount);
      const spent = Math.min(state.stacks, safeAmount);
      state.stacks -= spent;
      state.spentThisShift += spent;
      return spent;
    },
    setMaxStacks(maxStacks) {
      state.maxStacks = Math.max(1, maxStacks);
      clampStacks();
    },
    has(amount = 1) {
      return state.stacks >= Math.max(0, amount);
    },
    atCap() {
      return state.stacks >= state.maxStacks;
    },
    lastSuccessfulSkills(n = 10, predicate) {
      return getSkillLog()?.lastSuccessfulSkills(n, predicate) ?? [];
    },
    endsWithSuccessfulPattern(pattern, predicate) {
      return getSkillLog()?.endsWithSuccessfulPattern(pattern, predicate) ?? false;
    },
    markSpotterUsed(used = true) {
      state.spotterUsedThisShift = used;
    },
    setPerfectFormUses(uses) {
      state.perfectFormUsesLeft = Math.max(0, uses);
    },
    consumePerfectFormUse() {
      if (state.perfectFormUsesLeft <= 0) return 0;
      state.perfectFormUsesLeft -= 1;
      return state.perfectFormUsesLeft;
    },
    resetShift() {
      state.stacks = 0;
      state.spentThisShift = 0;
      state.allyTriggersThisShift = 0;
      state.perfectFormUsesLeft = 0;
      state.spotterUsedThisShift = false;
    },
  };
}
