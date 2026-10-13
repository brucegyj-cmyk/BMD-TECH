export const runtime = 'nodejs';

function agentConfig() {
  const agentUrl = process.env.AGENT_URL;
  const agentSecret = process.env.AGENT_SECRET;
  if (!agentUrl || !agentSecret) throw new Error('The Opportunities service is not configured.');
  return { agentUrl: agentUrl.replace(/\/$/, ''), agentSecret };
}

function validJobId(jobId) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(jobId); }

async function relay(jobId, suffix, method) {
  if (!validJobId(jobId)) return Response.json({ error: 'Invalid job id.' }, { status: 400 });
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

export async function GET(_request, { params }) { const { jobId } = await params; return relay(jobId, '', 'GET'); }
export async function POST(_request, { params }) { const { jobId } = await params; return relay(jobId, '/cancel', 'POST'); }
