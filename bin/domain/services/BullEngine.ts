import { MessagePort } from "../ports/MessagePort";
import { DomainEventBus } from "../ports/DomainEvenPort";
import { bullDialog } from "../../dialog/bullDialog";
import { BullProgressEvent } from "../moduleTypes/Bull.types";
import { BullModule } from "../modules/bull";
import { PlayerCore } from "../core/PlayerCore";

type SkillUsedPayload = {
  playerId: number;
  skillName: string;
  reward?: number;
  success?: boolean;
};

type PlayerGetter = (id: number) => PlayerCore | undefined;

export class BullEngine {
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
        const info = bull.fail();
        this.handleFailMessages(payload.playerId, bull, info);
      } else {
        const amount = this.computeChargeDelta(payload.reward);
        const info = bull.addCharge(amount);
        this.handleChargeMessages(payload.playerId, bull, info);
      }
      this.publishProgress(payload.playerId, bull);
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

  private computeChargeDelta(reward?: number): number {
    const base = reward ?? 0;
    if (base <= 0) return 5;
    return Math.min(25, Math.max(5, Math.floor(base / 5)));
  }

  private handleChargeMessages(playerId: number, bull: BullModule, info: { progressed: number; becameReady: boolean }) {
    const state = bull.state;
    const cap = this.energyCap(bull);
    if (info.becameReady) {
      this.messages.whisper(playerId, bullDialog.status.chargeReady);
      return;
    }
    const progress = state.energy / cap;
    if (progress === 0) {
      this.messages.whisper(playerId, bullDialog.status.silent);
    } else if (progress >= 0.75) {
      this.messages.whisper(playerId, bullDialog.clues.nearReady);
    } else if (progress >= 0.5) {
      this.messages.whisper(playerId, bullDialog.clues.halfway);
    } else if (progress >= 0.25) {
      this.messages.whisper(playerId, bullDialog.clues.starting);
    }
  }

  private handleFailMessages(playerId: number, bull: BullModule, info: { fromReady: boolean }) {
    if (info.fromReady) {
      this.messages.whisper(playerId, bullDialog.status.failFromReady);
    } else {
      this.messages.whisper(playerId, bullDialog.status.failWeak);
    }
    const cap = this.energyCap(bull);
    const progress = bull.state.energy / cap;
    if (progress === 0) {
      this.messages.whisper(playerId, bullDialog.status.silent);
    } else if (progress >= 0.75) {
      this.messages.whisper(playerId, bullDialog.clues.nearReady);
    } else if (progress >= 0.5) {
      this.messages.whisper(playerId, bullDialog.clues.halfway);
    } else if (progress >= 0.25) {
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
