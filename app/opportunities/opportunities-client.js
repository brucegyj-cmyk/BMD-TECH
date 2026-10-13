'use client';
/*

import { useEffect, useState } from 'react';
import './opportunities.css';

function Card({ item, onDecide, busy }) {
  return <article className="opportunity-card"><span className={`badge ${item.status}`}>{item.status}</span><h3>{item.title}</h3>{item.whyItFits && <p>{item.whyItFits}</p>}{item.sourceExcerpt && <blockquote>“{item.sourceExcerpt}”</blockquote>}<a className="source-link" href={item.url} target="_blank" rel="noreferrer">Read verified source ↗</a>{onDecide && <div className="moderation-actions"><button className="approve" disabled={busy} onClick={() => onDecide(item, 'approved')}>APPROVE</button><button className="reject" disabled={busy} onClick={() => onDecide(item, 'rejected')}>REJECT</button></div>}</article>;
}
*/

import { useEffect, useState } from 'react';
import './opportunities.css';

const PENDING = new Set(['running']);
const prettyElapsed = (milliseconds = 0) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

function Card({ item, onDecide, busy }) {
  return <article className="opportunity-card">
    <span className={`badge ${item.status}`}>{item.status}</span>
    <h3>{item.title}</h3>
    {item.whyItFits && <p>{item.whyItFits}</p>}
    {item.sourceExcerpt && <blockquote>“{item.sourceExcerpt}”</blockquote>}
    <a className="source-link" href={item.url} target="_blank" rel="noreferrer">Read retailer source ↗</a>
    {onDecide && <div className="moderation-actions"><button className="approve" disabled={busy} onClick={() => onDecide(item, 'approved')}>APPROVE</button><button className="reject" disabled={busy} onClick={() => onDecide(item, 'rejected')}>REJECT</button></div>}
  </article>;
}

