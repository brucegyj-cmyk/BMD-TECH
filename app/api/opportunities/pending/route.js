import { opportunitiesClient, requireSitePassword, safeOpportunity } from '../../../../lib/opportunities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!requireSitePassword(request)) return Response.json({ error: 'Incorrect site password.' }, { status: 401 });
  try {
    const { data, error } = await opportunitiesClient()
      .from('opportunities')
      .select('id,title,url,source_excerpt,why_it_fits,status,found_at,decided_at')
      .eq('status', 'new')
      .order('found_at', { ascending: false });
    if (error) throw error;
    return Response.json({ opportunities: data.map(safeOpportunity) });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load new opportunities.' }, { status: 500 });
  }
}
