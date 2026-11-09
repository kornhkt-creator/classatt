import { getSupabase, must } from '../supabase.js';

export async function log(actor, action, detail = {}) {
  must(await getSupabase().from('audit_log').insert({ actor, action, detail }));
}
