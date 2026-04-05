import { MessagePort } from "../../../domain/ports/MessagePort";
import { DomainEventBus } from "../../../domain/ports/DomainEvenPort";
import { GlobalEventDef, globalEvents } from "./globalEvents";
import { QualityModifier } from "../../../domain/modules/quality";

export type ActiveGlobalEvent = GlobalEventDef & { remainingShifts: number };

type ApplyFn = (evt: GlobalEventDef, playerId?: number) => void;
type RemoveFn = (evt: GlobalEventDef) => void;

export class GlobalEventManager {
  private registry = new Map(globalEvents.map(e => [e.id, e]));
  private active: ActiveGlobalEvent[] = [];

  constructor(
    private messages: MessagePort,
    private bus: DomainEventBus,
    private applyEffects: ApplyFn,
    private removeEffects: RemoveFn
  ) {}

  listActive() { return this.active.slice(); }

  fireById(id: string, playerId?: number) {
    const def = this.registry.get(id);
    if (!def) return false;
    this.activate(def, playerId);
    return true;
  }

  fireNext() {
    const cand = this.pickNext();
    if (!cand) return null;
    this.activate(cand);
    return cand;
  }

  tickShift() {
    const still: ActiveGlobalEvent[] = [];
    for (const evt of this.active) {
      evt.remainingShifts -= 1;
      if (evt.remainingShifts <= 0) {
        this.removeEffects(evt);
        this.bus.publish({
          type: "quality:modifier",
          payload: { playerId: "*", modifier: { sourceId: evt.id } as QualityModifier, action: "remove" }
        });
        if (evt.onEndMessage) this.messages.broadcast(evt.onEndMessage);
      } else {
        still.push(evt);
      }
    }
    this.active = still;
  }

  private activate(def: GlobalEventDef, playerId?: number) {
    const active: ActiveGlobalEvent = { ...def, remainingShifts: def.durationShifts ?? 1 };
    this.active.push(active);
    this.applyEffects(active, playerId); // playerId can be undefined (global) or a number (personal)
    for (const qm of def.quality ?? []) {
      const shifts = qm.remainingShifts ?? def.durationShifts ?? 1;
      this.bus.publish({
        type: "quality:modifier",
        payload: {
          playerId: qm.playerId ?? "*",
          modifier: { ...qm.modifier, remainingShifts: shifts, sourceId: def.id },
          action: "add"
        }
      });
    }

    if (def.onFireMessage) this.messages.broadcast(def.onFireMessage);
  }

  private pickNext(): GlobalEventDef | undefined {
    if (!globalEvents.length) return undefined;
    const maxPriority = Math.max(...globalEvents.map(e => e.priority));
    const top = globalEvents.filter(e => e.priority === maxPriority);
    if (top.length === 1) return top[0];

    // weighted random among top
    const total = top.reduce((s, e) => s + (e.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const e of top) {
      r -= (e.weight ?? 1);
      if (r <= 0) return e;
    }
    return top[0];
  }
}
