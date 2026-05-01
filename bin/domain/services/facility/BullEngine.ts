import { MessagePort } from "../../ports/MessagePort";
import { DomainEventBus } from "../../ports/DomainEvenPort";
import { bullDialog } from "../../../dialog/bullDialog";
import { BullProgressEvent } from "../../moduleTypes/Bull.types";
import { BullModule } from "../../modules/bull";
import { ScoringModule } from "../../modules/scoring";
import { PlayerCore } from "../../core/PlayerCore";

type SkillUsedPayload = {
  playerId: number;
  skillName: string;
  reward?: number;
  success?: boolean;
};

type BullRewardPayload = {
  playerId?: number;
  charge?: number;
  workstationId?: number;
  source?: string;
};

type PlayerGetter = (id: number) => PlayerCore | undefined;
type BullStage = "silent" | "starting" | "halfway" | "nearReady" | "ready" | "none";

export class BullEngine {
  private lastAnnouncedStage = new Map<number, BullStage>();

  constructor(
    private bus: DomainEventBus,
    private messages: MessagePort,
    private getPlayer: PlayerGetter
  ) {
    this.bus.subscribe("player:skill.used", (evt) => {
      const payload = evt.payload as SkillUsedPayload;
      if (typeof payload?.playerId !== "number") return;
      const bull = this.getBull(payload.playerId);
      if (!bull) return;
      if (payload.success === false) {
        bull.removeCharge(5);
      } else {
        const info = bull.addCharge(5);
        this.handleChargeMessages(payload.playerId, bull, info);
      }
      this.publishProgress(payload.playerId, bull);
    });

    this.bus.subscribe("player:climax.orgasm", (evt) => {
      const payload = evt.payload as { playerId?: number; bullState?: { ready?: boolean } };
      const pid = payload?.playerId;
      if (typeof pid !== "number") return;
      const player = this.getPlayer(pid);
      const bull = player?.tryGet<BullModule>("bull");
      if (!bull) return;
      const ready = payload?.bullState?.ready ?? bull.getState().ready;
      if (ready) {
        const res = bull.consume();
        if (res.consumed) {
          this.lastAnnouncedStage.delete(pid);
          this.messages.whisper(pid, bullDialog.consume.release);
        }
        const scoring = player?.tryGet<ScoringModule>("scoring");
        if (scoring) scoring.state.sessionScore += 20;
      } else {
        const info = bull.fail();
        this.handleFailMessages(pid, bull, info);
      }
      this.publishProgress(pid, bull, { source: ready ? "climax.orgasm.ready" : "climax.orgasm.notReady" });
    });

    this.bus.subscribe("player:climax.resist", (evt) => {
      const payload = evt.payload as { playerId?: number; bullState?: { ready?: boolean } };
      const pid = payload?.playerId;
      if (typeof pid !== "number") return;
      const player = this.getPlayer(pid);
      const bull = player?.tryGet<BullModule>("bull");
      if (!bull) return;
      const ready = payload?.bullState?.ready ?? bull.getState().ready;
      if (ready) {
        const info = bull.fail();
        this.handleFailMessages(pid, bull, info);
      } else {
        const info = bull.addCharge(10);
        this.handleChargeMessages(pid, bull, info);
      }
      this.publishProgress(pid, bull, { source: ready ? "climax.resist.ready" : "climax.resist.notReady" });
    });

    this.bus.subscribe("player:bull.reward", (evt) => {
      const payload = evt.payload as BullRewardPayload;
      const pid = payload?.playerId;
      if (typeof pid !== "number") return;
      const bull = this.getBull(pid);
      if (!bull) return;

      const amount = typeof payload.charge === "number" ? Math.max(0, Math.floor(payload.charge)) : 0;
      if (amount <= 0) return;

      const info = bull.addCharge(amount);
      this.handleChargeMessages(pid, bull, info);
      this.publishProgress(pid, bull, {
        source: payload.source ?? "player:bull.reward",
        workstationId: payload.workstationId,
        charge: amount,
      });
    });

    this.bus.subscribe("facility:shift.tick", (evt) => {
      const payload = evt.payload as { players?: number[] };
      for (const pid of payload?.players ?? []) {
        const bull = this.getBull(pid);
        if (!bull) continue;
        bull.tickShift();
        this.publishProgress(pid, bull);
      }
    });
  }

  consume(playerId: number, reason?: string) {
    const bull = this.getBull(playerId);
    if (!bull) return;
    const res = bull.consume();
    if (res.consumed) {
      this.lastAnnouncedStage.delete(playerId);
      this.messages.whisper(playerId, bullDialog.consume.release);
      this.publishProgress(playerId, bull, { reason, consumed: true });
    }
  }

  private getBull(playerId: number): BullModule | undefined {
    const player = this.getPlayer(playerId);
    if (!player) return;
    try {
      return player.get<BullModule>("bull");
    } catch {
      return;
    }
  }

  private handleChargeMessages(playerId: number, bull: BullModule, info: { progressed: number; becameReady: boolean }) {
    const stage = info.becameReady ? "ready" : this.getStage(bull);
    this.announceStage(playerId, stage);
  }

  private handleFailMessages(playerId: number, bull: BullModule, info: { fromReady: boolean }) {
    if (info.fromReady) {
      this.messages.whisper(playerId, bullDialog.status.failFromReady);
    } else {
      this.messages.whisper(playerId, bullDialog.status.failWeak);
    }
    this.announceStage(playerId, this.getStage(bull));
  }

  private getStage(bull: BullModule): BullStage {
    const cap = this.energyCap(bull);
    if (bull.state.ready) return "ready";
    const progress = cap > 0 ? bull.state.energy / cap : 0;
    if (progress === 0) return "silent";
    if (progress >= 0.75) return "nearReady";
    if (progress >= 0.5) return "halfway";
    if (progress >= 0.25) return "starting";
    return "none";
  }

  private announceStage(playerId: number, stage: BullStage) {
    const lastStage = this.lastAnnouncedStage.get(playerId);
    if (lastStage === stage) return;
    this.lastAnnouncedStage.set(playerId, stage);

    if (stage === "ready") {
      this.messages.whisper(playerId, bullDialog.status.chargeReady);
    } else if (stage === "silent") {
      this.messages.whisper(playerId, bullDialog.status.silent);
    } else if (stage === "nearReady") {
      this.messages.whisper(playerId, bullDialog.clues.nearReady);
    } else if (stage === "halfway") {
      this.messages.whisper(playerId, bullDialog.clues.halfway);
    } else if (stage === "starting") {
      this.messages.whisper(playerId, bullDialog.clues.starting);
    }
  }

  private energyCap(bull: BullModule): number {
    return bull.state.threshold + bull.modifiers.reduce((acc, m) => acc + (m.energyMaxBonus ?? 0), 0);
  }

  private publishProgress(playerId: number, bull: BullModule, logPayload?: Record<string, unknown>) {
    const evt: BullProgressEvent = {
      type: "bull:progress",
      payload: {
        playerId,
        state: { ...bull.state },
        logPayload,
      },
    };
    this.bus.publish(evt);
  }
}
