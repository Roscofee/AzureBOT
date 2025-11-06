import { MessagePort } from "../../domain/ports/MessagePort";
import { API_Connector } from "bc-bot";

export class MessageAdapter implements MessagePort {
  constructor(private readonly api: API_Connector) {}

  whisper(playerId: number, text: string): void {
    this.api.SendMessage("Whisper", text, playerId);
  }

  broadcast(text: string): void {
    this.api.SendMessage("Chat", text);
  }
}

