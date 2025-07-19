import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from '../config/supabase.config';

@Injectable()
export class SupabaseService {
  private adminClient: SupabaseClient;
  private client: SupabaseClient;

  constructor() {
    this.adminClient = createSupabaseAdminClient();
    this.client = createSupabaseClient();
  }

  // Get admin client for server-side operations
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  // Get regular client for user operations
  getClient(): SupabaseClient {
    return this.client;
  }

  // Database operations
  query(table: string): ReturnType<SupabaseClient['from']> {
    return this.adminClient.from(table);
  }

  // Storage operations
  getStorage(bucket: string): ReturnType<SupabaseClient['storage']['from']> {
    return this.adminClient.storage.from(bucket);
  }

  // Auth operations (admin)
  getAuth() {
    return this.adminClient.auth.admin;
  }

  // Real-time subscriptions
  subscribe(table: string, callback: (payload: unknown) => void) {
    return this.client
      .channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.adminClient
        .from('health_check')
        .select('*')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      return false;
    }
  }
}
