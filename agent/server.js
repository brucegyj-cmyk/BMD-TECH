import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Agent, run, tool, webSearchTool } from '@openai/agents';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 8080);
const MAX_SEARCHES = 10;
const MAX_PAGE_READS = 15;
const MAX_RUNTIME_MS = 4 * 60 * 1000;
const jobs = new Map();

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function elapsed(job) {
  return Date.now() - job.startedAt;
}

function progress(job) {
  return {
    status: job.status,
    searches: job.searches,
    pageReads: job.pageReads,
    elapsedMs: elapsed(job),
    toolCalls: job.toolCalls,
  };
}

function safelyEqual(value, expected) {
  if (!value || !expected) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readInterests(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.join('\n');
}

function createOpenPage(job) {
  return tool({
    name: 'open_page',
    description:
      'Read one publicly accessible source page. Use this after search results to verify official eligibility, location, and whether the opportunity is open.',
    parameters: z.object({ url: z.string() }),
    async execute({ url }) {
      if (job.pageReads >= MAX_PAGE_READS) {
        throw new Error(`Page-read limit of ${MAX_PAGE_READS} reached.`);
      }
      if (job.controller.signal.aborted) throw new Error('Job cancelled or timed out.');
      try {
        new URL(url);
      } catch {
        throw new Error('open_page requires an absolute HTTP(S) URL.');
      }
      job.pageReads += 1;
      job.toolCalls.push({ type: 'open_page', url, atMs: elapsed(job) });
      console.log(JSON.stringify({ jobId: job.id, tool: 'open_page', url }));

      const response = await fetch(url, {
        signal: job.controller.signal,
        headers: { 'user-agent': 'OpportunityAgent/1.0' },
      });
      if (!response.ok) throw new Error(`Page request failed with HTTP ${response.status}.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported page type: ${contentType || 'unknown'}.`);
      }
      const html = await response.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30000);
      return { url: response.url, text };
    },
  });
}

function createUpdateSite(job) {
  const save = async ({ title, url, sourceExcerpt, whyItFits }) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured to save opportunities.');
    }
    if (job.controller.signal.aborted) throw new Error('Job cancelled or timed out.');
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
    } catch {
      throw new Error('update_site requires an absolute HTTP(S) URL.');
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: existing, error: lookupError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('url', url)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not check existing opportunity: ${lookupError.message}`);

    if (existing) {
      const event = { type: 'update_site', url, outcome: 'skipped_existing', atMs: elapsed(job) };
      job.toolCalls.push(event);
      console.log(JSON.stringify({ jobId: job.id, tool: 'update_site', url, outcome: 'skipped_existing' }));
      return { status: 'skipped_existing', url };
    }

    const { error: insertError } = await supabase.from('opportunities').insert({
      title,
      url,
      source_excerpt: sourceExcerpt,
      why_it_fits: whyItFits,
      status: 'new',
    });
    if (insertError?.code === '23505') {
      const event = { type: 'update_site', url, outcome: 'skipped_existing', atMs: elapsed(job) };
      job.toolCalls.push(event);
      console.log(JSON.stringify({ jobId: job.id, tool: 'update_site', url, outcome: 'skipped_existing' }));
      return { status: 'skipped_existing', url };
    }
    if (insertError) throw new Error(`Could not save opportunity: ${insertError.message}`);

    job.savedUrls.add(url);
    const event = { type: 'update_site', url, outcome: 'saved', atMs: elapsed(job) };
    job.toolCalls.push(event);
    console.log(JSON.stringify({ jobId: job.id, tool: 'update_site', url, outcome: 'saved' }));
    return { status: 'saved', url };
  };

  return {
    save,
    tool: tool({
      name: 'update_site',
      description: 'Save one fully verified opportunity to the site. Call exactly once for every item kept in the final results, and never for ruled-out or incompletely verified items. Existing URLs are skipped.',
      parameters: z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        sourceExcerpt: z.string().min(1),
        whyItFits: z.string().min(1),
      }),
      execute: save,
    }),
  };
}

function createAgent(job) {
  const updateSite = createUpdateSite(job);
  job.saveOpportunity = updateSite.save;
  return new Agent({
    name: 'New Zealand GPU price researcher',
    instructions: `You track current New Zealand retail prices, deals, pre-orders, and stock availability for this person:\n${job.interests}\n\nUse web search first. Run at least three distinct searches: one for RTX 5070, one for RTX 5080, and one for RX 9060/9060 XT, focused on New Zealand retailers and NZD. You have at most ${MAX_SEARCHES} searches and ${MAX_PAGE_READS} page reads. For every shortlisted listing, use open_page on the retailer's own product page before accepting it. Verify all three: (1) the exact GPU model and variant, (2) the current NZD retail price, and (3) that it is currently in stock, available to order, or explicitly a pre-order. Do not invent prices, availability, a retailer, or a deal. If a page fails, investigate another retailer. Return up to five useful listings; fewer is better than unsupported results.\n\nReturn JSON only with this shape: {"items":[{"name":"","type":"price|deal|preorder|restock","url":"","whyFit":"","priceExcerpt":"","availabilityExcerpt":"","retailerExcerpt":""}],"ruledOut":[{"name":"","reason":""}],"note":""}. Each excerpt must be a short direct retailer-source excerpt. An item without all three excerpts must be ruled out. Final validated items are saved by the job.`,
    tools: [
      webSearchTool({ searchContextSize: 'medium' }),
      createOpenPage(job),
    ],
  });
}

