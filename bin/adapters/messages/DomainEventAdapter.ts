import { DomainEvent, DomainEventBus } from "../../domain/ports/DomainEvenPort";
import { API_Connector } from "bc-bot";

type Handler = (evt: DomainEvent) => void;

/**
 * Bridges external API events into domain events, while allowing
 * in-domain publish/subscribe without depending on the external API.
 */
export class DomainEventAdapter implements DomainEventBus {
  private readonly subs = new Map<string, Set<Handler>>();

  constructor(private readonly api: API_Connector) {
    // Wire external events to domain events with namespaced types
    api.on("Message", (message) =>
      this.publish({ type: "external:message", payload: message })
    );
    api.on("Beep", (beep) =>
      this.publish({ type: "external:beep", payload: beep })
    );
    api.on("RoomJoin", () =>
      this.publish({ type: "external:room.join", payload: undefined })
    );
    api.on("RoomCreate", () =>
      this.publish({ type: "external:room.create", payload: undefined })
    );
    api.on("CharacterEntered", (character) =>
      this.publish({ type: "external:character.entered", payload: character })
    );
    api.on(
      "CharacterLeft",
      (sourceMemberNumber, character, leaveMessage, intentional) => {
        this.publish({
          type: "external:character.left",
          payload: { sourceMemberNumber, character, leaveMessage, intentional },
        });
      },
    );
    api.on("PoseChange", (character) =>
      this.publish({ type: "external:pose.change", payload: character })
    );
  }

  publish(evt: DomainEvent): void {
    const set = this.subs.get(evt.type);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      try {
        handler(evt);
      } catch {
        // Swallow handler errors to keep the bus resilient
      }
    }
  }

  subscribe(type: string, handler: Handler): () => void {
    let set = this.subs.get(type);
    if (!set) {
      set = new Set();
      this.subs.set(type, set);
    }
    set.add(handler);
    return () => {
      const s = this.subs.get(type);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) this.subs.delete(type);
    };
  }
}

