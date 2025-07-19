export interface ClerkUser {
  id: string;
  email_addresses: ClerkEmailAddress[];
  first_name: string | null;
  last_name: string | null;
  image_url?: string;
  created_at: number;
  updated_at: number;
  last_sign_in_at?: number;
  username?: string;
  phone_numbers?: ClerkPhoneNumber[];
  external_accounts?: ClerkExternalAccount[];
}

export interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification?: {
    status: string;
    strategy: string;
  };
}

export interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
  verification?: {
    status: string;
    strategy: string;
  };
}

export interface ClerkExternalAccount {
  id: string;
  provider: string;
  identification_id: string;
  provider_user_id: string;
  approved_scopes: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  username?: string;
}

export interface ClerkWebhookEvent {
  type: ClerkWebhookType;
  data: ClerkUser | ClerkSession;
  object: string;
  timestamp: number;
}

export interface ClerkSession {
  id: string;
  user_id: string;
  status: string;
  last_active_at: number;
  expire_at: number;
  abandon_at: number;
  created_at: number;
  updated_at: number;
}

export enum ClerkWebhookType {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  SESSION_CREATED = 'session.created',
  SESSION_ENDED = 'session.ended',
  SESSION_REMOVED = 'session.removed',
  SESSION_REVOKED = 'session.revoked'
}

export interface UserSession {
  userId: string;
  clerkUserId: string;
  email: string;
  name: string;
  permissions: string[];
  subscriptionTier: string;
  sessionId?: string;
  expiresAt?: Date;
}

export interface ClerkUserSync {
  clerkUserId: string;
  localUserId: string;
  lastSyncAt: Date;
  syncStatus: SyncStatus;
  syncErrors?: string[];
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  ERROR = 'error',
  DELETED = 'deleted'
}

export interface ClerkSyncResult {
  success: boolean;
  userId?: string;
  error?: string;
  syncStatus: SyncStatus;
}

export interface ClerkWebhookPayload {
  data: ClerkUser | ClerkSession;
  object: string;
  type: ClerkWebhookType;
  timestamp: number;
}