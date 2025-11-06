import { DomainEventBus } from "../../domain/ports/DomainEvenPort";
import { PlayerCore, PlayerIdentity } from "../../domain/core/PlayerCore";
import { PlayerRepo } from "../../domain/ports/PlayerRepo";
import { IncomingMessage, MessagePort } from "../../domain/ports/MessagePort";
import { SkillEngine } from "../../domain/services/SkillEngine";
import { buildDairyPlayer } from "../../games/facility/buildPlayer";
import { ClassSelectionService } from "../../domain/services/ClassSelectionService";

// External type from bc-bot events (adapter layer is allowed to know it)
import type { API_Message } from "bc-bot";

/**
 * Subscribes to player chat messages from the event bus and routes them to
 * domain services (e.g., SkillEngine, ClassSelectionService).
 */
export class MessageRouter {
  private readonly players = new Map<number, PlayerCore>();
  private readonly engine = new SkillEngine();
  private readonly classSelection: ClassSelectionService;

  constructor(
    private readonly bus: DomainEventBus,
    private readonly repo: PlayerRepo,
    private readonly messages: MessagePort
  ) {
    this.classSelection = new ClassSelectionService(repo, messages);
    this.bus.subscribe("external:message", (evt) => this.onExternalMessage(evt.payload as API_Message));
  }

  private ensurePlayer(identity: PlayerIdentity): PlayerCore {
    const existing = this.players.get(identity.id);
    if (existing) return existing;
    const player = buildDairyPlayer(identity, {
      repo: this.repo,
      messages: this.messages,
      bus: this.bus,
    });
    this.players.set(identity.id, player);
    return player;
  }

  private onExternalMessage(msg: API_Message): void {
    const sender = msg.sender;
    const identity: PlayerIdentity = {
      id: sender.MemberNumber,
      name: sender.Name,
      nickname: sender.NickName,
    };
    const player = this.ensurePlayer(identity);

    const incoming: IncomingMessage = {
      Type: msg.message.Type as IncomingMessage["Type"],
      Content: (msg.message as any).Content ?? "",
      SenderId: identity.id,
      SenderName: identity.name,
    };

    // Simple command routing (extend as needed)
    const text = incoming.Content.trim();
    if (text.startsWith("/bot classes")) {
      void this.classSelection.listPlayerClasses(player);
      return;
    }
    if (text.startsWith("/bot select ")) {
      const arg = text.substring("/bot select ".length).trim();
      const idOrName: number | string = Number.isNaN(Number(arg)) ? arg : Number(arg);
      void this.classSelection.select(player, idOrName);
      return;
    }

    // Otherwise, pass to skill engine
    const result = this.engine.processToken(player, incoming);
    if (result && result !== "NonSkill") {
      this.messages.whisper(player.identity.id, result);
    }
  }
}

