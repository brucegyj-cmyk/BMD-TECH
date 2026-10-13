import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

function passwordsMatch(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const supplied = Buffer.from(value);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

function agentConfig() {
  const agentUrl = process.env.AGENT_URL;
  const agentSecret = process.env.AGENT_SECRET;
  if (!agentUrl || !agentSecret) throw new Error('The Opportunities service is not configured.');
  return { agentUrl: agentUrl.replace(/\/$/, ''), agentSecret };
}

function validJobId(jobId) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(jobId); }

async function relay(request, jobId, suffix, method) {
  if (!validJobId(jobId)) return Response.json({ error: 'Invalid job id.' }, { status: 400 });
  if (!passwordsMatch(request.headers.get('x-site-password'), process.env.SITE_PASSWORD)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
  try {
    const { agentUrl, agentSecret } = agentConfig();
    const response = await fetch(`${agentUrl}/jobs/${jobId}${suffix}`, { method, headers: method === 'POST' ? { AGENT_SECRET: agentSecret } : undefined, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json({ error: body.error || 'Could not contact the opportunities agent.' }, { status: response.status === 404 ? 404 : 502 });
    return Response.json(body, { status: response.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not contact the opportunities agent.' }, { status: 502 });
  }
}

export async function GET(request, { params }) { const { jobId } = await params; return relay(request, jobId, '', 'GET'); }
export async function POST(request, { params }) { const { jobId } = await params; return relay(request, jobId, '/cancel', 'POST'); }
