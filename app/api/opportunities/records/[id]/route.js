import { opportunitiesClient, hasSitePassword, safeOpportunity } from '../../../../../lib/opportunities';

export const runtime = 'nodejs';

export async function PATCH(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!hasSitePassword(body.password)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
  if (!['approved', 'rejected'].includes(body.status)) return Response.json({ error: 'Status must be approved or rejected.' }, { status: 400 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: 'Invalid opportunity id.' }, { status: 400 });
  try {
    const { data, error } = await opportunitiesClient()
      .from('opportunities')
      .update({ status: body.status, decided_at: new Date().toISOString() })
      .eq('id', Number(id))
      .eq('status', 'new')
      .select('id,title,url,source_excerpt,why_it_fits,status,found_at,decided_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: 'Opportunity is no longer awaiting review.' }, { status: 404 });
    return Response.json({ opportunity: safeOpportunity(data) });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not update this opportunity.' }, { status: 500 });
  }
}