function recordHostedSearches(job, result) {
  const calls = new Map();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'web_search_call') {
      const key = value.call_id || value.callId || value.id || JSON.stringify(value);
      calls.set(key, value);
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
  };
  visit(result.rawResponses || []);
  visit(result.newItems || []);
  for (const call of calls.values()) {
    job.searches += 1;
    job.toolCalls.push({ type: 'web_search', atMs: elapsed(job) });
    console.log(JSON.stringify({ jobId: job.id, tool: 'web_search', id: call.id || call.call_id || call.callId }));
  }
}

function validateResults(results) {
  if (!results || !Array.isArray(results.items) || !Array.isArray(results.ruledOut)) {
    throw new Error('The research agent returned an invalid result shape.');
  }
  const seen = new Set();
  for (const item of results.items) {
    const required = ['name', 'url', 'priceExcerpt', 'availabilityExcerpt', 'retailerExcerpt'];
    if (required.some((key) => !String(item?.[key] || '').trim())) {
      throw new Error('A shortlisted item was missing required evidence.');
    }
    const canonicalName = String(item.name)
      .toLowerCase()
      .replace(/\b20\d{2}\b/g, '')
      .replace(/\s*[—-].*$/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (seen.has(canonicalName)) {
      throw new Error('Duplicate opportunities were returned.');
    }
    seen.add(canonicalName);
    if (!/(nzd|\$\s*\d|\d\s*nz\s*dollars?)/i.test(String(item.priceExcerpt))) {
      throw new Error('An item lacked a NZD price excerpt.');
    }
  }
  if (results.items.length > 5) throw new Error('More than five opportunities were returned.');
}

async function runJob(job) {
  if (!process.env.OPENAI_API_KEY) {
    job.status = 'error';
    job.error = 'OPENAI_API_KEY is not configured.';
    return;
  }
  const timeout = setTimeout(() => job.controller.abort(), MAX_RUNTIME_MS);
  try {
    const result = await run(createAgent(job), 'Research verified current opportunities now.', {
      signal: job.controller.signal,
      maxTurns: MAX_PAGE_READS + MAX_SEARCHES + 2,
    });
    recordHostedSearches(job, result);
    if (job.searches < 3) {
      throw new Error('Price research requires at least three distinct web searches.');
    }
    if (job.searches > MAX_SEARCHES || job.pageReads > MAX_PAGE_READS) {
      throw new Error('A tool-use limit was exceeded; no results were accepted.');
    }
    const output = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput);
    try {
      job.results = JSON.parse(output);
    } catch {
      throw new Error('The research agent did not return valid JSON.');
    }
    validateResults(job.results);
    for (const item of job.results.items) {
      if (!job.savedUrls.has(item.url)) {
        await job.saveOpportunity({
          title: item.name,
          url: item.url,
          sourceExcerpt: `Price: ${item.priceExcerpt}\nAvailability: ${item.availabilityExcerpt}\nRetailer: ${item.retailerExcerpt}`,
          whyItFits: item.whyFit || 'Matches the stated interests.',
        });
      }
    }
    job.status = 'completed';
  } catch (error) {
    job.status = job.controller.signal.aborted ? 'cancelled' : 'error';
    job.error = error instanceof Error ? error.message : 'Unknown job error.';
  } finally {
    clearTimeout(timeout);
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('agent is running');
  }

  if (req.method === 'POST' && url.pathname === '/jobs') {
    if (!safelyEqual(req.headers.agent_secret, process.env.AGENT_SECRET)) {
      return json(res, 401, { error: 'Unauthorized' });
    }
    const interests = readInterests(await readFile(new URL('./interests.txt', import.meta.url), 'utf8'));
    const job = {
      id: randomUUID(), status: 'running', startedAt: Date.now(), interests,
      searches: 0, pageReads: 0, toolCalls: [], savedUrls: new Set(), controller: new AbortController(),
    };
    jobs.set(job.id, job);
    void runJob(job);
    return json(res, 202, { jobId: job.id });
  }

  const match = url.pathname.match(/^\/jobs\/([^/]+)(?:\/(cancel))?$/);
  if (match) {
    const job = jobs.get(match[1]);
    if (!job) return json(res, 404, { error: 'Job not found' });
    if (req.method === 'POST' && match[2] === 'cancel') {
      job.controller.abort();
      return json(res, 202, { jobId: job.id, ...progress(job) });
    }
    if (req.method === 'GET' && !match[2]) {
      return json(res, 200, {
        jobId: job.id,
        ...progress(job),
        ...(job.status === 'completed' ? { results: job.results } : {}),
        ...(job.error ? { error: job.error } : {}),
      });
    }
  }
  return json(res, 404, { error: 'Not found' });
}

createServer((req, res) => {
  void handle(req, res).catch((error) => json(res, 500, { error: error.message }));
}).listen(PORT, () => console.log(`agent listening on ${PORT}`));
