export interface DomainEvent { type: string; payload: unknown; }
export interface DomainEventBus {
  publish(evt: DomainEvent): void;
  subscribe(type: string, handler: (evt: DomainEvent) => void): () => void;
}