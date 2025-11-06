export type ChatMessageType = "Chat" | "Emote" | "Whisper" | "Action" | "Activity";

// Domain-facing DTO for incoming player chat messages
export interface IncomingMessage {
  Type: ChatMessageType;
  Content: string;
  SenderId: number;
  SenderName?: string;
}

// Outbound message port for sending messages back to players or the room
export interface MessagePort {
  whisper(playerId: number, text: string): void;
  broadcast(text: string): void;
}
