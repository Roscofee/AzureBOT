import { DomainEventBus } from "../../domain/ports/DomainEvenPort";
import { PlayerCore, PlayerIdentity } from "../../domain/core/PlayerCore";
import { PlayerRepo } from "../../domain/ports/PlayerRepo";
import { IncomingMessage, MessagePort } from "../../domain/ports/MessagePort";
// Game-agnostic: specific handlers and builders are injected by the caller

// External type from bc-bot events (adapter layer is allowed to know it)
import type { API_Message } from "bc-bot";

export interface MessageRouterOptions {
  buildPlayer: (
    identity: PlayerIdentity,
    deps: { repo: PlayerRepo; messages: MessagePort; bus: DomainEventBus }
  ) => PlayerCore | Promise<PlayerCore>;
  onTextMessage?: (player: PlayerCore, msg: IncomingMessage) => void | Promise<void>;
  identityFromApi?: (sender: API_Message["sender"]) => PlayerIdentity;
}

/** Generic router: subscribes to external messages, ensures PlayerCore instances, and delegates handling */
export class MessageRouter {
  private readonly players = new Map<number, PlayerCore>();

  constructor(
    private readonly bus: DomainEventBus,
    private readonly repo: PlayerRepo,
    private readonly messages: MessagePort,
    private readonly opts: MessageRouterOptions
  ) {
    this.bus.subscribe("external:message", (evt) => { void this.onExternalMessage(evt.payload as API_Message); });
  }

  /** Register a player in the in-memory cache; events only affect registered players */
  register(player: PlayerCore): void {
    this.players.set(player.identity.id, player);
  }

  /** Remove a player from the cache */
  unregister(playerId: number): void {
    this.players.delete(playerId);
  }

  /** Retrieve a cached player, if any */
  get(playerId: number): PlayerCore | undefined {
    return this.players.get(playerId);
  }

  private async onExternalMessage(msg: API_Message): Promise<void> {
    const sender = msg.sender;
    const identity: PlayerIdentity = this.opts.identityFromApi
      ? this.opts.identityFromApi(sender)
      : { id: sender.MemberNumber, name: sender.Name, nickname: sender.NickName };
    const player = this.players.get(identity.id);
    if (!player) {
      // Only affect cached players; ignore if not present
      return;
    }

    const incoming: IncomingMessage = {
      Type: msg.message.Type as IncomingMessage["Type"],
      Content: (msg.message as any).Content ?? "",
      SenderId: identity.id,
      SenderName: identity.name,
    };

    await this.opts.onTextMessage?.(player, incoming);
  }
}
