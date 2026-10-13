import { timingSafeEqual } from 'node:crypto';
import { opportunitiesClient, safeOpportunity } from '../../../lib/opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function configuredAgent() {
  const agentUrl = process.env.AGENT_URL;
  const agentSecret = process.env.AGENT_SECRET;
  if (!agentUrl || !agentSecret || !process.env.SITE_PASSWORD) throw new Error('The Opportunities service is not configured.');
  return { agentUrl: agentUrl.replace(/\/$/, ''), agentSecret };
}

function passwordsMatch(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const supplied = Buffer.from(value);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

export async function GET() {
  try {
    const { data, error } = await opportunitiesClient()
      .from('opportunities')
      .select('id,title,url,source_excerpt,why_it_fits,status,found_at,decided_at')
      .eq('status', 'approved')
      .order('found_at', { ascending: false });
    if (error) throw error;
    return Response.json({ opportunities: data.map(safeOpportunity) });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load approved opportunities.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (!passwordsMatch(password, process.env.SITE_PASSWORD)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
    const { agentUrl, agentSecret } = configuredAgent();
    const response = await fetch(`${agentUrl}/jobs`, { method: 'POST', headers: { AGENT_SECRET: agentSecret }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.jobId) return Response.json({ error: 'Could not start an opportunities search.' }, { status: 502 });
    return Response.json({ jobId: body.jobId }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not start an opportunities search.' }, { status: 500 });
  }
}
