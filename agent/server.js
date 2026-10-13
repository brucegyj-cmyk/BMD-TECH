import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Agent, run, tool, webSearchTool } from '@openai/agents';
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

function createAgent(job) {
  return new Agent({
    name: 'Verified opportunity researcher',
    instructions: `You find current opportunities for this person:\n${job.interests}\n\nUse web search first. You have at most ${MAX_SEARCHES} searches and ${MAX_PAGE_READS} page reads. For every shortlisted item, use open_page on an official organizer, event, or application source before accepting it. Verify all three: (1) a 25-year-old is eligible, (2) it is available in Auckland or explicitly online/open to New Zealand residents, and (3) applications, registration, or attendance are currently open. Do not assume education, school, work experience, citizenship, or travel ability. If a page fails, seek another source. Never invent results to fill a quota; return up to five and fewer when verification is incomplete.\n\nReturn JSON only with this shape: {"items":[{"name":"","type":"competition|program|event","url":"","whyFit":"","eligibilityExcerpt":"","availabilityExcerpt":"","locationExcerpt":""}],"ruledOut":[{"name":"","reason":""}],"note":""}. Each excerpt must be a short direct source excerpt. An item without all three excerpts must be ruled out.`,
    tools: [
      webSearchTool({ searchContextSize: 'medium' }),
      createOpenPage(job),
    ],
  });
}

function recordHostedSearches(job, result) {
  const responses = result.rawResponses || [];
  for (const response of responses) {
    for (const item of response.output || []) {
      if (item.type === 'web_search_call') {
        job.searches += 1;
        job.toolCalls.push({ type: 'web_search', atMs: elapsed(job) });
        console.log(JSON.stringify({ jobId: job.id, tool: 'web_search' }));
      }
    }
  }
}

function validateResults(results) {
  if (!results || !Array.isArray(results.items) || !Array.isArray(results.ruledOut)) {
    throw new Error('The research agent returned an invalid result shape.');
  }
  const seen = new Set();
  for (const item of results.items) {
    const required = ['name', 'url', 'eligibilityExcerpt', 'availabilityExcerpt', 'locationExcerpt'];
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
    const evidence = `${item.eligibilityExcerpt} ${item.availabilityExcerpt} ${item.locationExcerpt}`.toLowerCase();
    if (/identif(?:y|ies) as|women only|men only|students only|university students only|tertiary students only/.test(evidence)) {
      throw new Error('An item depended on an unverified personal attribute.');
    }
    if (!/(auckland|tāmaki makaura|new zealand|online)/.test(String(item.locationExcerpt).toLowerCase())) {
      throw new Error('An item lacked explicit Auckland, New Zealand, or online location evidence.');
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
    if (job.searches === 0) {
      throw new Error('Search-first verification failed: no hosted web-search call was recorded.');
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
      searches: 0, pageReads: 0, toolCalls: [], controller: new AbortController(),
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
