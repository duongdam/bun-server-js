import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base entity for all domain entities.
 * Provides identity (UUID), creation timestamp, and update timestamp.
 */
export abstract class BaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  updatedAt: Date;

  protected constructor(id?: string, createdAt?: Date, updatedAt?: Date) {
    this.id = id ?? uuidv4();
    this.createdAt = createdAt ?? new Date();
    this.updatedAt = updatedAt ?? new Date();
  }

  /**
   * Value equality: two entities are equal if they share the same id.
   */
  equals(other: BaseEntity): boolean {
    return this.id === other.id;
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }
}