export default function OpportunitiesClient() {
  const [password, setPassword] = useState('');
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [job, setJob] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(null);
  const admin = Boolean(password);

  const loadApproved = async () => {
    const response = await fetch('/api/opportunities', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setApproved(data.opportunities || []);
  };
  const loadPending = async (value = password) => {
    const response = await fetch('/api/opportunities/pending', { cache: 'no-store', headers: { 'x-site-password': value } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setPending(data.opportunities || []);
  };

  useEffect(() => { loadApproved().catch((cause) => setError(cause.message || 'Could not load approved GPU prices.')); }, []);
  useEffect(() => {
    if (!job?.jobId || !PENDING.has(job.status)) return undefined;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/opportunities/${job.jobId}`, { cache: 'no-store', headers: { 'x-site-password': password } });
        const update = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(update.error || 'Could not check this price search.');
        setJob(update);
        if (update.status === 'completed') {
          await Promise.all([loadApproved(), loadPending(password)]);
        }
        if (update.status === 'error') setError(update.error || 'The price search failed.');
      } catch (cause) { if (active) setError(cause.message || 'Could not check this price search.'); }
    };
    check();
    const timer = window.setInterval(check, 3_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [job?.jobId, job?.status, password]);

  async function refresh(event) {
    event.preventDefault();
    setBusy(true); setError(''); setJob(null); setDetailsOpen(true);
    try {
      const response = await fetch('/api/opportunities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start a price search.');
      setJob({ jobId: data.jobId, status: 'running', searches: 0, pageReads: 0, elapsedMs: 0, toolCalls: [] });
      await loadPending(password);
    } catch (cause) { setError(cause.message || 'Could not start a price search.'); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!job?.jobId) return;
    try {
      const response = await fetch(`/api/opportunities/${job.jobId}`, { method: 'POST', headers: { 'x-site-password': password } });
      const update = await response.json();
      if (!response.ok) throw new Error(update.error || 'Could not cancel this search.');
      setJob(update);
    } catch (cause) { setError(cause.message || 'Could not cancel this search.'); }
  }

  async function decide(item, status) {
    const oldApproved = approved; const oldPending = pending;
    setDeciding(item.id); setPending((items) => items.filter((entry) => entry.id !== item.id));
    if (status === 'approved') setApproved((items) => [{ ...item, status: 'approved' }, ...items]);
    try {
      const response = await fetch(`/api/opportunities/records/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (status === 'approved') setApproved((items) => items.map((entry) => entry.id === item.id ? data.opportunity : entry));
    } catch (cause) { setApproved(oldApproved); setPending(oldPending); setError(cause.message || 'Could not update this price.'); }
    finally { setDeciding(null); }
  }

  return <main className="wrap opportunities">
    <div className="crumb">Home / GPU Prices</div>
    <section className="opportunity-hero"><div><div className="eyebrow">NZ GPU PRICE TRACKER</div><h1>Verified GPU prices and stock.</h1><p>Track current NZ retail prices for the graphics cards you care about.</p></div><span className="opportunity-mark">↗</span></section>
    <section className="refresh-panel"><div><h2>Refresh GPU prices</h2><p>Enter the site password to start a live retailer search and review new findings.</p></div><form onSubmit={refresh}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Site password" required /><button className="button" disabled={busy}>{busy ? 'STARTING…' : 'REFRESH'}</button></form></section>
    {error && <div className="job-error" role="alert"><strong>Request failed.</strong> {error}</div>}
    {job && <section className="job-panel"><div className="job-status"><div><span className={`status-dot ${job.status}`}></span><strong>{job.status === 'running' ? 'Searching NZ retailers…' : job.status === 'completed' ? 'Price search complete' : job.status === 'cancelled' ? 'Search cancelled' : 'Search stopped'}</strong><span>Elapsed {prettyElapsed(job.elapsedMs)}</span></div>{PENDING.has(job.status) && <button className="cancel" onClick={cancel}>Cancel</button>}</div><button className="progress-toggle" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>Search progress <span>{job.searches || 0} searches · {job.pageReads || 0} retailer pages read</span><b>{detailsOpen ? '−' : '+'}</b></button>{detailsOpen && <div className="tool-list">{job.toolCalls?.length ? job.toolCalls.map((call, index) => <div key={`${call.type}-${call.url || index}-${index}`}><strong>{call.type === 'web_search' ? 'Web search' : call.type === 'update_site' ? 'Saved price' : 'Retailer page read'}</strong>{call.url ? <a href={call.url} target="_blank" rel="noreferrer">{call.url}</a> : <span>Completed</span>}</div>) : <p>Waiting for the first search…</p>}</div>}</section>}
    <section className="results"><div className="section-head"><h2>Approved GPU prices</h2><span>{approved.length} available</span></div><div className="opportunity-grid">{approved.map((item) => <Card item={item} key={item.id} />)}</div>{!approved.length && <p className="results-note">No approved GPU prices yet.</p>}</section>
    {admin && <section className="results moderation"><div className="section-head"><h2>New price findings</h2><span>{pending.length} to review</span></div><div className="opportunity-grid">{pending.map((item) => <Card item={item} key={item.id} onDecide={decide} busy={deciding === item.id} />)}</div>{!pending.length && <p className="results-note">No new price findings to review.</p>}</section>}
  </main>;
}

/* Legacy component retained only for source history.
export default function OpportunitiesClient() {
  const [password, setPassword] = useState(''); const [approved, setApproved] = useState([]); const [pending, setPending] = useState([]); const [admin, setAdmin] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [deciding, setDeciding] = useState(null);
  const loadApproved = async () => { const response = await fetch('/api/opportunities', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setApproved(data.opportunities || []); };
  const loadPending = async (value = password) => { const response = await fetch('/api/opportunities/pending', { cache: 'no-store', headers: { 'x-site-password': value } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPending(data.opportunities || []); setAdmin(true); };
  useEffect(() => { loadApproved().catch((cause) => setError(cause.message || 'Could not load approved opportunities.')); }, []);
  async function refresh(event) { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/opportunities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await loadPending(password); } catch (cause) { setError(cause.message || 'Could not refresh opportunities.'); } finally { setBusy(false); } }
  async function decide(item, status) { const priorApproved = approved; const priorPending = pending; setDeciding(item.id); setPending((items) => items.filter((entry) => entry.id !== item.id)); if (status === 'approved') setApproved((items) => [{ ...item, status: 'approved' }, ...items]); try { const response = await fetch(`/api/opportunities/records/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, status }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (status === 'approved') setApproved((items) => items.map((entry) => entry.id === item.id ? data.opportunity : entry)); } catch (cause) { setApproved(priorApproved); setPending(priorPending); setError(cause.message || 'Could not update this opportunity.'); } finally { setDeciding(null); } }
  return <main className="wrap opportunities"><div className="crumb">Home / GPU Prices</div><section className="opportunity-hero"><div><div className="eyebrow">NZ GPU PRICE TRACKER</div><h1>Verified GPU prices and stock.</h1><p>Track current NZ retail prices for the graphics cards you care about.</p></div><span className="opportunity-mark">↗</span></section><section className="refresh-panel"><div><h2>Refresh GPU prices</h2><p>Enter the site password to start a live retailer search and review new findings.</p></div><form onSubmit={refresh}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Site password" required /><button className="button" disabled={busy}>{busy ? 'WORKING…' : 'REFRESH'}</button></form></section>{error && <div className="job-error" role="alert"><strong>Request failed.</strong> {error}</div>}<section className="results"><div className="section-head"><h2>Approved GPU prices</h2><span>{approved.length} available</span></div><div className="opportunity-grid">{approved.map((item) => <Card item={item} key={item.id} />)}</div>{!approved.length && <p className="results-note">No approved GPU prices yet.</p>}</section>{admin && <section className="results moderation"><div className="section-head"><h2>New price findings</h2><span>{pending.length} to review</span></div><div className="opportunity-grid">{pending.map((item) => <Card item={item} key={item.id} onDecide={decide} busy={deciding === item.id} />)}</div>{!pending.length && <p className="results-note">No new price findings to review.</p>}</section>}</main>;
}
*/
