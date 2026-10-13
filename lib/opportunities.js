import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function hasSitePassword(value) {
  const expected = process.env.SITE_PASSWORD;
  if (typeof value !== 'string' || !expected) return false;
  const supplied = Buffer.from(value);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

export function requireSitePassword(request) {
  return hasSitePassword(request.headers.get('x-site-password'));
}

export function opportunitiesClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('The Opportunities database is not configured.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function safeOpportunity(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    sourceExcerpt: row.source_excerpt,
    whyItFits: row.why_it_fits,
    status: row.status,
    foundAt: row.found_at,
    decidedAt: row.decided_at,
  };
}
