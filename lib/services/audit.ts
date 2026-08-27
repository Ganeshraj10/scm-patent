import { createClient } from '@/lib/supabase/server';

/**
 * Server-side helper to record audit logs.
 * Do not import this into client components.
 */
export async function logAudit(
  actorProfileId: string,
  action: string,
  entityType?: string | null,
  entityId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('audit_logs').insert({
    actor_profile_id: actorProfileId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) {
    console.error('[logAudit] Failed to insert audit log:', error);
  }
}
