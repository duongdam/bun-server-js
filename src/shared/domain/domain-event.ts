import { randomUUID } from 'node:crypto';
/**
 * Base class for all domain events.
 * Domain events capture something that happened in the domain.
 */
export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  abstract readonly eventType: string;

  protected constructor() {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredOn: this.occurredOn.toISOString(),
    };
  }
}

/**
 * Mixin for entities that can raise domain events.
 */
export class DomainEventEmitter {
  private readonly _domainEvents: DomainEvent[] = [];

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }
}
