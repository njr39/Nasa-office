// Agents Office V3 — the live link (split out of tasks.js, 1 Oct 2026; same code, same behaviour).
// Served by serve.mjs the page is LIVE: connect() reads /api/health and picks up every task the server
// already has; poll() keeps up every 6 s with routines firing, scheduled tasks coming due, approvals and
// Agent Teams (V3.2, V3.5); APPROVE / REJECT / revise go back to the server. Opened as a file this never
// connects and the office stays demo. tasks.js owns the cards and the panel; it hands this module the
// task list, the card moves (mk, touch, complete, deliver) and the hooks below.
export function initLive(ctx) {
  const { API, tasks, R, agentOf, timeStr, slug, mk, touch, complete, deliver, setRoutines, post, spawnEmote, feedPush, chatPush,
          onTools, onUsage, onLive, brain, setStuck, getCalendar, isLive, markDirty, onHealth } = ctx;
  let polling = false;
  let pollN = 0, usageDue = true;
  async function pollUsage(force) { // V3.6: the plan's gauge — every 30 s, and after every run
    try { const u = await fetch(API + '/usage' + (force ? '?refresh=1' : '')).then(r => r.json()); if (onUsage) onUsage(u); } catch {}
  }
  async function poll() {
    if (!isLive() || polling) return; polling = true;
    if (usageDue || ++pollN % 5 === 0) { usageDue = false; pollUsage(); }
    try {
      const [rl, tl] = await Promise.all([fetch(API + '/routines').then(r => r.json()), fetch(API + '/tasks').then(r => r.json())]);
      if (Array.isArray(rl.routines)) setRoutines(rl.routines);
      if (Array.isArray(tl)) for (const st of tl) reconcile(st);
      if (getCalendar()) getCalendar().refresh();
    } catch (e) { console.warn('office poll:', e.message); }
    polling = false;
  }
  function reconcile(st) { // a server task the page did not start (a routine firing, a catch-up, an approval finishing) → the same cards, the same moves
    if (!agentOf(st.agent)) return;
    let t = tasks.find(x => x.live && x.sid === st.id);
    if (!t) {
      t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, by: st.by === 'routine' ? 'routine' : 'you', live: true, srv: !!st.routine, sid: st.id,
        routine: st.routine, when: st.when, late: !!st.late, due: st.due, needsOk: !!st.needsOk, addedAt: st.addedAt, changedAt: st.addedAt, last: 'added',
        model: st.model, modelUsed: st.modelUsed || st.model || undefined, modelFrom: st.modelFrom || (st.model ? 'task' : undefined), effort: st.effort, effortUsed: st.effortUsed, effortFrom: st.effortFrom });
      if (st.state === 'scheduled') { t.state = 'scheduled'; t.dueAt = st.dueAt; t.needsOk = !!st.needsOk; }
      else if (st.state !== 'done') { spawnEmote(R[t.agent], st.routine ? '⏱' : st.dueAt ? '⏱' : '📋'); if (st.routine) feedPush(R[t.agent], '⏱', `Routine fired: ${t.title}${t.late ? ' (late — was due ' + timeStr(t.due) + ')' : ''}`); else if (st.dueAt) feedPush(R[t.agent], '⏱', `Scheduled task fired: ${t.title}`); }
      touch(t, 'added');
    }
    apply(t, st);
  }
  function copyResult(t, st) { t.result = st.result; t.error = !!st.error; t.read = st.read || []; t.note = st.note; t.tools = st.tools || []; t.used = st.used || []; t.draft = st.draft; t.approved = !!st.approved; if (st.modelUsed) { t.modelUsed = st.modelUsed; t.modelFrom = st.modelFrom; t.effortUsed = st.effortUsed || ''; t.effortFrom = st.effortFrom; } }
  // V3.2 (16 Sep): the server's team state → piece cards on the teammates' desks, notes as 💬, the lead's members list
  const seenNotes = new Set();
  function syncTeam(t, st, quiet) {
    const tm = st.team; if (!tm) return;
    const pieces = tm.pieces || [];
    t.team = { lead: tm.lead, members: pieces.map(p => p.agent).filter(id => id !== tm.lead), why: tm.why };
    for (const p of pieces) {
      if (!agentOf(p.agent)) continue;
      const sid = `${st.id}:${p.agent}`;
      let c = tasks.find(x => x.live && x.sid === sid);
      if (!c) {
        c = mk({ agent: p.agent, title: p.title, text: p.text, by: 'team', live: true, srv: true, sid, piece: true, parent: t.id, leadId: tm.lead, from: tm.lead, addedAt: tm.plannedAt || Date.now(), changedAt: tm.plannedAt || Date.now(), last: 'handoff', running: true });
        if (!quiet) { spawnEmote(R[p.agent], '📋'); feedPush(R[p.agent], '📋', `Team piece from ${agentOf(tm.lead).name}: ${p.title}`); }
        touch(c, 'handoff');
      }
      if (p.state === 'doing' && c.state !== 'doing') { c.state = 'doing'; c.startedAt = performance.now() - Math.max(0, Date.now() - (p.startedAt || Date.now())); c.progress = 0; c.running = true; c.ready = false; c.changedAt = p.startedAt || Date.now(); touch(c, 'started'); }
      else if (p.state === 'done' && c.state !== 'done') {
        c.result = p.result; c.error = !!p.error; c.tools = p.tools || []; c.used = p.used || []; c.read = p.read || []; c.ready = true; c.running = true;
        if (quiet) { c.state = 'done'; c.doneAt = p.doneAt || Date.now(); c.changedAt = c.doneAt; c.progress = 1; c.last = 'done'; }
        else { complete(c); c.doneAt = p.doneAt || c.doneAt; c.changedAt = c.doneAt; if (c.tools.length && onTools) onTools(c.agent, c.tools); }
      }
    }
    for (const m of tm.messages || []) { // a note one teammate left another (or the lead)
      const key = `${st.id}:${m.from}:${m.to}:${m.at}`; if (seenNotes.has(key)) continue; seenNotes.add(key);
      if (quiet) continue;
      const to = m.to === 'lead' ? tm.lead : m.to, toName = agentOf(to)?.name || m.to;
      if (R[m.from]) { spawnEmote(R[m.from], '💬'); feedPush(R[m.from], '💬', `Note to ${toName}: ${m.text}`); chatPush(m.from, { who: 'work', i: '💬', text: `note to ${toName}: ${m.text}` }); }
      if (R[to]) { feedPush(R[to], '📨', `Note from ${agentOf(m.from)?.name || m.from}: ${m.text}`); chatPush(to, { who: 'work', i: '📨', text: `note from ${agentOf(m.from)?.name || m.from}: ${m.text}` }); }
    }
  }
  function apply(t, st) {
    if (st.team) syncTeam(t, st);
    if (st.state === 'scheduled') { if (t.state !== 'scheduled') { t.state = 'scheduled'; t.dueAt = st.dueAt; touch(t, 'scheduled'); } else if (t.dueAt !== st.dueAt) { t.dueAt = st.dueAt; markDirty(); } return; }
    if (t.state === 'scheduled' && st.state !== 'scheduled') { t.state = 'next'; t.addedAt = st.addedAt || Date.now(); t.late = !!st.late; t.due = st.due; touch(t, 'added'); spawnEmote(R[t.agent], '⏱'); feedPush(R[t.agent], '⏱', `Scheduled task fired: ${t.title}${t.late ? ' (late)' : ''}`); if (getCalendar()) getCalendar().refresh(); }
    if (st.state === 'doing' && t.state !== 'doing') {
      t.state = 'doing'; t.startedAt = performance.now() - Math.max(0, Date.now() - (st.startedAt || Date.now())); t.progress = 0; t.pausedAt = null; t.running = true; t.ready = false; t.srv = true; t.changedAt = st.startedAt || Date.now(); touch(t, 'started');
    } else if (st.state === 'waiting' && t.draftAt !== st.waitingAt) { // a new draft is waiting for the OK (the first, or a rework after REJECT)
      copyResult(t, st); t.state = 'waiting'; t.draftAt = st.waitingAt; t.ask = st.ask; t.changedAt = st.waitingAt || Date.now(); t.running = true; touch(t, 'waiting');
      askApproval(t);
    } else if (st.state === 'done' && t.state !== 'done') {
      copyResult(t, st); t.ready = true; t.running = true; usageDue = true;
      complete(t); t.doneAt = st.doneAt || t.doneAt; t.changedAt = t.doneAt; // straight to done here (the tick skips a stuck agent): the chat card, the note, the graph
      if (t.tools.length && onTools) onTools(t.agent, t.tools);
      if (brain && !t.error) fetch(API + '/brain').then(r => r.json()).then(g => brain.setGraph(g)).catch(() => {});
    }
  }
  function askApproval(t) { // D1: the draft lands in the chat with APPROVE / REJECT and the agent stands and waves
    chatPush(t.agent, { who: 'file', icon: '📝', name: slug(t.title) + '.md', meta: `draft · waiting for your OK · ${timeStr(t.changedAt)} · click to view`, content: t.draft || t.result });
    chatPush(t.agent, { who: 'appr', text: t.ask || `"${t.title}" is ready — approve to send it, reject to tell me what to change.`, pending: true, live: true });
    feedPush(R[t.agent], '⏸', `Waiting for your OK: ${t.title}`);
    if (setStuck) setStuck(t.agent, t.ask, t.sid);
  }
  const pendingFeedback = {}; // agentId → sid after REJECT: the owner's next chat line is the note
  function resolveLive(agentId, approved) { // APPROVE / REJECT on a live draft (main.js calls this instead of the demo onResolve)
    const t = tasks.find(x => x.live && x.agent === agentId && x.state === 'waiting'); if (!t) return false;
    if (approved) { post(`/tasks/${t.sid}/approve`); toDoing(t); chatPush(agentId, { who: 'agent', text: '✓ Approved — sending it now. It lands here when it is done.' }); }
    else { pendingFeedback[agentId] = t.sid; chatPush(agentId, { who: 'agent', text: 'Understood. What should change? Tell me here and I will redo it — it comes back for your OK.' }); }
    return true;
  }
  const pendingReject = agentId => !!pendingFeedback[agentId];
  function rejectLive(agentId, feedback) {
    const sid = pendingFeedback[agentId]; delete pendingFeedback[agentId];
    const t = tasks.find(x => x.live && x.sid === sid); if (!t) return false;
    post(`/tasks/${sid}/reject`, { feedback }); toDoing(t); chatPush(agentId, { who: 'agent', text: 'On it — reworking it with your note. It comes back here for your OK.' });
    return true;
  }
  function toDoing(t) { t.state = 'doing'; t.startedAt = performance.now(); t.progress = 0; t.pausedAt = null; t.running = true; t.ready = false; t.srv = true; touch(t, 'started'); }
  // LIVE: the agent picks the task up → Claude does it on the server → the result lands in the chat
  async function runLive(t, feedback) {
    t.running = true; t.ready = false;
    try {
      const r = await fetch(`${API}/tasks/${t.sid}/${feedback ? 'revise' : 'run'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feedback ? { feedback } : {}) });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const st = await r.json();
      t.result = st.result; t.error = !!st.error; t.read = st.read || []; t.note = st.note; t.tools = st.tools || []; t.used = st.used || []; if (st.modelUsed) { t.modelUsed = st.modelUsed; t.modelFrom = st.modelFrom; t.effortUsed = st.effortUsed || ''; t.effortFrom = st.effortFrom; }
      usageDue = true;
      if (t.tools.length && onTools) onTools(t.agent, t.tools); // the connectors the agent really pulled on light up
      if (brain && !t.error) fetch(API + '/brain').then(r => r.json()).then(g => brain.setGraph(g)).catch(() => {}); // the new note joins the graph
    } catch (e) { t.result = 'Could not complete this task: ' + e.message; t.error = true; }
    t.ready = true;
  }
  function revise(agentId, feedback) { // "revise: …" in chat re-runs that agent's last live deliverable
    const t = [...tasks].reverse().find(x => x.live && x.agent === agentId && x.state === 'done' && !x.error);
    if (!t) return false;
    t.state = 'doing'; t.startedAt = performance.now(); t.progress = 0; t.pausedAt = null; touch(t, 'started');
    runLive(t, feedback);
    return true;
  }
  async function connect() {
    if (!location.protocol.startsWith('http')) return;
    try {
      const h = await (await fetch(API + '/health')).json();
      if (!h.ok) return;
      onHealth(h); // the page goes LIVE: office model/effort, the TEAM button, the mode label
      if (brain) { try { brain.setGraph(await (await fetch(API + '/brain')).json()); } catch {} }
      const list = await (await fetch(API + '/tasks')).json();
      for (const st of list) {
        if (!agentOf(st.agent)) continue;
        if (st.state === 'done') {
          const t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, by: 'you', live: true, sid: st.id, state: 'done',
            doneAt: st.doneAt, changedAt: st.doneAt, addedAt: st.addedAt, result: st.result, read: st.read, note: st.note, tools: st.tools || [], used: st.used || [], error: !!st.error, last: 'done' });
          if (st.team) syncTeam(t, st, true);
          deliver(t);
        } else reconcile(st); // next, doing (the server may be running it), waiting for your OK, scheduled for a date — pick it up again
      }
      markDirty();
      if (onLive) onLive(h);
      await poll(); setInterval(poll, 6000); // V3.5: routines fire on the server's clock — the page keeps up
    } catch (e) { console.warn('office server not reachable — running offline:', e.message); }
  }
  return { connect, poll, reconcile, resolveLive, rejectLive, pendingReject, runLive, revise };
}
