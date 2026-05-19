import type { ActivityAction, ActivityDomain } from '@prisma/client';

export interface ActivityLogProps {
  userId: string;
  domain: ActivityDomain;
  entityId: string;
  action: ActivityAction;
  message?: string | undefined;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export class ActivityLog {
  public readonly id: string;
  public readonly userId: string;
  public readonly domain: ActivityDomain;
  public readonly entityId: string;
  public readonly action: ActivityAction;
  public readonly message?: string | undefined;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: Date;

  constructor(id: string, props: ActivityLogProps) {
    this.id = id;
    this.userId = props.userId;
    this.domain = props.domain;
    this.entityId = props.entityId;
    this.action = props.action;
    this.message = props.message;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }
}
