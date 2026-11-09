import { getSupabase, must } from '../supabase.js';

// Failed attempts in the time window, oldest first (used for rate limiting)
export async function listFailures(lineUserId, kind, sinceIso) {
  return must(await getSupabase().from('link_attempts').select('created_at')
    .eq('line_user_id', lineUserId).eq('kind', kind).eq('success', false).gte('created_at', sinceIso)
    .order('created_at', { ascending: true }).limit(50));
}

export async function record(lineUserId, kind, success) {
  must(await getSupabase().from('link_attempts').insert({ line_user_id: lineUserId, kind, success }));
}
