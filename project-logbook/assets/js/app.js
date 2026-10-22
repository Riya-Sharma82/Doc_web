/* =============================================================
   GOVERNANCE PORTAL — APPLICATION  v2
   All page renderers, form handlers, modal controllers.
   Pages: overview, meetings, directives, contributions,
          dev-history, decisions, tasks-milestones, testing,
          issues, reports, config
   ============================================================= */
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE 1 — PROJECT OVERVIEW
   ════════════════════════════════════════════════════════════ */
window.render_overview = function () {
  const meta  = DB.Meta.get();
  const ts    = DB.Stats.tasks();
  const ds    = DB.Stats.directives();
  const is    = DB.Stats.issues();
  const ms    = DB.Stats.milestones();
  const pct   = DB.Stats.progressPct();
  const mtgs  = DB.Meetings.list().sort((a,b)=>(b.number||0)-(a.number||0));
  const latest= mtgs[0] || null;
  const blockers = DB.Issues.list().filter(i=>i.status==='Open'&&(i.severity==='Critical'||i.severity==='High'));
  const upcoming = DB.Tasks.list()
    .filter(t=>t.deadline&&t.status!=='Completed')
    .sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,6);
  const recentChg = DB.Changes.list()
    .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
  const openDir = DB.Directives.list()
    .filter(d=>d.status!=='Completed and Verified').slice(0,5);

  const el = document.getElementById('overview-content');
  if (!el) return;

  el.innerHTML = `
    <!-- Stat row -->
    <div class="stat-row">
      <div class="stat-cell accent-left">
        <div class="stat-lbl">Meetings</div>
        <div class="stat-val c-accent">${mtgs.length}</div>
        <div class="stat-note">Documented</div>
      </div>
      <div class="stat-cell ok-left">
        <div class="stat-lbl">Tasks Completed</div>
        <div class="stat-val c-ok">${ts.completed}</div>
        <div class="stat-note">of ${ts.total} total</div>
      </div>
      <div class="stat-cell warn-left">
        <div class="stat-lbl">In Progress</div>
        <div class="stat-val c-warn">${ts.inProgress}</div>
        <div class="stat-note">${ts.blocked} blocked</div>
      </div>
      <div class="stat-cell accent-left">
        <div class="stat-lbl">Directives</div>
        <div class="stat-val c-accent">${ds.total}</div>
        <div class="stat-note">${ds.verified} verified · ${ds.pending} pending</div>
      </div>
      <div class="stat-cell ${is.critical>0?'err-left':'ok-left'}">
        <div class="stat-lbl">Open Issues</div>
        <div class="stat-val ${is.critical>0?'c-err':'c-ok'}">${is.open}</div>
        <div class="stat-note">${is.critical} critical · ${is.high} high</div>
      </div>
      <div class="stat-cell ok-left">
        <div class="stat-lbl">Milestones</div>
        <div class="stat-val c-ok">${ms.completed}</div>
        <div class="stat-note">of ${ms.total} · ${ms.delayed} delayed</div>
      </div>
    </div>

    <!-- Progress + Project info row -->
    <div class="grid-2 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Overall Task Progress</div>
          <span class="t-xs t-muted">Calculated from ${ts.total} recorded tasks</span>
        </div>
        <div class="card-body">
          ${ts.total ? `
            ${UI.progressBar(pct, pct===100?'ok':pct<30?'warn':'')}
            <div class="flex gap-4 flex-wrap mt-3">
              <span class="t-xs"><span style="color:var(--ok)">●</span> Completed: ${ts.completed}</span>
              <span class="t-xs"><span style="color:var(--accent)">●</span> In Progress: ${ts.inProgress}</span>
              <span class="t-xs"><span style="color:var(--warn)">●</span> Pending: ${ts.pending}</span>
              <span class="t-xs"><span style="color:var(--err)">●</span> Blocked: ${ts.blocked}</span>
            </div>` :
            `<div class="t-sm t-muted t-italic">No tasks recorded. Add tasks to calculate progress automatically.</div>`
          }
          <div class="divider"></div>
          <div class="kv-grid mt-3">
            ${UI.kv('Project','',{isHtml:true})}
            ${UI.kv('Name', meta.projectName)}
            ${UI.kv('Phase', meta.currentPhase||'Not recorded')}
            ${UI.kv('Faculty', meta.faculty||'Not recorded')}
            ${UI.kv('Institution', meta.institution||'Not recorded')}
            ${UI.kv('Start Date','',{isHtml:true})}
          </div>
          ${meta.startDate?`<div class="t-xs t-muted">${UI.fmtDateRaw(meta.startDate)}</div>`:''}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Latest Meeting</div>
          <button class="btn btn-sm btn-ghost no-print" onclick="UI.navigate('meetings')">All meetings →</button>
        </div>
        <div class="card-body">
          ${latest ? `
            <div class="flex f-ac gap-3 mb-3">
              <div class="mbr-avatar" style="width:34px;height:34px;font-size:13px;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${latest.number||'?'}</div>
              <div>
                <div class="t-semi">${UI.esc(latest.title||'Meeting '+latest.number)}</div>
                <div class="t-xs t-muted">${UI.fmtDateRaw(latest.date)} · ${UI.esc(latest.type||'Regular Meeting')}</div>
              </div>
              ${UI.statusBadge(latest.state||'Draft')}
            </div>
            <div class="t-sm mb-3">${UI.esc(latest.objective||'No objective recorded.')}</div>
            <button class="btn btn-sm btn-secondary no-print" onclick="viewMeeting('${latest.id}')">View Minutes →</button>
          ` : `<div class="t-sm t-muted t-italic">No meetings recorded yet.</div>`}
        </div>
      </div>
    </div>

    <!-- Open directives + Blockers -->
    <div class="grid-2 mb-4">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Outstanding Faculty Directives</div>
          <button class="btn btn-sm btn-ghost no-print" onclick="UI.navigate('directives')">All →</button>
        </div>
        <div class="card-body">
          ${openDir.length ? `
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>ID</th><th>Instruction</th><th>Status</th></tr></thead>
                <tbody>${openDir.map(d=>`<tr>
                  <td class="id-cell">${UI.esc(d.directiveId||'—')}</td>
                  <td class="trunc" style="max-width:180px">${UI.esc(d.instruction)}</td>
                  <td>${UI.statusBadge(d.status)}</td>
                </tr>`).join('')}</tbody>
              </table>
            </div>` :
            `<div class="t-sm t-muted t-italic">All directives completed or none recorded.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">⚠ Critical &amp; High Issues</div>
          <button class="btn btn-sm btn-ghost no-print" onclick="UI.navigate('issues')">All →</button>
        </div>
        <div class="card-body">
          ${blockers.length ? blockers.map(b=>`
            <div class="li-item mb-2">
              <div class="li-header">
                <div>
                  <span class="badge ${b.severity==='Critical'?'p-critical':'p-high'} mr-1">${UI.esc(b.severity)}</span>
                  <span class="t-semi t-sm">${UI.esc(b.issueId)} — ${UI.esc(b.description)}</span>
                </div>
                ${UI.statusBadge(b.status)}
              </div>
              <div class="t-xs t-muted mt-1">Owner: ${UI.esc(b.assignedTo||'—')} · Found: ${UI.fmtDateRaw(b.dateIdentified)}</div>
            </div>`).join('')
            : `<div class="t-sm t-muted t-italic">No critical or high-severity open issues.</div>`}
        </div>
      </div>
    </div>

    <!-- Upcoming deadlines + Recent changes -->
    <div class="grid-2 mb-4">
      <div class="card">
        <div class="card-header"><div class="card-title">Upcoming Deadlines</div></div>
        <div class="card-body">
          ${upcoming.length ? `
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>Task</th><th>Deadline</th><th>Status</th></tr></thead>
                <tbody>${upcoming.map(t=>`<tr>
                  <td class="trunc" style="max-width:160px">${UI.esc(t.title)}</td>
                  <td>${UI.fmtDateRaw(t.deadline)}</td>
                  <td>${UI.statusBadge(t.status)}</td>
                </tr>`).join('')}</tbody>
              </table>
            </div>` :
            `<div class="t-sm t-muted t-italic">No upcoming deadlines recorded.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Technical Changes</div>
          <button class="btn btn-sm btn-ghost no-print" onclick="UI.navigate('dev-history')">Full history →</button>
        </div>
        <div class="card-body">
          ${recentChg.length ? `
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>ID</th><th>Change</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>${recentChg.map(c=>`<tr>
                  <td class="id-cell">${UI.esc(c.changeId||'—')}</td>
                  <td class="trunc" style="max-width:140px">${UI.esc(c.title)}</td>
                  <td>${UI.fmtDateRaw(c.date)}</td>
                  <td>${UI.statusBadge(c.status)}</td>
                </tr>`).join('')}</tbody>
              </table>
            </div>` :
            `<div class="t-sm t-muted t-italic">No technical changes recorded.</div>`}
        </div>
      </div>
    </div>`;
};

/* Project settings handlers */
function openProjectConfig() { UI.navigate('config'); }


/* ════════════════════════════════════════════════════════════
   PAGE 2 — MEETING REGISTER
   ════════════════════════════════════════════════════════════ */
let _meetingDetailId = null;

window.render_meetings = function () {
  const listView   = document.getElementById('meetings-list-view');
  const detailView = document.getElementById('meetings-detail-view');
  if (_meetingDetailId) {
    listView.style.display   = 'none';
    detailView.style.display = 'block';
    _renderMeetingDetail(_meetingDetailId);
  } else {
    listView.style.display   = 'block';
    detailView.style.display = 'none';
    _renderMeetingList();
  }
};

function _renderMeetingList() {
  const all    = DB.Meetings.list().sort((a,b)=>(b.number||0)-(a.number||0));
  const search = document.getElementById('mtg-search')?.value||'';
  const typeF  = document.getElementById('mtg-type-filter')?.value||'';
  const stateF = document.getElementById('mtg-state-filter')?.value||'';
  let   list   = UI.filterList(all, search, ['title','type','objective','attendees']);
  if (typeF)  list = list.filter(m=>m.type===typeF);
  if (stateF) list = list.filter(m=>(m.state||'Draft')===stateF);
  const el = document.getElementById('meetings-list-content');

  if (!list.length) {
    el.innerHTML = all.length===0
      ? UI.emptyState({icon:'📋',title:'No meetings recorded',desc:'Add the first meeting to begin the formal minutes register.',btn:'+ Add Meeting',btnCb:'openMeetingModal()'})
      : UI.emptyState({icon:'🔍',title:'No meetings match your filter',desc:'Adjust the search or filter.'});
    return;
  }

  el.innerHTML = list.map(m => {
    const dirs  = DB.Directives.list().filter(d=>d.meetingId===m.id).length;
    const tasks = DB.Tasks.list().filter(t=>t.meetingId===m.id).length;
    return `<div class="mtg-row" onclick="viewMeeting('${m.id}')">
      <div class="mtg-num">${m.number||'?'}</div>
      <div class="mtg-info">
        <div class="mtg-title">${UI.esc(m.title||'Meeting '+m.number)}</div>
        <div class="mtg-meta">${UI.fmtDateRaw(m.date)}${m.time?' · '+UI.esc(m.time):''} · ${UI.esc(m.type||'Regular Meeting')}</div>
        <div class="mtg-obj t-xs t-muted">${UI.esc(m.objective||'No objective recorded.')}</div>
        <div class="mtg-tags">
          ${UI.statusBadge(m.state||'Draft')}
          ${dirs  ? `<span class="cat-chip">${dirs} directive${dirs>1?'s':''}</span>` : ''}
          ${tasks ? `<span class="cat-chip">${tasks} task${tasks>1?'s':''}</span>` : ''}
          ${m.attendees ? `<span class="t-xs t-muted">Attendees: ${UI.esc(m.attendees)}</span>` : ''}
        </div>
      </div>
      <div class="mtg-actions no-print">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();editMeeting('${m.id}')" title="Edit">✏</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();deleteMeeting('${m.id}')" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');
}

function viewMeeting(id) { _meetingDetailId=id; render_meetings(); }
function backToMeetings() { _meetingDetailId=null; render_meetings(); }

function _renderMeetingDetail(id) {
  const m  = DB.Meetings.get(id);
  const el = document.getElementById('meetings-detail-content');
  if (!m) { el.innerHTML='<div class="t-muted">Meeting not found.</div>'; return; }

  const linkedDirs = DB.Directives.list().filter(d=>d.meetingId===id);
  const richDiscussions = DB.MeetingDiscussions.list(id);
  const meetingAtts = DB.MeetingAttachments.list(id);

  el.innerHTML = `
    <div class="detail-back no-print" onclick="backToMeetings()">← Meeting Register</div>
    <div class="flex f-jb f-ac flex-wrap gap-3 mb-4">
      <div>
        <div style="font-size:var(--fs-xl);font-weight:700">${UI.esc(m.title||'Meeting '+m.number)}</div>
        <div class="t-sm t-muted">${UI.fmtDateRaw(m.date)}${m.time?' · '+UI.esc(m.time):''} · ${UI.esc(m.type||'Regular Meeting')} · ${UI.statusBadge(m.state||'Draft')}</div>
      </div>
      <div class="flex gap-2 no-print" style="flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" onclick="openDiscussionModal('${m.id}')">+ Record Discussion</button>
        <button class="btn btn-sm btn-secondary" onclick="openAttachMediaModal('${m.id}')">📎 Attach Media</button>
        <button class="btn btn-sm btn-secondary" onclick="openMeetingReportModal('${m.id}')">📄 Export PDF Report</button>
        ${m.state!=='Finalized'?`<button class="btn btn-sm btn-secondary" onclick="advanceMeetingState('${m.id}')">Advance State →</button>`:''}
        <button class="btn btn-sm btn-secondary" onclick="editMeeting('${m.id}')">✏ Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="duplicateMeeting('${m.id}')">⎘ New from Template</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMeeting('${m.id}')">Delete</button>
      </div>
    </div>

    ${m.state==='Finalized'?UI.callout('info','Finalized Record','This meeting record has been finalized. Edits will be logged in the audit trail.'):''}

    <!-- A. Meeting Information -->
    ${UI.detailSec('A. Meeting Information','','','📌',`
      <div class="kv-grid">
        ${UI.kv('Meeting No.', m.number)}
        ${UI.kv('Meeting ID', m.meetingId||'—', {mono:true})}
        ${UI.kv('Date', UI.fmtDateRaw(m.date))}
        ${UI.kv('Time', m.time||'—')}
        ${UI.kv('Duration', m.duration||'—')}
        ${UI.kv('Type', m.type||'—')}
        ${UI.kv('Attendees', m.attendees||'—')}
        ${UI.kv('Absent', m.absent||'—')}
        ${UI.kv('Chair/Supervisor', m.chair||'—')}
        ${UI.kv('Minutes Prepared By', m.minutesBy||'—')}
        ${UI.kv('Objective', m.objective||'—')}
        ${UI.kv('Agenda', m.agenda||'—')}
        ${UI.kv('Record State', m.state||'Draft')}
      </div>`)}

    <!-- B. Faculty Directives -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">🎓 B. Faculty Instructions &amp; Directives</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="openDirectiveModalForMeeting('${id}')">+ Add Directive</button>
      </div>
      <div class="detail-sec-body">
        ${linkedDirs.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>ID</th><th>Instruction</th><th>Assigned To</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>${linkedDirs.map(d=>`<tr>
            <td class="id-cell">${UI.esc(d.directiveId)}</td>
            <td style="max-width:220px">${UI.esc(d.instruction)}</td>
            <td>${UI.esc(d.assignedTo||'—')}</td>
            <td>${UI.fmtDateRaw(d.deadline)}</td>
            <td>${UI.priorityBadge(d.priority)}</td>
            <td>${UI.statusBadge(d.status)}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="t-sm t-muted t-italic">No directives recorded for this meeting.</div>`}
      </div>
    </div>

    <!-- C. Chronological Discussion Timeline & Detailed Technical Notes -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">💬 C. Discussion Timeline &amp; Technical Notes (${richDiscussions.length + (m.discussions?.length || 0)})</div>
        <div class="flex gap-2 no-print">
          <button class="btn btn-sm btn-primary" onclick="openDiscussionModal('${id}')">+ Record Discussion Topic</button>
          <button class="btn btn-sm btn-secondary" onclick="addMtgItem('${id}','discussion')">+ Quick Item</button>
        </div>
      </div>
      <div class="detail-sec-body">
        ${(richDiscussions.length === 0 && (!m.discussions || m.discussions.length === 0)) ? `
          <div class="empty-state" style="padding:24px">
            <div class="empty-icon">💬</div>
            <div class="empty-title">No discussions documented yet</div>
            <div class="empty-desc">Preserve the complete history of technical discussions, faculty guidance, and decisions throughout the search engine project.</div>
            <button class="btn btn-sm btn-primary mt-2 no-print" onclick="openDiscussionModal('${id}')">+ Record Discussion Topic</button>
          </div>
        ` : `
          <div class="disc-timeline-wrap">
            ${richDiscussions.map((disc, idx) => {
              const discAtts = meetingAtts.filter(a => a.discussionId === disc.id);
              return UI.discussionTimelineNode(disc, idx, discAtts);
            }).join('')}
          </div>
          ${(m.discussions && m.discussions.length > 0) ? `
            <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border)">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Historical Discussion Notes:</div>
              ${_renderSubItems(m.discussions,'','discussion',id)}
            </div>
          ` : ''}
        `}
      </div>
    </div>

    <!-- D. Meeting Attachments & Discussion Gallery -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">🖼 D. Meeting Attachments &amp; Discussion Gallery (${meetingAtts.length})</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="openAttachMediaModal('${id}')">+ Upload Screenshot / Diagram</button>
      </div>
      <div class="detail-sec-body">
        ${meetingAtts.length ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px">
            ${meetingAtts.map(att => UI.meetingAttachmentThumb(att)).join('')}
          </div>
        ` : `
          <div class="empty-state" style="padding:24px">
            <div class="empty-icon">📁</div>
            <div class="empty-title">No meeting attachments uploaded</div>
            <div class="empty-desc">Upload whiteboard photos, architecture diagrams, schema screenshots, or slides shown to faculty.</div>
            <button class="btn btn-sm btn-secondary mt-2 no-print" onclick="openAttachMediaModal('${id}')">+ Upload Media</button>
          </div>
        `}
      </div>
    </div>

    <!-- E. Work Demonstrated / Reported -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">✅ E. Work Demonstrated or Reported</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="addMtgItem('${id}','workItem')">+ Add</button>
      </div>
      <div class="detail-sec-body">
        ${_renderSubItems(m.workItems,'No work items recorded.','workItem',id)}
      </div>
    </div>

    <!-- F. Feedback & Corrective Actions -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">📝 F. Faculty Feedback &amp; Corrective Actions</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="addMtgItem('${id}','feedback')">+ Add</button>
      </div>
      <div class="detail-sec-body">
        ${_renderSubItems(m.feedback,'No feedback recorded.','feedback',id)}
      </div>
    </div>

    <!-- G. Action Register -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">📋 G. Action Register</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="addMtgItem('${id}','actionItem')">+ Add Action Item</button>
      </div>
      <div class="detail-sec-body">
        ${_renderSubItems(m.actionItems,'No action items recorded.','actionItem',id)}
      </div>
    </div>

    <!-- H. Next Meeting Preparation -->
    <div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">📅 H. Next Meeting Preparation</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="addMtgItem('${id}','nextPrep')">+ Add</button>
      </div>
      <div class="detail-sec-body">
        ${_renderSubItems(m.nextPrep,'No next-meeting items recorded.','nextPrep',id)}
      </div>
    </div>`;
}

function _renderSubItems(items, emptyMsg, type, meetingId) {
  if (!items || !items.length) return `<div class="t-sm t-muted t-italic mb-2">${emptyMsg}</div>`;
  return items.map(item => {
    if (type==='discussion') return `<div class="li-item">
      <div class="li-header"><div class="li-title">${UI.esc(item.topic||item.question||'')}</div></div>
      ${item.alternatives?`<div class="li-body"><strong>Alternatives:</strong> ${UI.esc(item.alternatives)}</div>`:''}
      ${item.decision?`<div class="li-body"><strong>Decision:</strong> ${UI.esc(item.decision)}</div>`:''}
      ${item.reasoning?`<div class="li-body"><strong>Reasoning:</strong> ${UI.esc(item.reasoning)}</div>`:''}
      ${item.unresolved?`<div class="callout warn mt-2" style="padding:4px 8px"><strong>Unresolved:</strong> ${UI.esc(item.unresolved)}</div>`:''}
    </div>`;
    if (type==='workItem') return `<div class="li-item">
      <div class="li-header">
        <div><div class="li-title">${UI.esc(item.title)}</div>
        <div class="li-meta">${UI.esc(item.member||'—')} · ${UI.catChip(item.category||'—')} · ${item.evidenceType==='Demonstrated'?'<span class="verify-badge">✓ Demonstrated</span>':'<span class="unverified-badge">Self-reported</span>'}</div></div>
        ${UI.statusBadge(item.status||'—')}
      </div>
      ${item.evidence?`<div class="li-body t-xs"><strong>Evidence:</strong> ${UI.esc(item.evidence)}</div>`:''}
    </div>`;
    if (type==='feedback') return `<div class="li-item">
      <div class="li-title">${UI.esc(item.feedback)}</div>
      ${item.action?`<div class="li-body"><strong>Corrective action:</strong> ${UI.esc(item.action)}</div>`:''}
      ${item.owner?`<div class="li-meta">Owner: ${UI.esc(item.owner)}</div>`:''}
    </div>`;
    if (type==='actionItem') return `<div class="li-item">
      <div class="li-header">
        <div><div class="li-title">${UI.esc(item.task)}</div>
        <div class="li-meta">Owner: ${UI.esc(item.assignedTo||'—')} · Deadline: ${UI.fmtDateRaw(item.deadline)} · Deliverable: ${UI.esc(item.deliverable||'—')}</div></div>
        <div class="flex gap-1">${UI.priorityBadge(item.priority)} ${UI.statusBadge(item.status)}</div>
      </div>
    </div>`;
    if (type==='nextPrep') return `<div class="li-item">
      <div class="li-title">${UI.esc(item.item)}</div>
      ${item.owner?`<div class="li-meta">Owner: ${UI.esc(item.owner)}</div>`:''}
    </div>`;
    return '';
  }).join('');
}

/* ── Meeting CRUD ────────────────────────────────────────── */
let _editMtgId = null;
function openMeetingModal() {
  _editMtgId=null;
  document.getElementById('mtg-form').reset();
  document.getElementById('mtg-modal-title').textContent='Add Meeting';
  document.getElementById('mtg-number').value = DB.Meetings.list().length+1;
  document.getElementById('mtg-meetingId').value = DB.Seq.meeting();
  UI.openModal('meeting-modal');
}
function editMeeting(id) {
  const m=DB.Meetings.get(id); if(!m)return;
  _editMtgId=id;
  document.getElementById('mtg-modal-title').textContent='Edit Meeting';
  const fields=['number','meetingId','title','date','time','duration','type','attendees','absent','chair','minutesBy','objective','agenda','state'];
  fields.forEach(f=>{ const el=document.getElementById('mtg-'+f); if(el) el.value=m[f]||''; });
  UI.openModal('meeting-modal');
}
function saveMeeting() {
  const f=document.getElementById('mtg-form');
  if(!UI.validateForm(f))return;
  const data={
    number:    parseInt(document.getElementById('mtg-number').value)||1,
    meetingId: document.getElementById('mtg-meetingId').value.trim(),
    title:     document.getElementById('mtg-title').value.trim(),
    date:      document.getElementById('mtg-date').value,
    time:      document.getElementById('mtg-time').value,
    duration:  document.getElementById('mtg-duration').value.trim(),
    type:      document.getElementById('mtg-type').value,
    attendees: document.getElementById('mtg-attendees').value.trim(),
    absent:    document.getElementById('mtg-absent').value.trim(),
    chair:     document.getElementById('mtg-chair').value.trim(),
    minutesBy: document.getElementById('mtg-minutesBy').value.trim(),
    objective: document.getElementById('mtg-objective').value.trim(),
    agenda:    document.getElementById('mtg-agenda').value.trim(),
    state:     document.getElementById('mtg-state').value||'Draft',
  };
  if(_editMtgId) {
    DB.Meetings.update(_editMtgId,data);
    UI.toast('Meeting updated','ok');
  } else {
    const rec=DB.Meetings.add({...data,discussions:[],workItems:[],feedback:[],actionItems:[],nextPrep:[]});
    _meetingDetailId=rec.id;
  }
  UI.closeModal('meeting-modal');
  render_meetings();
  if(!_editMtgId) UI.toast('Meeting added — fill in the sections below','ok');
  _editMtgId=null;
}
async function deleteMeeting(id) {
  if(!await UI.confirm('Permanently delete this meeting record and all its contents?','Delete Meeting?'))return;
  DB.Meetings.remove(id); _meetingDetailId=null; render_meetings(); UI.toast('Meeting deleted');
}
function advanceMeetingState(id) {
  const m=DB.Meetings.get(id); if(!m)return;
  const states=DB.STATUS.meeting;
  const next=states[(states.indexOf(m.state||'Draft')+1)%states.length];
  DB.Meetings.update(id,{state:next});
  UI.toast(`Meeting state → ${next}`, 'ok');
  render_meetings();
}
function duplicateMeeting(id) {
  openMeetingModal();
  UI.toast('Structure ready. Fill in new meeting details — prior content not copied.','',4000);
}

/* ── Meeting sub-item modal ──────────────────────────────── */
let _mtgItemCtx={};
function addMtgItem(meetingId,type) {
  _mtgItemCtx={meetingId,type};
  const titles={discussion:'Add Discussion/Decision',workItem:'Add Work Item',
    feedback:'Add Faculty Feedback',actionItem:'Add Action Item',nextPrep:'Add Next Meeting Prep Item'};
  document.getElementById('sub-modal-title').textContent=titles[type]||'Add Item';
  _buildSubItemForm(type);
  UI.openModal('sub-item-modal');
}
function _buildSubItemForm(type) {
  const b=document.getElementById('sub-form-body');
  if(type==='discussion') b.innerHTML=`
    <div class="fg"><label class="lbl">Topic / Question <span class="req">*</span></label><input name="topic" class="fc" required></div>
    <div class="fg"><label class="lbl">Alternatives Considered</label><textarea name="alternatives" class="fc"></textarea></div>
    <div class="fg"><label class="lbl">Final Decision</label><textarea name="decision" class="fc"></textarea></div>
    <div class="fg"><label class="lbl">Reasoning / Rationale</label><textarea name="reasoning" class="fc"></textarea></div>
    <div class="fg"><label class="lbl">Unresolved Questions</label><input name="unresolved" class="fc"></div>`;
  else if(type==='workItem') b.innerHTML=`
    <div class="fg"><label class="lbl">Work Description <span class="req">*</span></label><input name="title" class="fc" required></div>
    <div class="fg-row">
      <div class="fg"><label class="lbl">Team Member</label><input name="member" class="fc"></div>
      <div class="fg"><label class="lbl">Category</label>
        <select name="category" class="fc">${UI.opts(['Feature','Bug Fix','Research','Database','Search Algorithm','UI/Frontend','API/Backend','Documentation','Testing','Other'],'')}</select>
      </div>
    </div>
    <div class="fg-row">
      <div class="fg"><label class="lbl">Evidence Type</label>
        <select name="evidenceType" class="fc">${UI.opts(['Self-Reported','Demonstrated','Code Review Verified','Test Verified'],'Self-Reported')}</select>
      </div>
      <div class="fg"><label class="lbl">Status</label>
        <select name="status" class="fc">${UI.opts(['Completed','In Progress','Pending'],'Completed')}</select>
      </div>
    </div>
    <div class="fg"><label class="lbl">Evidence / Link (commit, file, demo)</label><input name="evidence" class="fc" placeholder="e.g. commit abc1234 or /src/search.py"></div>`;
  else if(type==='feedback') b.innerHTML=`
    <div class="fg"><label class="lbl">Faculty Feedback <span class="req">*</span></label><textarea name="feedback" class="fc" required></textarea></div>
    <div class="fg"><label class="lbl">Required Corrective Action</label><textarea name="action" class="fc"></textarea></div>
    <div class="fg"><label class="lbl">Responsible Person</label><input name="owner" class="fc"></div>`;
  else if(type==='actionItem') b.innerHTML=`
    <div class="fg"><label class="lbl">Task Description <span class="req">*</span></label><input name="task" class="fc" required></div>
    <div class="fg-row">
      <div class="fg"><label class="lbl">Assigned To</label><input name="assignedTo" class="fc"></div>
      <div class="fg"><label class="lbl">Deadline</label><input name="deadline" type="date" class="fc"></div>
    </div>
    <div class="fg-row">
      <div class="fg"><label class="lbl">Priority</label>
        <select name="priority" class="fc">${UI.opts(['Critical','High','Medium','Low'],'Medium')}</select>
      </div>
      <div class="fg"><label class="lbl">Status</label>
        <select name="status" class="fc">${UI.opts(['Pending','In Progress','Completed'],'Pending')}</select>
      </div>
    </div>
    <div class="fg"><label class="lbl">Expected Deliverable</label><input name="deliverable" class="fc"></div>`;
  else if(type==='nextPrep') b.innerHTML=`
    <div class="fg"><label class="lbl">Preparation Item <span class="req">*</span></label><input name="item" class="fc" required></div>
    <div class="fg"><label class="lbl">Responsible</label><input name="owner" class="fc"></div>`;
}
function saveSubItem() {
  const f=document.getElementById('sub-item-form');
  if(!UI.validateForm(f))return;
  const {meetingId,type}=_mtgItemCtx;
  const m=DB.Meetings.get(meetingId); if(!m)return;
  const data={...UI.readForm(f), id:DB.genId('si')};
  const key={discussion:'discussions',workItem:'workItems',feedback:'feedback',actionItem:'actionItems',nextPrep:'nextPrep'}[type];
  DB.Meetings.update(meetingId,{[key]:[...(m[key]||[]),data]});
  UI.closeModal('sub-item-modal');
  _renderMeetingDetail(meetingId);
  UI.toast('Item saved','ok');
}
function openDirectiveModalForMeeting(meetingId) {
  openDirectiveModal();
  setTimeout(()=>{ const el=document.getElementById('dir-meetingId'); if(el){el.innerHTML=UI.meetingOpts(meetingId);} },50);
}

/* ════════════════════════════════════════════════════════════
   PAGE 3 — FACULTY DIRECTIVES
   ════════════════════════════════════════════════════════════ */
window.render_directives = function () {
  const all    = DB.Directives.list().sort((a,b)=>(a.directiveId||'').localeCompare(b.directiveId||''));
  const search = document.getElementById('dir-search')?.value||'';
  const statF  = document.getElementById('dir-status-filter')?.value||'';
  const prioF  = document.getElementById('dir-prio-filter')?.value||'';
  let   list   = UI.filterList(all,search,['directiveId','instruction','assignedTo','expectedOutcome']);
  if(statF) list=list.filter(d=>d.status===statF);
  if(prioF) list=list.filter(d=>d.priority===prioF);

  const ds  = DB.Stats.directives();
  const el  = document.getElementById('directives-content');

  let html=`<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
    <div class="stat-cell accent-left"><div class="stat-lbl">Total</div><div class="stat-val c-accent">${ds.total}</div></div>
    <div class="stat-cell ok-left"><div class="stat-lbl">Verified</div><div class="stat-val c-ok">${ds.verified}</div></div>
    <div class="stat-cell accent-left"><div class="stat-lbl">In Progress</div><div class="stat-val c-accent">${ds.inProg}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">Under Review</div><div class="stat-val c-warn">${ds.review}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Blocked</div><div class="stat-val c-err">${ds.blocked}</div></div>
    <div class="stat-cell"><div class="stat-lbl">Pending</div><div class="stat-val">${ds.pending}</div></div>
  </div>`;

  if(!list.length) {
    html+=all.length===0
      ? UI.emptyState({icon:'🎓',title:'No faculty directives recorded',desc:'Record every instruction and requirement from your faculty guide.',btn:'+ Add Directive',btnCb:'openDirectiveModal()'})
      : UI.emptyState({icon:'🔍',title:'No directives match your filter',desc:'Adjust the search or filters.'});
    el.innerHTML=html; return;
  }

  html+=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      <th>ID</th><th>Date</th><th>Instruction</th><th>Meeting</th>
      <th>Assigned</th><th>Deadline</th><th>Priority</th><th>Status</th>
      <th>Verification</th><th class="no-print">Actions</th>
    </tr></thead>
    <tbody>${list.map(d=>`<tr>
      <td class="id-cell">${UI.esc(d.directiveId||'—')}</td>
      <td style="white-space:nowrap">${UI.fmtDateRaw(d.dateReceived)}</td>
      <td style="max-width:240px">
        <div class="t-semi">${UI.esc(d.instruction)}</div>
        ${d.expectedOutcome?`<div class="t-xs t-muted mt-1">Expected: ${UI.esc(d.expectedOutcome)}</div>`:''}
        ${d.acceptanceCriteria?`<div class="t-xs t-muted">Criteria: ${UI.esc(d.acceptanceCriteria)}</div>`:''}
      </td>
      <td>${d.meetingId?UI.meetingRef(d.meetingId):'<span class="nr">—</span>'}</td>
      <td>${UI.esc(d.assignedTo||'—')}</td>
      <td style="white-space:nowrap">${UI.fmtDateRaw(d.deadline)}</td>
      <td>${UI.priorityBadge(d.priority)}</td>
      <td>${UI.statusBadge(d.status)}</td>
      <td>${UI.verifyBadge(d.verificationMethod)}</td>
      <td class="no-print"><div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-xs" onclick="editDirective('${d.id}')" title="Edit">✏</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="viewDirectiveTrace('${d.id}')" title="Trace">🔗</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteDirective('${d.id}')" title="Delete">✕</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  el.innerHTML=html;
};

function viewDirectiveTrace(id) {
  const d=DB.Directives.get(id); if(!d)return;
  const trace=DB.Trace.forDirective(id);
  const el=document.getElementById('trace-modal-body');
  el.innerHTML=`
    <div class="kv-grid mb-4">
      ${UI.kv('Directive ID', d.directiveId, {mono:true})}
      ${UI.kv('Instruction', d.instruction)}
      ${UI.kv('Status', '', {isHtml:true})}
    </div>
    <div class="t-semi mb-2">Traceability Chain</div>
    ${UI.traceChain([
      {label:`Meeting ${trace.meeting?.number||'?'}`, id:trace.meeting?.id||'', onclick:trace.meeting?`viewMeeting('${trace.meeting.id}');UI.closeAll();UI.navigate('meetings',false)`:'' },
      {label:`Directive ${d.directiveId}`, id:d.id},
      ...trace.tasks.map(t=>({label:`Task ${t.taskId||t.id}`, id:t.id})),
      ...trace.changes.map(c=>({label:`Change ${c.changeId}`, id:c.id})),
    ])}
    <div class="divider mt-3"></div>
    <div class="t-semi mb-2">Linked Tasks (${trace.tasks.length})</div>
    ${trace.tasks.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task ID</th><th>Title</th><th>Member</th><th>Status</th></tr></thead>
    <tbody>${trace.tasks.map(t=>`<tr><td class="id-cell">${UI.esc(t.taskId||'—')}</td><td>${UI.esc(t.title)}</td><td>${UI.memberName(t.assignedTo)}</td><td>${UI.statusBadge(t.status)}</td></tr>`).join('')}</tbody></table></div>`
    :'<div class="t-sm t-muted t-italic">No tasks linked.</div>'}
    <div class="t-semi mt-3 mb-2">Linked Technical Changes (${trace.changes.length})</div>
    ${trace.changes.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Change ID</th><th>Title</th><th>Status</th></tr></thead>
    <tbody>${trace.changes.map(c=>`<tr><td class="id-cell">${UI.esc(c.changeId||'—')}</td><td>${UI.esc(c.title)}</td><td>${UI.statusBadge(c.status)}</td></tr>`).join('')}</tbody></table></div>`
    :'<div class="t-sm t-muted t-italic">No changes linked.</div>'}
    ${d.verificationEvidence?`<div class="callout ok mt-3"><strong>Verification Evidence</strong>${UI.esc(d.verificationEvidence)}</div>`:''}`;
  document.getElementById('trace-modal-title').textContent=`Traceability — ${d.directiveId}`;
  UI.openModal('trace-modal');
}

let _editDirId=null;
function openDirectiveModal() {
  _editDirId=null;
  document.getElementById('dir-form').reset();
  document.getElementById('dir-modal-title').textContent='Add Faculty Directive';
  document.getElementById('dir-directiveId').value=DB.Seq.directive();
  document.getElementById('dir-meetingId').innerHTML=UI.meetingOpts();
  UI.openModal('directive-modal');
}
function editDirective(id) {
  const d=DB.Directives.get(id); if(!d)return;
  _editDirId=id;
  document.getElementById('dir-modal-title').textContent='Edit Directive';
  document.getElementById('dir-meetingId').innerHTML=UI.meetingOpts(d.meetingId);
  const fields=['directiveId','dateReceived','instruction','category','assignedTo','expectedOutcome','acceptanceCriteria','deadline','priority','status','verificationMethod','verificationEvidence','evidenceReference','facultyFeedback','closureDate','followUp'];
  fields.forEach(f=>{ const el=document.getElementById('dir-'+f); if(el) el.value=d[f]||''; });
  UI.openModal('directive-modal');
}
function saveDirective() {
  const f=document.getElementById('dir-form');
  if(!UI.validateForm(f))return;
  const data={
    directiveId:         document.getElementById('dir-directiveId').value.trim(),
    dateReceived:        document.getElementById('dir-dateReceived').value,
    instruction:         document.getElementById('dir-instruction').value.trim(),
    category:            document.getElementById('dir-category').value,
    meetingId:           document.getElementById('dir-meetingId').value,
    assignedTo:          document.getElementById('dir-assignedTo').value.trim(),
    expectedOutcome:     document.getElementById('dir-expectedOutcome').value.trim(),
    acceptanceCriteria:  document.getElementById('dir-acceptanceCriteria').value.trim(),
    deadline:            document.getElementById('dir-deadline').value,
    priority:            document.getElementById('dir-priority').value,
    status:              document.getElementById('dir-status').value,
    verificationMethod:  document.getElementById('dir-verificationMethod').value.trim(),
    verificationEvidence:document.getElementById('dir-verificationEvidence').value.trim(),
    evidenceReference:   document.getElementById('dir-evidenceReference').value.trim(),
    facultyFeedback:     document.getElementById('dir-facultyFeedback').value.trim(),
    closureDate:         document.getElementById('dir-closureDate').value,
    followUp:            document.getElementById('dir-followUp').value.trim(),
  };
  if(_editDirId){DB.Directives.update(_editDirId,data);UI.toast('Directive updated','ok');}
  else{DB.Directives.add(data);UI.toast('Directive added','ok');}
  UI.closeModal('directive-modal');
  render_directives(); _editDirId=null;
}
async function deleteDirective(id) {
  if(!await UI.confirm('Delete this directive record?','Delete Directive?'))return;
  DB.Directives.remove(id); render_directives(); UI.toast('Deleted');
}

/* ════════════════════════════════════════════════════════════
   PAGE 4 — TEAM CONTRIBUTIONS
   ════════════════════════════════════════════════════════════ */
let _memberDetailId=null;

window.render_contributions = function () {
  const listV  = document.getElementById('contrib-list-view');
  const detailV= document.getElementById('contrib-detail-view');
  if(_memberDetailId){
    listV.style.display='none'; detailV.style.display='block';
    _renderMemberDetail(_memberDetailId);
  } else {
    listV.style.display='block'; detailV.style.display='none';
    _renderMemberList();
  }
};

function _renderMemberList() {
  const members=DB.Members.list();
  const el=document.getElementById('contrib-list-content');
  if(!members.length){
    el.innerHTML=UI.emptyState({icon:'👥',title:'No team members recorded',desc:'Add each team member to begin tracking contributions.',btn:'+ Add Member',btnCb:'openMemberModal()'});
    return;
  }
  // Summary matrix table
  let matrix=`<div class="tbl-wrap mb-5"><table class="tbl">
    <thead><tr><th>Member</th><th>Role</th><th>Responsibilities</th><th>Completed</th><th>In Progress</th><th>Pending</th><th>Verified Deliverables</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${members.map(m=>{
      const s=DB.Stats.memberSummary(m.id);
      return `<tr style="cursor:pointer" onclick="viewMember('${m.id}')">
        <td><div class="flex f-ac gap-2">${UI.avatar(m.name,26)}<span class="t-semi">${UI.esc(m.name)}</span></div></td>
        <td>${UI.esc(m.role||'—')}</td>
        <td class="trunc" style="max-width:160px">${UI.esc(m.responsibilities||'—')}</td>
        <td><span class="t-semi" style="color:var(--ok)">${s.completed}</span></td>
        <td><span class="t-semi" style="color:var(--accent)">${s.inProgress}</span></td>
        <td><span class="t-semi" style="color:var(--warn)">${s.pending}</span></td>
        <td><span class="verify-badge">${s.deliverables} deliverable${s.deliverables!==1?'s':''}</span></td>
        <td class="no-print"><div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-xs" onclick="event.stopPropagation();editMember('${m.id}')">✏</button>
          <button class="btn btn-ghost btn-icon btn-xs" onclick="event.stopPropagation();deleteMember('${m.id}')">✕</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  // Member cards
  let cards=`<div class="grid-3">${members.map(m=>{
    const s=DB.Stats.memberSummary(m.id);
    const pct=s.total?Math.round((s.completed/s.total)*100):0;
    return `<div class="card" style="cursor:pointer" onclick="viewMember('${m.id}')">
      <div class="card-body">
        <div class="flex f-ac gap-3 mb-3">
          ${UI.avatar(m.name,38)}
          <div><div class="t-semi">${UI.esc(m.name)}</div><div class="t-xs t-muted">${UI.esc(m.role||'Team Member')}</div></div>
        </div>
        <div class="t-xs t-muted mb-2">${UI.esc(m.responsibilities||'—')}</div>
        <div class="prog-wrap mb-1"><div class="prog-fill" style="width:${pct}%"></div></div>
        <div class="t-xs t-muted">${pct}% tasks · ${s.deliverables} deliverables</div>
      </div>
    </div>`;
  }).join('')}</div>`;

  el.innerHTML=matrix+cards;
}

function viewMember(id) { _memberDetailId=id; render_contributions(); }
function backToMembers() { _memberDetailId=null; render_contributions(); }

function _renderMemberDetail(id) {
  const m=DB.Members.get(id);
  const el=document.getElementById('contrib-detail-content');
  if(!m){ el.innerHTML='<div class="t-muted">Member not found.</div>'; return; }
  const tasks=DB.Tasks.list().filter(t=>t.assignedTo===id);
  const delivs=DB.Deliverables.list().filter(d=>d.memberId===id);
  const contribs=DB.Contribs.list().filter(c=>c.memberId===id);
  const s=DB.Stats.memberSummary(id);

  el.innerHTML=`
    <div class="detail-back no-print" onclick="backToMembers()">← Team Contributions</div>
    <div class="flex f-jb f-ac flex-wrap gap-3 mb-4">
      <div class="flex f-ac gap-3">
        ${UI.avatar(m.name,48)}
        <div>
          <div style="font-size:var(--fs-xl);font-weight:700">${UI.esc(m.name)}</div>
          <div class="t-sm t-muted">${UI.esc(m.role||'Team Member')}${m.studentId?' · '+UI.esc(m.studentId):''}</div>
        </div>
      </div>
      <div class="flex gap-2 no-print">
        <button class="btn btn-sm btn-secondary" onclick="editMember('${id}')">✏ Edit Profile</button>
        <button class="btn btn-sm btn-primary" onclick="openTaskModal(null,'${id}')">+ Add Task</button>
        <button class="btn btn-sm btn-secondary" onclick="openContribModal('${id}')">+ Log Contribution</button>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="card"><div class="card-header"><div class="card-title">Profile</div></div>
        <div class="card-body">
          <div class="kv-grid">
            ${UI.kv('Responsibilities', m.responsibilities||'—')}
            ${UI.kv('Components Owned', m.components||'—')}
            ${UI.kv('Email', m.email||'—')}
            ${UI.kv('GitHub', m.github||'—')}
          </div>
        </div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">Task Summary</div></div>
        <div class="card-body">
          <div class="stat-row" style="grid-template-columns:1fr 1fr">
            <div class="stat-cell ok-left"><div class="stat-lbl">Completed</div><div class="stat-val c-ok">${s.completed}</div></div>
            <div class="stat-cell accent-left"><div class="stat-lbl">In Progress</div><div class="stat-val c-accent">${s.inProgress}</div></div>
            <div class="stat-cell warn-left"><div class="stat-lbl">Pending</div><div class="stat-val c-warn">${s.pending}</div></div>
            <div class="stat-cell"><div class="stat-lbl">Verified</div><div class="stat-val">${s.deliverables}</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tasks -->
    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Assigned Tasks</div>
        <button class="btn btn-sm btn-primary no-print" onclick="openTaskModal(null,'${id}')">+ Add Task</button>
      </div>
      <div class="card-body">
        ${tasks.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>ID</th><th>Task</th><th>Directive</th><th>Category</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Evidence &amp; Proof</th><th class="no-print">Actions</th></tr></thead>
          <tbody>${tasks.map(t=>`<tr>
            <td class="id-cell">${UI.esc(t.taskId||'—')}</td>
            <td>${UI.esc(t.title)}</td>
            <td>${t.directiveId?UI.directiveRef(t.directiveId):'<span class="nr">—</span>'}</td>
            <td>${UI.catChip(t.category||'—')}</td>
            <td>${UI.priorityBadge(t.priority)}</td>
            <td style="white-space:nowrap">${UI.fmtDateRaw(t.deadline)}</td>
            <td>${UI.statusBadge(t.status)}</td>
            <td>${UI.evidenceThumb(t.taskId||t.id)}</td>
            <td class="no-print"><div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-xs" onclick="openEvidenceModal('${t.taskId||t.id}', 0)" title="Evidence &amp; Verification">📸</button>
              <button class="btn btn-ghost btn-icon btn-xs" onclick="editTask('${t.id}')">✏</button>
              <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteTask('${t.id}','${id}')">✕</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="t-sm t-muted t-italic">No tasks assigned.</div>`}
      </div>
    </div>

    <!-- Deliverables -->
    <div class="card mb-4">
      <div class="card-header"><div class="card-title">Deliverables &amp; Evidence</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="openDeliverableModal('${id}')">+ Add Deliverable</button>
      </div>
      <div class="card-body">
        ${delivs.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Date</th><th>Link</th></tr></thead>
          <tbody>${delivs.map(d=>`<tr>
            <td class="id-cell">${UI.esc(d.deliverableId||'—')}</td>
            <td>${UI.esc(d.title)}</td>
            <td>${UI.catChip(d.type||'—')}</td>
            <td>${UI.fmtDateRaw(d.date)}</td>
            <td>${d.link?`<a href="${UI.esc(d.link)}" target="_blank" class="t-xs t-accent">Open ↗</a>`:'<span class="nr">—</span>'}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="t-sm t-muted t-italic">No deliverables recorded.</div>`}
      </div>
    </div>

    <!-- Contribution history -->
    <div class="card">
      <div class="card-header"><div class="card-title">Contribution History</div>
        <button class="btn btn-sm btn-secondary no-print" onclick="openContribModal('${id}')">+ Log Entry</button>
      </div>
      <div class="card-body">
        ${contribs.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Date</th><th>Description</th><th>Meeting</th><th>Tier</th></tr></thead>
          <tbody>${contribs.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(c=>`<tr>
            <td style="white-space:nowrap">${UI.fmtDateRaw(c.date)}</td>
            <td>${UI.esc(c.description)}</td>
            <td>${c.meetingId?UI.meetingRef(c.meetingId):'<span class="nr">—</span>'}</td>
            <td>${UI.tierBadge(c.tier)}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="t-sm t-muted t-italic">No contribution history recorded.</div>`}
      </div>
    </div>`;
}

/* Member CRUD */
let _editMbrId=null;
function openMemberModal(){ _editMbrId=null; document.getElementById('member-form').reset(); document.getElementById('member-modal-title').textContent='Add Team Member'; UI.openModal('member-modal'); }
function editMember(id){ const m=DB.Members.get(id); if(!m)return; _editMbrId=id; document.getElementById('member-modal-title').textContent='Edit Member';
  ['name','role','studentId','email','github','responsibilities','components','notes'].forEach(f=>{ const el=document.getElementById('mbr-'+f); if(el)el.value=m[f]||''; });
  UI.openModal('member-modal'); }
function saveMember(){ const f=document.getElementById('member-form'); if(!UI.validateForm(f))return;
  const data={name:document.getElementById('mbr-name').value.trim(),role:document.getElementById('mbr-role').value.trim(),studentId:document.getElementById('mbr-studentId').value.trim(),email:document.getElementById('mbr-email').value.trim(),github:document.getElementById('mbr-github').value.trim(),responsibilities:document.getElementById('mbr-responsibilities').value.trim(),components:document.getElementById('mbr-components').value.trim(),notes:document.getElementById('mbr-notes').value.trim()};
  if(_editMbrId){DB.Members.update(_editMbrId,data);UI.toast('Member updated','ok');}
  else{DB.Members.add(data);UI.toast('Member added','ok');}
  UI.closeModal('member-modal'); render_contributions(); _editMbrId=null; }
async function deleteMember(id){ if(!await UI.confirm('Delete this member? Their tasks remain but will be unassigned.'))return; DB.Members.remove(id); _memberDetailId=null; render_contributions(); UI.toast('Member removed'); }

/* Task CRUD */
let _editTaskId=null;
function _refreshCurrentTasksView() {
  const cp = UI.currentPage();
  if (cp === 'team-tasks' && window.render_team_tasks) render_team_tasks();
  else if (cp === 'dashboard' && window.render_dashboard) render_dashboard();
  else if (cp === 'contributions' && window.render_contributions) {
    if (_memberDetailId) _renderMemberDetail(_memberDetailId);
    else render_contributions();
  }
  else if (window.render_tasks_milestones) render_tasks_milestones();
}

function openTaskModal(taskId,defaultMbr){
  _editTaskId=null;
  document.getElementById('task-form').reset();
  document.getElementById('task-modal-title').textContent='Add Task';
  document.getElementById('task-assignedTo').innerHTML=UI.memberOpts(defaultMbr);
  document.getElementById('task-directiveId').innerHTML=UI.directiveOpts();
  document.getElementById('task-taskId').value=DB.Seq.task();
  const proofPreview = document.getElementById('task-modal-evidence-preview');
  if (proofPreview) proofPreview.innerHTML = '<span class="t-xs t-muted">Save the task first to attach screenshots or upload evidence directly.</span>';
  UI.openModal('task-modal');
}
function editTask(id){
  const t=DB.Tasks.get(id); if(!t)return;
  _editTaskId=id;
  document.getElementById('task-modal-title').textContent='Edit Task';
  document.getElementById('task-assignedTo').innerHTML=UI.memberOpts(t.assignedTo);
  document.getElementById('task-directiveId').innerHTML=UI.directiveOpts(t.directiveId);
  ['taskId','title','category','priority','deadline','status','evidence','notes'].forEach(f=>{ const el=document.getElementById('task-'+f); if(el)el.value=t[f]||''; });

  const proofPreview = document.getElementById('task-modal-evidence-preview');
  if (proofPreview) {
    const evList = DB.Evidence ? DB.Evidence.list(t.taskId || t.id) : [];
    if (evList.length) {
      proofPreview.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <div style="display:flex;align-items:center;gap:8px">
            <img src="${UI.esc(evList[0].url||evList[0].file_url)}" style="width:36px;height:36px;object-fit:cover;border-radius:3px;border:1px solid var(--border)">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--ok)">✓ ${evList.length} Proof Image${evList.length>1?'s':''} Attached</div>
              <div style="font-size:10px;color:var(--text-3)">Latest: ${UI.fmtDateRaw(evList[evList.length-1].uploadedAt||evList[evList.length-1].uploaded_at)}</div>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-xs" onclick="UI.closeModal('task-modal'); openEvidenceModal('${t.taskId||t.id}', 0)">Manage Proof ↗</button>
        </div>
      `;
    } else {
      proofPreview.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <span class="t-xs t-muted">No screenshot proof attached yet.</span>
          <button type="button" class="btn btn-secondary btn-xs" onclick="UI.closeModal('task-modal'); openEvidenceModal('${t.taskId||t.id}', 0, true)">+ Attach Proof</button>
        </div>
      `;
    }
  }

  UI.openModal('task-modal');
}
function saveTask(){
  const f=document.getElementById('task-form'); if(!UI.validateForm(f))return;
  const data={taskId:document.getElementById('task-taskId').value.trim(),title:document.getElementById('task-title').value.trim(),assignedTo:document.getElementById('task-assignedTo').value,directiveId:document.getElementById('task-directiveId').value,category:document.getElementById('task-category').value,priority:document.getElementById('task-priority').value,deadline:document.getElementById('task-deadline').value,status:document.getElementById('task-status').value,evidence:document.getElementById('task-evidence').value.trim(),notes:document.getElementById('task-notes').value.trim()};
  if(_editTaskId){DB.Tasks.update(_editTaskId,data);UI.toast('Task updated','ok');}
  else{DB.Tasks.add(data);UI.toast('Task added','ok');}
  UI.closeModal('task-modal');
  _refreshCurrentTasksView();
  _editTaskId=null;
}
async function deleteTask(id,mbr){
  if(!await UI.confirm('Delete this task?'))return;
  DB.Tasks.remove(id);
  UI.toast('Deleted');
  _refreshCurrentTasksView();
}

/* Deliverable */
let _delivMbrId=null;
function openDeliverableModal(mbrId){ _delivMbrId=mbrId; document.getElementById('deliv-form').reset(); document.getElementById('deliv-deliverableId').value=DB.Seq.deliverable(); UI.openModal('deliverable-modal'); }
function saveDeliverable(){ const f=document.getElementById('deliv-form'); if(!UI.validateForm(f))return;
  const data={deliverableId:document.getElementById('deliv-deliverableId').value.trim(),memberId:_delivMbrId,title:document.getElementById('deliv-title').value.trim(),type:document.getElementById('deliv-type').value,date:document.getElementById('deliv-date').value,link:document.getElementById('deliv-link').value.trim(),notes:document.getElementById('deliv-notes').value.trim()};
  if(!data.title){UI.toast('Enter a title','err');return;}
  DB.Deliverables.add(data); UI.closeModal('deliverable-modal'); _renderMemberDetail(_delivMbrId); UI.toast('Deliverable added','ok'); }

/* Contribution */
let _contribMbrId=null;
function openContribModal(mbrId){ _contribMbrId=mbrId; document.getElementById('contrib-form').reset(); document.getElementById('contrib-meetingId').innerHTML=UI.meetingOpts(); UI.openModal('contrib-modal'); }
function saveContrib(){ const f=document.getElementById('contrib-form'); if(!UI.validateForm(f))return;
  const data={memberId:_contribMbrId,date:document.getElementById('contrib-date').value,description:document.getElementById('contrib-description').value.trim(),meetingId:document.getElementById('contrib-meetingId').value,tier:document.getElementById('contrib-tier').value,evidence:document.getElementById('contrib-evidence').value.trim()};
  DB.Contribs.add(data); UI.closeModal('contrib-modal'); _renderMemberDetail(_contribMbrId); UI.toast('Contribution logged','ok'); }

/* ════════════════════════════════════════════════════════════
   PAGE 5 — DEVELOPMENT HISTORY
   ════════════════════════════════════════════════════════════ */
window.render_dev_history = function () {
  const activeTab=document.querySelector('#chg-tabs .tab-btn.active')?.dataset.tab||'all';
  _renderChangesTab(activeTab);
};

function _renderChangesTab(tab) {
  document.querySelectorAll('#chg-tabs .tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const all=DB.Changes.list().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const list=tab==='all'?all:all.filter(c=>c.subsystem===tab);
  const el=document.getElementById('chg-content');

  if(!list.length){
    el.innerHTML=all.length===0
      ? UI.emptyState({icon:'🔧',title:'No technical changes recorded',desc:'Document every meaningful change to the search engine.',btn:'+ Record Change',btnCb:'openChangeModal()'})
      : UI.emptyState({icon:'🔍',title:'No changes in this subsystem',desc:''});
    return;
  }

  el.innerHTML=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Change ID</th><th>Date</th><th>Subsystem</th><th>Change</th><th>Directive</th><th>Member</th><th>Commit / File</th><th>Status</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${list.map(c=>`<tr>
      <td class="id-cell">${UI.esc(c.changeId||'—')}</td>
      <td style="white-space:nowrap">${UI.fmtDateRaw(c.date)}</td>
      <td>${UI.catChip(c.subsystem||c.category||'—')}</td>
      <td style="max-width:240px">
        <div class="t-semi">${UI.esc(c.title)}</div>
        ${c.newBehaviour?`<div class="t-xs t-muted mt-1">${UI.esc(c.newBehaviour.slice(0,80))}${c.newBehaviour.length>80?'…':''}</div>`:''}
        ${c.isPlanned?'<span class="badge s-planned mt-1">Planned — not yet implemented</span>':''}
      </td>
      <td>${c.directiveId?UI.directiveRef(c.directiveId):'<span class="nr">—</span>'}</td>
      <td>${UI.esc(c.implementedBy||'—')}</td>
      <td class="t-mono t-xs">${UI.esc(c.commit||'—')}</td>
      <td>${UI.statusBadge(c.status)}</td>
      <td class="no-print"><div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-xs" onclick="editChange('${c.id}')">✏</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteChange('${c.id}')">✕</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

let _editChgId=null;
function openChangeModal(){ _editChgId=null; document.getElementById('change-form').reset(); document.getElementById('change-modal-title').textContent='Record Technical Change'; document.getElementById('chg-changeId').value=DB.Seq.change(); document.getElementById('chg-directiveId').innerHTML=UI.directiveOpts(); UI.openModal('change-modal'); }
function editChange(id){ const c=DB.Changes.get(id); if(!c)return; _editChgId=id; document.getElementById('change-modal-title').textContent='Edit Change'; document.getElementById('chg-directiveId').innerHTML=UI.directiveOpts(c.directiveId);
  ['changeId','title','subsystem','date','prevBehaviour','newBehaviour','reason','implementedBy','commit','testing','status'].forEach(f=>{ const el=document.getElementById('chg-'+f); if(el)el.value=c[f]||''; });
  document.getElementById('chg-isPlanned').checked=!!c.isPlanned; UI.openModal('change-modal'); }
function saveChange(){ const f=document.getElementById('change-form'); if(!UI.validateForm(f))return;
  const data={changeId:document.getElementById('chg-changeId').value.trim(),title:document.getElementById('chg-title').value.trim(),subsystem:document.getElementById('chg-subsystem').value,category:document.getElementById('chg-subsystem').value,date:document.getElementById('chg-date').value,prevBehaviour:document.getElementById('chg-prevBehaviour').value.trim(),newBehaviour:document.getElementById('chg-newBehaviour').value.trim(),reason:document.getElementById('chg-reason').value.trim(),implementedBy:document.getElementById('chg-implementedBy').value.trim(),commit:document.getElementById('chg-commit').value.trim(),testing:document.getElementById('chg-testing').value.trim(),status:document.getElementById('chg-status').value,directiveId:document.getElementById('chg-directiveId').value,isPlanned:document.getElementById('chg-isPlanned').checked};
  if(_editChgId){DB.Changes.update(_editChgId,data);UI.toast('Change updated','ok');}
  else{DB.Changes.add(data);UI.toast('Change recorded','ok');}
  UI.closeModal('change-modal'); render_dev_history(); _editChgId=null; }
async function deleteChange(id){ if(!await UI.confirm('Delete this change record?'))return; DB.Changes.remove(id); render_dev_history(); UI.toast('Deleted'); }

/* ════════════════════════════════════════════════════════════
   PAGE 6 — TECHNICAL DECISIONS
   ════════════════════════════════════════════════════════════ */
window.render_decisions = function () {
  const all=DB.Decisions.list().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const search=document.getElementById('dec-search')?.value||'';
  const statF=document.getElementById('dec-status-filter')?.value||'';
  let list=UI.filterList(all,search,['decisionId','question','decision','status']);
  if(statF) list=list.filter(d=>d.status===statF);
  const el=document.getElementById('decisions-content');

  if(!list.length){
    el.innerHTML=all.length===0
      ? UI.emptyState({icon:'🔬',title:'No technical decisions recorded',desc:'Document every significant engineering decision and the reasoning behind it.',btn:'+ Add Decision',btnCb:'openDecisionModal()'})
      : UI.emptyState({icon:'🔍',title:'No decisions match your filter',desc:''});
    return;
  }

  el.innerHTML=list.map(d=>`
    <div class="detail-sec mb-3">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">${UI.idTag(d.decisionId||'—')} ${UI.esc(d.question)}</div>
        <div class="flex gap-2 f-ac">
          ${UI.statusBadge(d.status||'Under Review')}
          ${UI.statusBadge(d.implementationStatus||'Planned')}
          <button class="btn btn-ghost btn-icon btn-xs no-print" onclick="editDecision('${d.id}')">✏</button>
          <button class="btn btn-ghost btn-icon btn-xs no-print" onclick="deleteDecision('${d.id}')">✕</button>
        </div>
      </div>
      <div class="detail-sec-body">
        <div class="kv-grid">
          ${UI.kv('Decision ID', d.decisionId, {mono:true})}
          ${UI.kv('Date', UI.fmtDateRaw(d.date))}
          ${UI.kv('Problem Statement', d.problemStatement||'—')}
          ${UI.kv('Options Evaluated', d.options||'—')}
          ${UI.kv('Evidence & Sources', d.sources||'—')}
          ${UI.kv('Advantages', d.advantages||'—')}
          ${UI.kv('Limitations', d.limitations||'—')}
          ${UI.kv('Decision Taken', d.decision||'—')}
          ${UI.kv('Reasoning', d.reasoning||'—')}
          ${UI.kv('Approval Status', d.status||'—')}
          ${UI.kv('Implementation Status', d.implementationStatus||'—')}
          ${UI.kv('Consequences', d.consequences||'—')}
          ${UI.kv('Follow-up Work', d.followUp||'—')}
        </div>
        <div class="t-xs t-muted mt-2">Recorded: ${UI.fmtDateRaw(d.createdAt)}</div>
      </div>
    </div>`).join('');
};

let _editDecId=null;
function openDecisionModal(){ _editDecId=null; document.getElementById('decision-form').reset(); document.getElementById('dec-modal-title').textContent='Add Technical Decision'; document.getElementById('dec-decisionId').value=DB.Seq.decision(); UI.openModal('decision-modal'); }
function editDecision(id){ const d=DB.Decisions.get(id); if(!d)return; _editDecId=id; document.getElementById('dec-modal-title').textContent='Edit Decision';
  ['decisionId','date','question','problemStatement','options','sources','findings','advantages','limitations','decision','reasoning','status','implementationStatus','consequences','followUp'].forEach(f=>{ const el=document.getElementById('dec-'+f); if(el)el.value=d[f]||''; });
  UI.openModal('decision-modal'); }
function saveDecision(){ const f=document.getElementById('decision-form'); if(!UI.validateForm(f))return;
  const fields=['decisionId','date','question','problemStatement','options','sources','findings','advantages','limitations','decision','reasoning','status','implementationStatus','consequences','followUp'];
  const data={}; fields.forEach(k=>{ data[k]=document.getElementById('dec-'+k)?.value.trim()||''; });
  if(_editDecId){DB.Decisions.update(_editDecId,data);UI.toast('Updated','ok');}
  else{DB.Decisions.add(data);UI.toast('Decision recorded','ok');}
  UI.closeModal('decision-modal'); render_decisions(); _editDecId=null; }
async function deleteDecision(id){ if(!await UI.confirm('Delete this decision record?'))return; DB.Decisions.remove(id); render_decisions(); UI.toast('Deleted'); }

/* ════════════════════════════════════════════════════════════
   PAGE 7 — TASKS & MILESTONES
   ════════════════════════════════════════════════════════════ */
window.render_tasks_milestones = function () {
  const activeTab=document.querySelector('#tm-tabs .tab-btn.active')?.dataset.tab||'tasks';
  _renderTasksMilestonesTab(activeTab);
};
function _renderTasksMilestonesTab(tab) {
  document.querySelectorAll('#tm-tabs .tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='tasks') _renderAllTasks();
  else if(tab==='milestones') _renderMilestones();
  else _renderProjectTimeline();
}
function _renderAllTasks() {
  const all=DB.Tasks.list().sort((a,b)=>new Date(a.deadline||'9999')-new Date(b.deadline||'9999'));
  const search=document.getElementById('tm-search')?.value||'';
  const statF=document.getElementById('tm-status-filter')?.value||'';
  let list=UI.filterList(all,search,['taskId','title','category','status']);
  if(statF) list=list.filter(t=>t.status===statF);
  const el=document.getElementById('tm-content');

  if(!list.length){
    el.innerHTML=all.length===0
      ? UI.emptyState({icon:'📋',title:'No tasks recorded',desc:'Add tasks to track project work and calculate progress.',btn:'+ Add Task',btnCb:"openTaskModal()"})
      : UI.emptyState({icon:'🔍',title:'No tasks match your filter',desc:''});
    return;
  }
  el.innerHTML=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Task ID</th><th>Title</th><th>Assigned To</th><th>Directive</th><th>Category</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Evidence &amp; Proof</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${list.map(t=>`<tr>
      <td class="id-cell">${UI.esc(t.taskId||'—')}</td>
      <td style="max-width:180px">${UI.esc(t.title)}</td>
      <td>${UI.memberName(t.assignedTo)}</td>
      <td>${t.directiveId?UI.directiveRef(t.directiveId):'<span class="nr">—</span>'}</td>
      <td>${UI.catChip(t.category||'—')}</td>
      <td>${UI.priorityBadge(t.priority)}</td>
      <td style="white-space:nowrap">${UI.fmtDateRaw(t.deadline)}</td>
      <td>${UI.statusBadge(t.status)}</td>
      <td>${UI.evidenceThumb(t.taskId||t.id)}</td>
      <td class="no-print"><div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-xs" onclick="openEvidenceModal('${t.taskId||t.id}', 0)" title="Evidence &amp; Verification">📸</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="editTask('${t.id}')">✏</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteTask('${t.id}','')">✕</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function _renderMilestones() {
  const all=DB.Milestones.list().sort((a,b)=>new Date(a.plannedDate||'9999')-new Date(b.plannedDate||'9999'));
  const el=document.getElementById('tm-content');
  if(!all.length){ el.innerHTML=UI.emptyState({icon:'🏁',title:'No milestones recorded',desc:'',btn:'+ Add Milestone',btnCb:'openMilestoneModal()'}); return; }
  el.innerHTML=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>ID</th><th>Milestone</th><th>Planned Date</th><th>Actual Date</th><th>Responsible</th><th>Dependencies</th><th>Status</th><th>Evidence</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${all.map(ms=>`<tr>
      <td class="id-cell">${UI.esc(ms.milestoneId||'—')}</td>
      <td><div class="t-semi">${UI.esc(ms.name)}</div>${ms.description?`<div class="t-xs t-muted">${UI.esc(ms.description)}</div>`:''}</td>
      <td>${UI.fmtDateRaw(ms.plannedDate)}</td>
      <td>${ms.actualDate?UI.fmtDateRaw(ms.actualDate):'<span class="nr">Not reached</span>'}</td>
      <td>${UI.esc(ms.responsible||'—')}</td>
      <td class="t-xs">${UI.esc(ms.dependencies||'—')}</td>
      <td>${UI.statusBadge(ms.status)}</td>
      <td>${ms.evidence?`<a href="${UI.esc(ms.evidence)}" target="_blank" class="t-xs t-accent">Link ↗</a>`:'<span class="nr">—</span>'}</td>
      <td class="no-print"><div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-xs" onclick="editMilestone('${ms.id}')">✏</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteMilestone('${ms.id}')">✕</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function _renderProjectTimeline() {
  const events=[
    ...DB.Meetings.list().map(m=>({date:m.date,type:'meeting',title:`Meeting ${m.number}: ${m.title||''}`,desc:m.objective||'',id:m.id,onclick:`viewMeeting('${m.id}');UI.navigate('meetings',false)`})),
    ...DB.Milestones.list().map(ms=>({date:ms.actualDate||ms.plannedDate,type:'milestone',title:ms.name,desc:ms.description||'',status:ms.status,id:ms.id})),
    ...DB.Directives.list().map(d=>({date:d.dateReceived,type:'directive',title:`${d.directiveId}: ${d.instruction}`,desc:`Assigned: ${d.assignedTo||'—'}`,status:d.status,id:d.id})),
    ...DB.Issues.list().filter(i=>i.severity==='Critical'||i.severity==='High').map(i=>({date:i.dateIdentified,type:'issue',title:`${i.issueId}: ${i.description}`,desc:`Severity: ${i.severity}`,status:i.status,id:i.id})),
    ...DB.Changes.list().filter(c=>c.status==='Completed').map(c=>({date:c.date,type:'change',title:`${c.changeId}: ${c.title}`,desc:c.subsystem||'',id:c.id})),
  ].filter(e=>e.date).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const el=document.getElementById('tm-content');
  if(!events.length){ el.innerHTML=UI.emptyState({icon:'📅',title:'No timeline events yet',desc:'Events appear automatically as you add meetings, milestones, directives, and issues.'}); return; }
  el.innerHTML=`<div class="timeline">${events.map(e=>`
    <div class="tl-item">
      <div class="tl-dot ${e.type}"></div>
      <div class="tl-card" ${e.onclick?`onclick="${UI.esc(e.onclick)}"`:''}>
        <div class="tl-meta">
          <span class="tl-date">${UI.fmtDateRaw(e.date)}</span>
          <span class="cat-chip">${e.type}</span>
          ${e.status?UI.statusBadge(e.status):''}
        </div>
        <div class="tl-title">${UI.esc(e.title)}</div>
        ${e.desc?`<div class="tl-desc">${UI.esc(e.desc)}</div>`:''}
      </div>
    </div>`).join('')}
  </div>`;
}

/* Milestone CRUD */
let _editMlsId=null;
function openMilestoneModal(){ _editMlsId=null; document.getElementById('milestone-form').reset(); document.getElementById('milestone-modal-title').textContent='Add Milestone'; document.getElementById('ms-milestoneId').value=DB.Seq.milestone(); UI.openModal('milestone-modal'); }
function editMilestone(id){ const ms=DB.Milestones.get(id); if(!ms)return; _editMlsId=id; document.getElementById('milestone-modal-title').textContent='Edit Milestone';
  ['milestoneId','name','description','plannedDate','actualDate','responsible','dependencies','status','evidence'].forEach(f=>{ const el=document.getElementById('ms-'+f); if(el)el.value=ms[f]||''; });
  UI.openModal('milestone-modal'); }
function saveMilestone(){ const f=document.getElementById('milestone-form'); if(!UI.validateForm(f))return;
  const data={milestoneId:document.getElementById('ms-milestoneId').value.trim(),name:document.getElementById('ms-name').value.trim(),description:document.getElementById('ms-description').value.trim(),plannedDate:document.getElementById('ms-plannedDate').value,actualDate:document.getElementById('ms-actualDate').value,responsible:document.getElementById('ms-responsible').value.trim(),dependencies:document.getElementById('ms-dependencies').value.trim(),status:document.getElementById('ms-status').value,evidence:document.getElementById('ms-evidence').value.trim()};
  if(_editMlsId){DB.Milestones.update(_editMlsId,data);UI.toast('Updated','ok');}
  else{DB.Milestones.add(data);UI.toast('Milestone added','ok');}
  UI.closeModal('milestone-modal'); render_tasks_milestones(); _editMlsId=null; }
async function deleteMilestone(id){ if(!await UI.confirm('Delete this milestone?'))return; DB.Milestones.remove(id); render_tasks_milestones(); UI.toast('Deleted'); }

/* ════════════════════════════════════════════════════════════
   PAGE 8 — TESTING & EVALUATION
   ════════════════════════════════════════════════════════════ */
window.render_testing = function () {
  const all=DB.Tests.list().sort((a,b)=>new Date(b.testDate)-new Date(a.testDate));
  const el=document.getElementById('testing-content');
  if(!all.length){
    el.innerHTML=UI.emptyState({icon:'🧪',title:'No test records yet',
      desc:'Record each evaluation session with dataset, queries, metrics, and results.',
      btn:'+ Add Test Record',btnCb:'openTestModal()',
      tplNote:'Fields: Test date · Dataset / documents used · Test queries · Expected results · Actual retrieved results · Relevance judgments · Search latency (ms) · Precision@K · Recall@K · MRR · NDCG · Bugs found · Fixes applied · Before/after comparison'});
    return;
  }
  el.innerHTML=all.map(t=>`
    <div class="detail-sec mb-3">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">${UI.idTag(t.testId||'—')} Test Session — ${UI.fmtDateRaw(t.testDate)}</div>
        <div class="flex gap-1 no-print">
          <button class="btn btn-ghost btn-icon btn-xs" onclick="editTest('${t.id}')">✏</button>
          <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteTest('${t.id}')">✕</button>
        </div>
      </div>
      <div class="detail-sec-body">
        <div class="kv-grid">
          ${UI.kv('Test ID', t.testId, {mono:true})}
          ${UI.kv('Date', UI.fmtDateRaw(t.testDate))}
          ${UI.kv('Environment', t.environment||'—')}
          ${UI.kv('Dataset / Documents', t.dataset||'—')}
          ${UI.kv('Test Queries', t.queries||'—')}
          ${UI.kv('Expected Results', t.expected||'—')}
          ${UI.kv('Actual Results', t.actual||'—')}
          ${UI.kv('Relevance Judgments', t.relevance||'—')}
          ${UI.kv('Search Latency (avg)', t.latency?(t.latency+' ms'):'—')}
        </div>
        <div class="stat-row mt-3" style="grid-template-columns:repeat(4,1fr)">
          ${['precisionK','recallK','mrr','ndcg'].map(k=>`<div class="stat-cell accent-left"><div class="stat-lbl">${{precisionK:'Precision@K',recallK:'Recall@K',mrr:'MRR',ndcg:'NDCG'}[k]}</div><div class="stat-val c-accent" style="font-size:18px">${t[k]||'—'}</div></div>`).join('')}
        </div>
        ${t.bugs?`<div class="callout err mt-3"><strong>Bugs Discovered</strong>${UI.esc(t.bugs)}</div>`:''}
        ${t.fixes?`<div class="callout ok mt-2"><strong>Fixes Applied</strong>${UI.esc(t.fixes)}</div>`:''}
        ${t.comparison?`<div class="callout neutral mt-2"><strong>Before / After Comparison</strong>${UI.esc(t.comparison)}</div>`:''}
      </div>
    </div>`).join('');
};

let _editTestId=null;
function openTestModal(){ _editTestId=null; document.getElementById('test-form').reset(); document.getElementById('test-modal-title').textContent='Add Test Record'; document.getElementById('test-testId').value=DB.Seq.test(); UI.openModal('test-modal'); }
function editTest(id){ const t=DB.Tests.get(id); if(!t)return; _editTestId=id; document.getElementById('test-modal-title').textContent='Edit Test Record';
  ['testId','testDate','environment','dataset','queries','expected','actual','relevance','latency','precisionK','recallK','mrr','ndcg','bugs','fixes','comparison'].forEach(f=>{ const el=document.getElementById('test-'+f); if(el)el.value=t[f]||''; });
  UI.openModal('test-modal'); }
function saveTest(){ const f=document.getElementById('test-form'); if(!UI.validateForm(f))return;
  const fields=['testId','testDate','environment','dataset','queries','expected','actual','relevance','latency','precisionK','recallK','mrr','ndcg','bugs','fixes','comparison'];
  const data={}; fields.forEach(k=>{ data[k]=document.getElementById('test-'+k)?.value.trim()||''; });
  if(_editTestId){DB.Tests.update(_editTestId,data);UI.toast('Updated','ok');}
  else{DB.Tests.add(data);UI.toast('Test record added','ok');}
  UI.closeModal('test-modal'); render_testing(); _editTestId=null; }
async function deleteTest(id){ if(!await UI.confirm('Delete this test record?'))return; DB.Tests.remove(id); render_testing(); UI.toast('Deleted'); }

/* ════════════════════════════════════════════════════════════
   PAGE 9 — ISSUES & RISKS
   ════════════════════════════════════════════════════════════ */
window.render_issues = function () {
  const all=DB.Issues.list().sort((a,b)=>new Date(b.dateIdentified)-new Date(a.dateIdentified));
  const search=document.getElementById('iss-search')?.value||'';
  const statF=document.getElementById('iss-status-filter')?.value||'';
  const sevF=document.getElementById('iss-sev-filter')?.value||'';
  let list=UI.filterList(all,search,['issueId','description','rootCause']);
  if(statF) list=list.filter(i=>i.status===statF);
  if(sevF)  list=list.filter(i=>i.severity===sevF);

  const is=DB.Stats.issues();
  const el=document.getElementById('issues-content');

  let html=`<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">
    <div class="stat-cell"><div class="stat-lbl">Total</div><div class="stat-val">${is.total}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Open</div><div class="stat-val c-err">${is.open}</div></div>
    <div class="stat-cell ok-left"><div class="stat-lbl">Resolved</div><div class="stat-val c-ok">${is.resolved}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Critical</div><div class="stat-val c-err">${is.critical}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">High</div><div class="stat-val c-warn">${is.high}</div></div>
  </div>`;

  if(!list.length){
    html+=all.length===0
      ? UI.emptyState({icon:'🐛',title:'No issues recorded',desc:'Log every bug, blocker, risk, and dependency.',btn:'+ Add Issue',btnCb:'openIssueModal()'})
      : UI.emptyState({icon:'🔍',title:'No issues match your filter',desc:''});
    el.innerHTML=html; return;
  }

  html+=`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>ID</th><th>Date</th><th>Description</th><th>Severity</th><th>Priority</th><th>Owner</th><th>Root Cause</th><th>Resolution</th><th>Status</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${list.map(i=>`<tr>
      <td class="id-cell">${UI.esc(i.issueId||'—')}</td>
      <td style="white-space:nowrap">${UI.fmtDateRaw(i.dateIdentified)}</td>
      <td style="max-width:200px"><div class="t-semi">${UI.esc(i.description)}</div>
        ${i.relatedTask?`<div class="t-xs t-muted">Ref: ${UI.esc(i.relatedTask)}</div>`:''}</td>
      <td><span class="badge ${i.severity==='Critical'?'p-critical':i.severity==='High'?'p-high':i.severity==='Medium'?'p-medium':'p-low'}">${UI.esc(i.severity||'—')}</span></td>
      <td>${UI.priorityBadge(i.priority)}</td>
      <td>${UI.esc(i.assignedTo||'—')}</td>
      <td class="t-xs" style="max-width:140px">${UI.esc(i.rootCause||'—')}</td>
      <td class="t-xs" style="max-width:140px">${UI.esc(i.resolution||'—')}</td>
      <td>${UI.statusBadge(i.status)}</td>
      <td class="no-print"><div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-xs" onclick="editIssue('${i.id}')">✏</button>
        <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteIssue('${i.id}')">✕</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  el.innerHTML=html;
};

let _editIssId=null;
function openIssueModal(){ _editIssId=null; document.getElementById('issue-form').reset(); document.getElementById('issue-modal-title').textContent='Add Issue'; document.getElementById('iss-issueId').value=DB.Seq.issue(); UI.openModal('issue-modal'); }
function editIssue(id){ const i=DB.Issues.get(id); if(!i)return; _editIssId=id; document.getElementById('issue-modal-title').textContent='Edit Issue';
  ['issueId','description','dateIdentified','severity','priority','assignedTo','rootCause','resolution','status','relatedTask'].forEach(f=>{ const el=document.getElementById('iss-'+f); if(el)el.value=i[f]||''; });
  UI.openModal('issue-modal'); }
function saveIssue(){ const f=document.getElementById('issue-form'); if(!UI.validateForm(f))return;
  const data={issueId:document.getElementById('iss-issueId').value.trim(),description:document.getElementById('iss-description').value.trim(),dateIdentified:document.getElementById('iss-dateIdentified').value,severity:document.getElementById('iss-severity').value,priority:document.getElementById('iss-priority').value,assignedTo:document.getElementById('iss-assignedTo').value.trim(),rootCause:document.getElementById('iss-rootCause').value.trim(),resolution:document.getElementById('iss-resolution').value.trim(),status:document.getElementById('iss-status').value,relatedTask:document.getElementById('iss-relatedTask').value.trim()};
  if(_editIssId){DB.Issues.update(_editIssId,data);UI.toast('Issue updated','ok');}
  else{DB.Issues.add(data);UI.toast('Issue added','ok');}
  UI.closeModal('issue-modal'); render_issues(); _editIssId=null; }
async function deleteIssue(id){ if(!await UI.confirm('Delete this issue?'))return; DB.Issues.remove(id); render_issues(); UI.toast('Deleted'); }

/* ════════════════════════════════════════════════════════════
   PAGE 10 — REPORTS & EXPORTS
   ════════════════════════════════════════════════════════════ */
window.render_reports = function () {
  // Populate member select
  const sel=document.getElementById('rpt-member');
  if(sel){ sel.innerHTML=`<option value="">All members</option>`+DB.Members.list().map(m=>`<option value="${m.id}">${UI.esc(m.name)}</option>`).join(''); }
};

function generateReport() {
  const from   = document.getElementById('rpt-from').value;
  const to     = document.getElementById('rpt-to').value;
  const sects  = [...document.querySelectorAll('.rpt-sec-cb:checked')].map(cb=>cb.value);
  if(!sects.length){ UI.toast('Select at least one section','warn'); return; }

  const meta   = DB.Meta.get();
  const meetings= DB.Meetings.list().sort((a,b)=>(a.number||0)-(b.number||0));
  const members = DB.Members.list();
  const direcs  = DB.Directives.list().sort((a,b)=>(a.directiveId||'').localeCompare(b.directiveId||''));
  const tasks   = DB.Tasks.list();
  const changes = DB.Changes.list().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const issues  = DB.Issues.list();
  const tests   = DB.Tests.list().sort((a,b)=>new Date(a.testDate)-new Date(b.testDate));
  const mls     = DB.Milestones.list().sort((a,b)=>new Date(a.plannedDate||'9999')-new Date(b.plannedDate||'9999'));
  const ts      = DB.Stats.tasks();
  const pct     = DB.Stats.progressPct();

  function inR(d){ return UI.inDateRange(d,from,to); }

  let html=`<div id="report-preview-body">
  <h1>${UI.esc(meta.projectName||'Search Engine Project')}</h1>
  <div class="rpt-meta">
    Project Documentation &amp; Progress Report<br>
    ${meta.institution?UI.esc(meta.institution)+' · ':''}${meta.faculty?'Faculty: '+UI.esc(meta.faculty)+' · ':''}<br>
    ${from||to?`Reporting Period: ${from?UI.fmtDateRaw(from):'—'} to ${to?UI.fmtDateRaw(to):'—'}<br>`:'All Records<br>'}
    Generated: ${new Date().toLocaleString('en-GB')} · This report contains only recorded data.
  </div>
  <div class="rpt-notice">⚠ This report reflects data entered into the logbook. Sections marked "Not recorded" indicate missing information, not project failure. Verify all figures against supporting evidence before formal submission.</div>`;

  if(sects.includes('overview')){
    html+=`<h2>1. Project Overview</h2>
    <table><tbody>
      <tr><th style="width:160px">Project Name</th><td>${UI.esc(meta.projectName||'—')}</td></tr>
      <tr><th>Objective</th><td>${UI.esc(meta.objective||'—')}</td></tr>
      <tr><th>Scope</th><td>${UI.esc(meta.scope||'—')}</td></tr>
      <tr><th>Institution</th><td>${UI.esc(meta.institution||'—')}</td></tr>
      <tr><th>Faculty Guide</th><td>${UI.esc(meta.faculty||'—')}</td></tr>
      <tr><th>Start Date</th><td>${UI.fmtDateRaw(meta.startDate)}</td></tr>
      <tr><th>Current Phase</th><td>${UI.esc(meta.currentPhase||'—')}</td></tr>
      <tr><th>Progress</th><td>${pct}% (${ts.completed} of ${ts.total} tasks completed)</td></tr>
    </tbody></table>`;
  }

  if(sects.includes('team')){
    html+=`<h2>2. Team Members &amp; Responsibilities</h2>
    <table><thead>${UI.rptHead('Member','Role','Responsibilities','Completed','In Progress','Pending')}</thead>
    <tbody>${members.map(m=>{const s=DB.Stats.memberSummary(m.id); return UI.rptRow(UI.esc(m.name),UI.esc(m.role||'—'),UI.esc(m.responsibilities||'—'),s.completed,s.inProgress,s.pending);}).join('')}
    ${!members.length?'<tr><td colspan="6" style="color:#9ca3af;font-style:italic">No members recorded.</td></tr>':''}</tbody></table>`;
  }

  if(sects.includes('meetings')){
    html+=`<h2>3. Meeting Minutes</h2>`;
    const fMtgs=meetings.filter(m=>inR(m.date));
    if(!fMtgs.length){ html+=`<p style="color:#9ca3af;font-style:italic">No meetings in selected period.</p>`; }
    else fMtgs.forEach(m=>{
      const dirs=DB.Directives.list().filter(d=>d.meetingId===m.id);
      html+=`<h3>Meeting ${m.number}: ${UI.esc(m.title||'')} — ${UI.fmtDateRaw(m.date)}</h3>
      <table><tbody>
        <tr><th>Type</th><td>${UI.esc(m.type||'—')}</td><th>State</th><td>${UI.esc(m.state||'Draft')}</td></tr>
        <tr><th>Attendees</th><td colspan="3">${UI.esc(m.attendees||'—')}</td></tr>
        <tr><th>Objective</th><td colspan="3">${UI.esc(m.objective||'—')}</td></tr>
      </tbody></table>
      ${dirs.length?`<p><strong>Faculty Directives (${dirs.length}):</strong></p>
      <table><thead>${UI.rptHead('ID','Instruction','Assigned','Deadline','Status')}</thead>
      <tbody>${dirs.map(d=>UI.rptRow(UI.esc(d.directiveId),UI.esc(d.instruction),UI.esc(d.assignedTo||'—'),UI.fmtDateRaw(d.deadline),UI.esc(d.status))).join('')}</tbody></table>`:''}
      ${m.actionItems?.length?`<p><strong>Action Items:</strong></p>
      <table><thead>${UI.rptHead('Task','Assigned To','Deadline','Status')}</thead>
      <tbody>${m.actionItems.map(a=>UI.rptRow(UI.esc(a.task),UI.esc(a.assignedTo||'—'),UI.fmtDateRaw(a.deadline),UI.esc(a.status))).join('')}</tbody></table>`:''}`;
    });
  }

  if(sects.includes('directives')){
    html+=`<h2>4. Faculty Directives &amp; Compliance Status</h2>
    <table><thead>${UI.rptHead('ID','Date','Instruction','Assigned','Deadline','Priority','Status','Verification')}</thead>
    <tbody>${direcs.map(d=>UI.rptRow(UI.esc(d.directiveId),UI.fmtDateRaw(d.dateReceived),UI.esc(d.instruction),UI.esc(d.assignedTo||'—'),UI.fmtDateRaw(d.deadline),UI.esc(d.priority||'—'),UI.esc(d.status),UI.esc(d.verificationMethod||'—'))).join('')}
    ${!direcs.length?'<tr><td colspan="8" style="color:#9ca3af;font-style:italic">No directives recorded.</td></tr>':''}</tbody></table>`;
  }

  if(sects.includes('changes')){
    html+=`<h2>5. Technical Development History</h2>`;
    const fChg=changes.filter(c=>inR(c.date));
    if(!fChg.length){ html+=`<p style="color:#9ca3af;font-style:italic">No changes in selected period.</p>`; }
    else {
      html+=`<table><thead>${UI.rptHead('Change ID','Date','Subsystem','Title','Status','Implemented By','Commit/File')}</thead>
      <tbody>${fChg.map(c=>UI.rptRow(UI.esc(c.changeId),UI.fmtDateRaw(c.date),UI.esc(c.subsystem||'—'),UI.esc(c.title),UI.esc(c.status),UI.esc(c.implementedBy||'—'),UI.esc(c.commit||'—'))).join('')}</tbody></table>
      ${fChg.filter(c=>c.isPlanned).length?`<p><em>⚠ ${fChg.filter(c=>c.isPlanned).length} change(s) above are marked as Planned — not yet implemented.</em></p>`:''}`;
    }
  }

  if(sects.includes('issues')){
    html+=`<h2>6. Issues, Risks &amp; Resolutions</h2>
    <table><thead>${UI.rptHead('ID','Description','Severity','Status','Root Cause','Resolution')}</thead>
    <tbody>${issues.map(i=>UI.rptRow(UI.esc(i.issueId),UI.esc(i.description),UI.esc(i.severity||'—'),UI.esc(i.status),UI.esc(i.rootCause||'—'),UI.esc(i.resolution||'—'))).join('')}
    ${!issues.length?'<tr><td colspan="6" style="color:#9ca3af;font-style:italic">No issues recorded.</td></tr>':''}</tbody></table>`;
  }

  if(sects.includes('testing')){
    html+=`<h2>7. Testing &amp; Evaluation Results</h2>`;
    if(!tests.length){ html+=`<p style="color:#9ca3af;font-style:italic">No test records.</p>`; }
    else tests.forEach(t=>{
      html+=`<h3>${UI.esc(t.testId||'—')} — ${UI.fmtDateRaw(t.testDate)}</h3>
      <table><tbody>
        <tr><th>Dataset</th><td>${UI.esc(t.dataset||'—')}</td></tr>
        <tr><th>Queries</th><td>${UI.esc(t.queries||'—')}</td></tr>
        <tr><th>Latency</th><td>${t.latency?t.latency+' ms':'—'}</td></tr>
      </tbody></table>
      <table><thead>${UI.rptHead('Precision@K','Recall@K','MRR','NDCG')}</thead>
      <tbody><tr>${['precisionK','recallK','mrr','ndcg'].map(k=>`<td>${UI.esc(t[k]||'—')}</td>`).join('')}</tr></tbody></table>
      ${t.bugs?`<p><strong>Bugs:</strong> ${UI.esc(t.bugs)}</p>`:''}${t.fixes?`<p><strong>Fixes:</strong> ${UI.esc(t.fixes)}</p>`:''}`;
    });
  }

  if(sects.includes('milestones')){
    const pend=tasks.filter(t=>t.status!=='Completed');
    html+=`<h2>8. Milestones &amp; Progress</h2>
    <table><thead>${UI.rptHead('ID','Milestone','Planned','Actual','Responsible','Status')}</thead>
    <tbody>${mls.map(ms=>UI.rptRow(UI.esc(ms.milestoneId),UI.esc(ms.name),UI.fmtDateRaw(ms.plannedDate),ms.actualDate?UI.fmtDateRaw(ms.actualDate):'Not reached',UI.esc(ms.responsible||'—'),UI.esc(ms.status))).join('')}
    ${!mls.length?'<tr><td colspan="6" style="color:#9ca3af;font-style:italic">No milestones recorded.</td></tr>':''}</tbody></table>
    <h3>Pending Tasks</h3>
    <table><thead>${UI.rptHead('Task ID','Title','Assigned To','Deadline','Status')}</thead>
    <tbody>${pend.map(t=>{const mb=DB.Members.get(t.assignedTo); return UI.rptRow(UI.esc(t.taskId),UI.esc(t.title),UI.esc(mb?.name||'—'),UI.fmtDateRaw(t.deadline),UI.esc(t.status));}).join('')}
    ${!pend.length?'<tr><td colspan="5" style="color:#16a34a;font-weight:600">All tasks completed.</td></tr>':''}</tbody></table>`;
  }

  html+=`</div>`;
  document.getElementById('rpt-preview').innerHTML=html;
  document.getElementById('rpt-status').textContent=`Report generated — ${new Date().toLocaleString('en-GB')}`;
  UI.toast('Report generated','ok');
}

function printReport() {
  const preview=document.getElementById('rpt-preview');
  if(!preview.innerHTML.trim()){ UI.toast('Generate a report first','warn'); return; }
  const win=window.open('','_blank','width=960,height=720');
  win.document.write(`<!DOCTYPE html><html><head><title>Project Report — ${new Date().toLocaleDateString('en-GB')}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111;font-size:11pt}
  h1{font-size:18pt;text-align:center;margin-bottom:4px}h2{font-size:13pt;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin:20px 0 8px}
  h3{font-size:11pt;margin:14px 0 6px;color:#374151}table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#f3f4f6;padding:5px 10px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.04em;border:1px solid #d1d5db}
  td{padding:5px 10px;border:1px solid #e5e7eb;font-size:10pt;vertical-align:top}
  .rpt-meta{text-align:center;color:#6b7280;font-size:9pt;margin-bottom:20px}
  .rpt-notice{background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:8px 12px;font-size:9pt;color:#78350f;margin-bottom:16px}
  @media print{@page{margin:18mm;size:A4}}</style>
  </head><body>${preview.innerHTML}</body></html>`);
  win.document.close(); setTimeout(()=>win.print(),500);
}

function exportData() {
  const json=DB.IO.exportAll();
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`project-logbook-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(url); UI.toast('Backup exported','ok');
}
function importData() {
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=async(e)=>{
    const file=e.target.files[0]; if(!file)return;
    if(!await UI.confirm('This will overwrite ALL current data. Make sure you have a backup.','Import Data?'))return;
    const reader=new FileReader();
    reader.onload=ev=>{ try{ DB.IO.importAll(ev.target.result); UI.toast('Data imported','ok'); render_overview(); }
      catch{ UI.toast('Import failed — invalid file','err'); } };
    reader.readAsText(file);
  }; inp.click();
}
async function clearAllData() {
  if(!await UI.confirm('Permanently delete ALL logbook data? Export a backup first.','Clear All Data?'))return;
  ['plb_meta','plb_meetings','plb_members','plb_instructions','plb_tasks','plb_tech_changes','plb_research','plb_tests','plb_issues','plb_milestones','plb_deliverables','plb_audit_log','plb_contributions'].forEach(k=>localStorage.removeItem(k));
  DB.Meta.save(DB.Meta.defaults()); UI.toast('All data cleared','warn'); UI.navigate('overview');
}

/* ════════════════════════════════════════════════════════════
   PAGE 11 — PROJECT CONFIGURATION
   ════════════════════════════════════════════════════════════ */
window.render_config = function () {
  const meta=DB.Meta.get();
  const fields=['projectName','projectCode','objective','scope','institution','department','faculty','facultyEmail','startDate','currentPhase','teamName','reportingContact'];
  fields.forEach(f=>{ const el=document.getElementById('cfg-'+f); if(el) el.value=meta[f]||''; });
  // Audit log
  const logEl=document.getElementById('audit-log-content');
  if(logEl){
    const log=DB.AuditLog.list().slice(-50).reverse();
    logEl.innerHTML=log.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
    <tbody>${log.map(e=>`<tr><td class="t-mono t-xs">${UI.fmtDateTime(e.ts)}</td><td>${UI.esc(e.action)}</td><td>${UI.esc(e.entity)}</td><td class="t-xs">${UI.esc(e.detail)}</td></tr>`).join('')}</tbody></table></div>`
    :'<div class="t-sm t-muted t-italic">No audit entries yet.</div>';
  }
};

function saveConfig() {
  const fields=['projectName','projectCode','objective','scope','institution','department','faculty','facultyEmail','startDate','currentPhase','teamName','reportingContact'];
  const data={};
  fields.forEach(f=>{ const el=document.getElementById('cfg-'+f); if(el) data[f]=el.value.trim(); });
  DB.Meta.save(data); UI.toast('Configuration saved','ok');
}

/* ════════════════════════════════════════════════════════════
   INIT — wire navigation and live filters
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* Nav items — wire ALL sb-items including new consolidated ones */
  document.querySelectorAll('.sb-item[data-page]').forEach(item => {
    item.addEventListener('click', () => UI.navigate(item.dataset.page));
  });

  /* Tech history tabs */
  document.querySelectorAll('#chg-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _renderChangesTab(btn.dataset.tab));
  });

  /* Tasks/milestones tabs */
  document.querySelectorAll('#tm-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _renderTasksMilestonesTab(btn.dataset.tab));
  });

  /* Live search / filter bindings */
  const bindings=[
    ['mtg-search',         render_meetings],
    ['mtg-type-filter',    render_meetings],
    ['mtg-state-filter',   render_meetings],
    ['dir-search',         render_directives],
    ['dir-status-filter',  render_directives],
    ['dir-prio-filter',    render_directives],
    ['dec-search',         render_decisions],
    ['dec-status-filter',  render_decisions],
    ['iss-search',         render_issues],
    ['iss-status-filter',  render_issues],
    ['iss-sev-filter',     render_issues],
    ['tm-search',          render_tasks_milestones],
    ['tm-status-filter',   render_tasks_milestones],
  ];
  bindings.forEach(([id,fn])=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('input',fn);
  });

  /* Mobile sidebar toggle */
  const mq=window.matchMedia('(max-width:700px)');
  function checkMq(e){ const btn=document.getElementById('mobile-menu-btn'); if(btn) btn.style.display=e.matches?'flex':'none'; }
  mq.addEventListener('change',checkMq); checkMq(mq);
  document.getElementById('mobile-menu-btn')?.addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));

  /* Start on simplified dashboard */
  UI.navigate('dashboard',false);
});


/* ════════════════════════════════════════════════════════════
   SIMPLIFIED FACULTY DASHBOARD
   Single-page view: A. Status  B. Latest meeting  C. Team
   D. Technical updates  E. Faculty instructions
   F. Issues & next steps  G. Print report
   ════════════════════════════════════════════════════════════ */
window.render_dashboard = function () {
  /* ── pull data ─────────────────────────────────────────── */
  const meta    = DB.Meta.get();
  const ts      = DB.Stats.tasks();
  const ds      = DB.Stats.directives();
  const is      = DB.Stats.issues();
  const pct     = DB.Stats.progressPct();
  const members = DB.Members.list();
  const meetings = DB.Meetings.list().sort((a,b)=>(b.number||0)-(a.number||0));
  const latest  = meetings[0] || null;
  const changes = DB.Changes.list().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const directives = DB.Directives.list().sort((a,b)=>(a.directiveId||'').localeCompare(b.directiveId||''));
  const openIssues = DB.Issues.list().filter(i=>['Open','Investigating','Blocked'].includes(i.status));
  const upcoming = DB.Tasks.list().filter(t=>t.deadline&&t.status!=='Completed')
    .sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,5);

  /* top meta bar */
  const nm = document.getElementById('dash-project-name');
  if(nm) nm.textContent = meta.projectName || 'Study-Material Search Engine';
  const ml = document.getElementById('dash-meta-line');
  if(ml) ml.textContent = [
    meta.institution||'',
    meta.faculty ? 'Faculty: '+meta.faculty : '',
    meta.currentPhase ? 'Phase: '+meta.currentPhase : '',
    'Last updated: '+UI.fmtDateRaw(meta.updatedAt)
  ].filter(Boolean).join(' · ');

  const el = document.getElementById('dashboard-content');
  if (!el) return;

  /* ── A. Project Status ──────────────────────────────────── */
  const progressColor = pct===100?'ok':pct<25?'warn':'';
  const sectionA = `
    <div style="margin-bottom:20px">
      <div class="dash-sec-title">A. Project Status</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:12px">
        <div class="stat-cell accent-left">
          <div class="stat-lbl">Progress</div>
          <div class="stat-val c-accent">${pct}%</div>
          <div class="stat-note">from task records</div>
        </div>
        <div class="stat-cell ok-left">
          <div class="stat-lbl">Completed</div>
          <div class="stat-val c-ok">${ts.completed}</div>
          <div class="stat-note">of ${ts.total} tasks</div>
        </div>
        <div class="stat-cell warn-left">
          <div class="stat-lbl">In Progress</div>
          <div class="stat-val c-warn">${ts.inProgress}</div>
          <div class="stat-note">${ts.blocked} blocked</div>
        </div>
        <div class="stat-cell">
          <div class="stat-lbl">Meetings</div>
          <div class="stat-val">${meetings.length}</div>
          <div class="stat-note">documented</div>
        </div>
        <div class="stat-cell ${is.open>0?'err-left':'ok-left'}">
          <div class="stat-lbl">Open Issues</div>
          <div class="stat-val ${is.open>0?'c-err':'c-ok'}">${is.open}</div>
          <div class="stat-note">${is.critical} critical</div>
        </div>
        <div class="stat-cell accent-left">
          <div class="stat-lbl">Directives</div>
          <div class="stat-val c-accent">${ds.total}</div>
          <div class="stat-note">${ds.verified} verified</div>
        </div>
      </div>
      ${ts.total ? `<div class="prog-wrap" style="height:8px"><div class="prog-fill ${progressColor}" style="width:${pct}%"></div></div>
      <div style="font-size:10px;color:var(--text-3);margin-top:4px">${ts.completed} of ${ts.total} tasks complete — ${ts.pending} pending · ${ts.blocked} blocked</div>` : ''}
    </div>`;

  /* ── B. Latest Meeting ──────────────────────────────────── */
  let sectionB = `<div style="margin-bottom:20px"><div class="dash-sec-title">B. Latest Meeting</div>`;
  if (!latest) {
    sectionB += `<div class="t-sm t-muted t-italic">No meetings recorded yet.</div>`;
  } else {
    const latestDirs = DB.Directives.list().filter(d=>d.meetingId===latest.id);
    const latestWork = (latest.workItems||[]);
    const latestActions = (latest.actionItems||[]);
    sectionB += `
      <div class="card" style="margin-bottom:10px">
        <div class="card-header" style="padding:10px 14px">
          <div style="display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap">
            <div style="width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${latest.number||'?'}</div>
            <div>
              <div style="font-weight:600;font-size:13px">${UI.esc(latest.title||'Meeting '+latest.number)}</div>
              <div style="font-size:11px;color:var(--text-3)">${UI.fmtDateRaw(latest.date)}${latest.time?' · '+UI.esc(latest.time):''} · ${UI.esc(latest.type||'Regular Meeting')}</div>
            </div>
            ${UI.statusBadge(latest.state||'Draft')}
          </div>
          <button class="btn btn-ghost btn-sm no-print" style="font-size:11px" onclick="UI.navigate('meetings-instructions')">All meetings →</button>
        </div>
        <div class="card-body" style="padding:12px 14px">
          ${latest.objective?`<div style="font-size:12px;color:var(--text-2);margin-bottom:10px">${UI.esc(latest.objective)}</div>`:''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:6px">Instructions Given</div>
              ${latestDirs.length ? latestDirs.slice(0,4).map(d=>`
                <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px">
                  <span class="id-tag" style="font-size:9px;padding:1px 4px;flex-shrink:0">${UI.esc(d.directiveId)}</span>
                  <span style="font-size:11px;color:var(--text-2)">${UI.esc((d.instruction||'').slice(0,70))}${d.instruction?.length>70?'…':''}</span>
                  ${UI.statusBadge(d.status)}
                </div>`).join('')+(latestDirs.length>4?`<div class="t-xs t-muted">+${latestDirs.length-4} more</div>`:'')
              : `<div class="t-xs t-muted t-italic">None recorded for this meeting.</div>`}
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:6px">Work Completed</div>
              ${latestWork.length ? latestWork.slice(0,4).map(w=>`
                <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px">
                  <span style="color:var(--ok);font-size:11px;flex-shrink:0">✓</span>
                  <span style="font-size:11px;color:var(--text-2)">${UI.esc(w.title||'')}</span>
                  <span style="font-size:10px;color:var(--text-4);white-space:nowrap">${UI.esc(w.member||'')}</span>
                </div>`).join('')+(latestWork.length>4?`<div class="t-xs t-muted">+${latestWork.length-4} more</div>`:'')
              : `<div class="t-xs t-muted t-italic">None recorded.</div>`}
            </div>
          </div>
          ${latestActions.length ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-lt)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:6px">Action Items for Next Meeting</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:5px">
                ${latestActions.slice(0,6).map(a=>`
                  <div style="display:flex;align-items:center;gap:5px;font-size:11px">
                    ${UI.priorityBadge(a.priority)}
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(a.task)}</span>
                    ${UI.statusBadge(a.status)}
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>
      </div>
      ${meetings.length>1 ? `
        <details style="margin-bottom:4px">
          <summary style="font-size:11px;color:var(--accent);cursor:pointer;padding:4px 0;user-select:none">▸ Previous meetings (${meetings.length-1})</summary>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            ${meetings.slice(1,6).map(m=>`
              <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);cursor:pointer"
                   onclick="viewMeeting('${m.id}');UI.navigate('meetings',false)">
                <div style="width:22px;height:22px;border-radius:50%;background:var(--nav-bg);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${m.number||'?'}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(m.title||'Meeting '+m.number)}</div>
                  <div style="font-size:10px;color:var(--text-3)">${UI.fmtDateRaw(m.date)} · ${UI.esc(m.type||'—')}</div>
                </div>
                ${UI.statusBadge(m.state||'Draft')}
                <span style="font-size:10px;color:var(--accent)">→</span>
              </div>`).join('')}
            ${meetings.length>6?`<button class="btn btn-ghost btn-sm" onclick="UI.navigate('meetings-instructions')">View all ${meetings.length} meetings →</button>`:''}
          </div>
        </details>` : ''}`;
  }
  sectionB += `</div>`;

  /* ── C. Team Progress ───────────────────────────────────── */
  let sectionC = `<div style="margin-bottom:20px"><div class="dash-sec-title">C. Team Progress</div>`;
  if (!members.length) {
    sectionC += `<div class="t-sm t-muted t-italic">No team members recorded yet.</div>`;
  } else {
    const allTasks = DB.Tasks.list();
    sectionC += `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th>Member</th><th>Responsibility</th>
        <th style="text-align:center">Done</th><th style="text-align:center">Active</th><th style="text-align:center">Pending</th>
        <th>Current Task</th><th>Next Planned</th>
      </tr></thead>
      <tbody>${members.map(m=>{
        const s = DB.Stats.memberSummary(m.id);
        const active = allTasks.filter(t=>t.assignedTo===m.id&&t.status==='In Progress')[0];
        const next   = allTasks.filter(t=>t.assignedTo===m.id&&t.status==='Not Started')[0];
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:6px">
            ${UI.avatar(m.name,22)}
            <span style="font-weight:600;font-size:12px">${UI.esc(m.name)}</span>
          </div></td>
          <td style="max-width:140px;font-size:11px;color:var(--text-2)">${UI.esc(m.responsibilities||m.role||'—')}</td>
          <td style="text-align:center"><span style="color:var(--ok);font-weight:700">${s.completed}</span></td>
          <td style="text-align:center"><span style="color:var(--accent);font-weight:700">${s.inProgress}</span></td>
          <td style="text-align:center"><span style="color:var(--warn);font-weight:700">${s.pending}</span></td>
          <td style="font-size:11px;max-width:160px">${active?`<span style="color:var(--accent)">${UI.esc(active.title)}</span>`:'<span class="nr">—</span>'}</td>
          <td style="font-size:11px;max-width:140px">${next?UI.esc(next.title):'<span class="nr">—</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }
  sectionC += `</div>`;

  /* ── D. Technical Updates ───────────────────────────────── */
  let sectionD = `<div style="margin-bottom:20px"><div class="dash-sec-title">D. Technical Updates</div>`;
  if (!changes.length) {
    sectionD += `<div class="t-sm t-muted t-italic">No technical changes recorded yet.</div>`;
  } else {
    sectionD += `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Date</th><th>Subsystem</th><th>Change</th><th>Status</th></tr></thead>
      <tbody>${changes.map(c=>`<tr>
        <td style="white-space:nowrap;font-size:11px">${UI.fmtDateRaw(c.date)}</td>
        <td>${UI.catChip(c.subsystem||c.category||'—')}</td>
        <td style="max-width:280px">
          <div style="font-size:12px;font-weight:500">${UI.esc(c.title)}</div>
          ${c.newBehaviour?`<div style="font-size:10px;color:var(--text-3)">${UI.esc(c.newBehaviour.slice(0,80))}${c.newBehaviour.length>80?'…':''}</div>`:''}
          ${c.isPlanned?`<span class="badge s-planned" style="font-size:9px">Planned — not implemented</span>`:''}
        </td>
        <td>${UI.statusBadge(c.status)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${DB.Changes.list().length>6?`<button class="btn btn-ghost btn-sm mt-2 no-print" onclick="UI.navigate('technical-progress')">View all ${DB.Changes.list().length} changes →</button>`:''}`;
  }
  sectionD += `</div>`;

  /* ── E. Faculty Instructions ────────────────────────────── */
  let sectionE = `<div style="margin-bottom:20px"><div class="dash-sec-title">E. Faculty Instructions</div>`;
  if (!directives.length) {
    sectionE += `<div class="t-sm t-muted t-italic">No faculty instructions recorded yet.</div>`;
  } else {
    sectionE += `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>ID</th><th>Instruction</th><th>Assigned To</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead>
      <tbody>${directives.map(d=>`<tr>
        <td class="id-cell">${UI.esc(d.directiveId||'—')}</td>
        <td style="max-width:240px">
          <div style="font-size:12px">${UI.esc(d.instruction)}</div>
          ${d.expectedOutcome?`<div style="font-size:10px;color:var(--text-3)">Expected: ${UI.esc(d.expectedOutcome.slice(0,60))}${d.expectedOutcome.length>60?'…':''}</div>`:''}
        </td>
        <td style="font-size:11px">${UI.esc(d.assignedTo||'—')}</td>
        <td style="font-size:11px;white-space:nowrap">${UI.fmtDateRaw(d.deadline)}</td>
        <td>${UI.priorityBadge(d.priority)}</td>
        <td>${UI.statusBadge(d.status)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
  sectionE += `</div>`;

  /* ── F. Issues & Next Steps ─────────────────────────────── */
  let sectionF = `<div style="margin-bottom:20px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div class="dash-sec-title" style="margin:0">F. Issues &amp; Next Steps</div>
    <button class="btn btn-ghost btn-sm no-print" onclick="UI.navigate('issues-reports')">Full details →</button>
  </div>`;
  const hasIssues = openIssues.length > 0;
  const hasUpcoming = upcoming.length > 0;
  if (!hasIssues && !hasUpcoming) {
    sectionF += `<div class="t-sm t-muted t-italic">No open issues or upcoming tasks recorded.</div>`;
  } else {
    sectionF += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
    sectionF += `<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:6px">Current Blockers / Issues (${openIssues.length})</div>
      ${hasIssues ? openIssues.slice(0,5).map(i=>`
        <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px">
          <span class="badge ${i.severity==='Critical'?'p-critical':i.severity==='High'?'p-high':'p-medium'}" style="font-size:9px;flex-shrink:0">${UI.esc(i.severity)}</span>
          <span style="font-size:11px;color:var(--text-2);flex:1">${UI.esc(i.description)}</span>
          ${UI.statusBadge(i.status)}
        </div>`).join('')+(openIssues.length>5?`<div class="t-xs t-muted">+${openIssues.length-5} more</div>`:'')
      : `<div class="t-xs t-muted t-italic">No open issues.</div>`}
    </div>`;
    sectionF += `<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:6px">Upcoming Deadlines</div>
      ${hasUpcoming ? upcoming.map(t=>`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
          <span style="font-size:10px;color:var(--text-3);white-space:nowrap">${UI.fmtDateRaw(t.deadline)}</span>
          <span style="font-size:11px;color:var(--text-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(t.title)}</span>
          ${UI.statusBadge(t.status)}
        </div>`).join('')
      : `<div class="t-xs t-muted t-italic">No upcoming deadlines.</div>`}
    </div>`;
    sectionF += `</div>`;
  }
  sectionF += `</div>`;

  /* ── G. Report button ───────────────────────────────────── */
  const sectionG = `
    <div style="margin-bottom:4px">
      <div class="dash-sec-title">G. Reports</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary no-print" onclick="UI.navigate('issues-reports')">▶ Generate Progress Report</button>
        <button class="btn btn-secondary no-print" onclick="window.print()">🖨 Print This Page</button>
        <button class="btn btn-secondary no-print" onclick="exportData()">⬇ Export Backup</button>
        <span class="t-xs t-muted">Detailed testing &amp; architecture records available via admin links in the sidebar.</span>
      </div>
    </div>`;

  el.innerHTML = sectionA + sectionB + sectionC + sectionD + sectionE + sectionF + sectionG;
};

/* ════════════════════════════════════════════════════════════
   CONSOLIDATED PAGE: MEETINGS & INSTRUCTIONS
   ════════════════════════════════════════════════════════════ */
window.render_meetings_instructions = function () {
  const el = document.getElementById('mi-content');
  if (!el) return;
  const meetings  = DB.Meetings.list().sort((a,b)=>(b.number||0)-(a.number||0));
  const allDirs   = DB.Directives.list().sort((a,b)=>(a.directiveId||'').localeCompare(b.directiveId||''));

  /* Stats row */
  const ds = DB.Stats.directives();
  let html = `<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr))">
    <div class="stat-cell accent-left"><div class="stat-lbl">Meetings</div><div class="stat-val c-accent">${meetings.length}</div></div>
    <div class="stat-cell ok-left"><div class="stat-lbl">Verified Directives</div><div class="stat-val c-ok">${ds.verified}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">Pending</div><div class="stat-val c-warn">${ds.pending+ds.inProg}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Blocked</div><div class="stat-val c-err">${ds.blocked}</div></div>
  </div>`;

  /* All meetings collapsible */
  html += `<div class="card mb-4">
    <div class="card-header">
      <div class="card-title">Meeting Log (${meetings.length})</div>
      <button class="btn btn-sm btn-primary no-print" onclick="openMeetingModal()">+ Add Meeting</button>
    </div>
    <div class="card-body" style="padding:0">`;
  if (!meetings.length) {
    html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No meetings recorded</div></div>`;
  } else {
    html += meetings.map(m=>{
      const dirs  = DB.Directives.list().filter(d=>d.meetingId===m.id);
      const work  = m.workItems||[];
      const acts  = m.actionItems||[];
      return `<details style="border-bottom:1px solid var(--border-lt)">
        <summary style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;list-style:none;user-select:none">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${m.number||'?'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${UI.esc(m.title||'Meeting '+m.number)}</div>
            <div style="font-size:10px;color:var(--text-3)">${UI.fmtDateRaw(m.date)} · ${UI.esc(m.type||'—')} · Attendees: ${UI.esc(m.attendees||'—')}</div>
          </div>
          ${UI.statusBadge(m.state||'Draft')}
          ${dirs.length?`<span class="cat-chip">${dirs.length} directive${dirs.length>1?'s':''}</span>`:''}
          <span style="font-size:10px;color:var(--text-4);flex-shrink:0">▾</span>
        </summary>
        <div style="padding:0 14px 12px 14px;background:var(--surface-2)">
          ${m.objective?`<div style="font-size:12px;color:var(--text-2);margin-bottom:8px;padding-top:8px">${UI.esc(m.objective)}</div>`:''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:4px">Instructions Given</div>
              ${dirs.length ? dirs.map(d=>`<div style="display:flex;gap:5px;margin-bottom:4px;align-items:flex-start">
                <span class="id-tag" style="font-size:9px">${UI.esc(d.directiveId)}</span>
                <span style="font-size:11px;flex:1">${UI.esc(d.instruction)}</span>
                ${UI.statusBadge(d.status)}
              </div>`).join('') : `<span class="nr">None</span>`}
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:4px">Work Completed</div>
              ${work.length ? work.map(w=>`<div style="font-size:11px;margin-bottom:3px">✓ ${UI.esc(w.title)}</div>`).join('') : `<span class="nr">None recorded</span>`}
            </div>
          </div>
          ${acts.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-lt)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:4px">Action Items</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${acts.map(a=>`<span style="font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:2px 6px">${UI.esc(a.task)} — ${UI.esc(a.assignedTo||'?')} ${UI.statusBadge(a.status)}</span>`).join('')}
            </div>
          </div>` : ''}
          <button class="btn btn-ghost btn-sm mt-3 no-print" onclick="viewMeeting('${m.id}');UI.navigate('meetings',false)">Full minutes →</button>
        </div>
      </details>`;
    }).join('');
  }
  html += `</div></div>`;

  /* All directives table */
  html += `<div class="card">
    <div class="card-header">
      <div class="card-title">Faculty Instructions Register</div>
      <button class="btn btn-sm btn-primary no-print" onclick="openDirectiveModal()">+ Add Instruction</button>
    </div>
    <div class="card-body" style="padding:0">
      ${allDirs.length ? `<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl">
        <thead><tr><th>ID</th><th>Instruction</th><th>Assigned</th><th>Deadline</th><th>Priority</th><th>Status</th><th>Verification</th><th class="no-print">Actions</th></tr></thead>
        <tbody>${allDirs.map(d=>`<tr>
          <td class="id-cell">${UI.esc(d.directiveId||'—')}</td>
          <td style="max-width:220px"><div style="font-size:12px">${UI.esc(d.instruction)}</div>
            ${d.expectedOutcome?`<div style="font-size:10px;color:var(--text-3)">Expected: ${UI.esc(d.expectedOutcome.slice(0,60))}…</div>`:''}
          </td>
          <td style="font-size:11px">${UI.esc(d.assignedTo||'—')}</td>
          <td style="font-size:11px;white-space:nowrap">${UI.fmtDateRaw(d.deadline)}</td>
          <td>${UI.priorityBadge(d.priority)}</td>
          <td>${UI.statusBadge(d.status)}</td>
          <td>${UI.verifyBadge(d.verificationMethod)}</td>
          <td class="no-print"><div class="row-actions">
            <button class="btn btn-ghost btn-icon btn-xs" onclick="editDirective('${d.id}')">✏</button>
            <button class="btn btn-ghost btn-icon btn-xs" onclick="viewDirectiveTrace('${d.id}')">🔗</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>`
      : `<div class="empty-state" style="padding:30px"><div class="empty-title">No directives recorded</div></div>`}
    </div>
  </div>`;
  el.innerHTML = html;
};

/* ════════════════════════════════════════════════════════════
   CONSOLIDATED PAGE: TEAM & TASKS
   ════════════════════════════════════════════════════════════ */
window.render_team_tasks = function () {
  const el = document.getElementById('tt-content');
  if (!el) return;
  const members = DB.Members.list();
  const tasks   = DB.Tasks.list();

  if (!members.length) {
    el.innerHTML = UI.emptyState({icon:'👥',title:'No team members recorded',desc:'Add each member to track contributions and tasks.',btn:'+ Add Member',btnCb:'openMemberModal()'});
    return;
  }

  /* Summary table */
  const ts = DB.Stats.tasks();
  let html = `<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr))">
    <div class="stat-cell ok-left"><div class="stat-lbl">Completed</div><div class="stat-val c-ok">${ts.completed}</div></div>
    <div class="stat-cell accent-left"><div class="stat-lbl">In Progress</div><div class="stat-val c-accent">${ts.inProgress}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">Pending</div><div class="stat-val c-warn">${ts.pending}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Blocked</div><div class="stat-val c-err">${ts.blocked}</div></div>
  </div>`;

  /* Per-member collapsible sections */
  html += members.map(m => {
    const mTasks = tasks.filter(t=>t.assignedTo===m.id);
    const s = DB.Stats.memberSummary(m.id);
    const pct = s.total ? Math.round((s.completed/s.total)*100) : 0;
    const delivs = DB.Deliverables.list().filter(d=>d.memberId===m.id);
    return `<div class="card mb-3">
      <div class="card-header" style="padding:10px 14px">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          ${UI.avatar(m.name,30)}
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${UI.esc(m.name)}</div>
            <div style="font-size:10px;color:var(--text-3)">${UI.esc(m.role||'—')} · ${UI.esc(m.responsibilities||'—')}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:18px;font-weight:700;color:var(--accent)">${pct}%</div>
            <div style="font-size:9px;color:var(--text-3)">${s.completed}/${s.total} tasks</div>
          </div>
        </div>
        <div class="flex gap-1 no-print">
          <button class="btn btn-ghost btn-icon btn-xs" onclick="viewMember('${m.id}');UI.navigate('contributions',false)" title="Full profile">↗</button>
          <button class="btn btn-ghost btn-sm btn-xs" onclick="openTaskModal(null,'${m.id}')">+ Task</button>
        </div>
      </div>
      <div class="card-body" style="padding:10px 14px">
        <div style="margin-bottom:6px">
          <div class="prog-wrap" style="height:5px"><div class="prog-fill" style="width:${pct}%"></div></div>
        </div>
        ${mTasks.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Task</th><th>Category</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Evidence &amp; Proof</th><th class="no-print">Actions</th></tr></thead>
          <tbody>${mTasks.map(t=>`<tr>
            <td style="max-width:200px;font-size:12px">
              <div style="font-weight:600">${UI.esc(t.title)}</div>
              <div style="font-size:10px;color:var(--text-3)">${UI.esc(t.taskId||'')} ${t.directiveId ? '· '+UI.directiveRef(t.directiveId) : ''}</div>
              ${t.reviewComment ? `<div style="font-size:10px;color:var(--accent);margin-top:2px" title="Reviewer Note: ${UI.esc(t.reviewComment)}">💬 ${UI.esc(t.reviewComment.slice(0, 45))}${t.reviewComment.length>45?'…':''}</div>` : ''}
            </td>
            <td>${UI.catChip(t.category||'—')}</td>
            <td>${UI.priorityBadge(t.priority)}</td>
            <td style="font-size:11px;white-space:nowrap">${UI.fmtDateRaw(t.deadline)}</td>
            <td>${UI.statusBadge(t.status)}</td>
            <td>${UI.evidenceThumb(t.taskId||t.id)}</td>
            <td class="no-print"><div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-xs" onclick="openEvidenceModal('${t.taskId||t.id}', 0)" title="Evidence &amp; Verification">📸</button>
              <button class="btn btn-ghost btn-icon btn-xs" onclick="editTask('${t.id}')" title="Edit Task">✏</button>
              <button class="btn btn-ghost btn-icon btn-xs" onclick="deleteTask('${t.id}','${m.id}')" title="Delete Task">✕</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="t-xs t-muted t-italic">No tasks assigned yet.</div>`}
        ${delivs.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-lt)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:4px">Deliverables (${delivs.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${delivs.map(d=>`<a href="${UI.esc(d.link||'#')}" target="_blank" style="font-size:11px;background:var(--ok-bg);border:1px solid var(--ok-bd);border-radius:2px;padding:2px 7px;color:var(--ok);text-decoration:none">${UI.esc(d.title)}</a>`).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = html;
};

/* ════════════════════════════════════════════════════════════
   CONSOLIDATED PAGE: TECHNICAL PROGRESS
   ════════════════════════════════════════════════════════════ */
window.render_technical_progress = function () {
  const el = document.getElementById('tp-content');
  if (!el) return;
  const changes   = DB.Changes.list().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const decisions = DB.Decisions.list().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const tests     = DB.Tests.list().sort((a,b)=>new Date(b.testDate)-new Date(a.testDate)).slice(0,3);

  const chgStats = DB.Stats.changes();
  let html = `<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">
    <div class="stat-cell accent-left"><div class="stat-lbl">Total Changes</div><div class="stat-val c-accent">${chgStats.total}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">Planned</div><div class="stat-val c-warn">${chgStats.planned}</div></div>
    <div class="stat-cell"><div class="stat-lbl">Decisions</div><div class="stat-val">${DB.Decisions.list().length}</div></div>
    <div class="stat-cell"><div class="stat-lbl">Test Records</div><div class="stat-val">${DB.Tests.list().length}</div></div>
  </div>`;

  /* Changes by subsystem (tabbed inline) */
  const subsystems = ['All','Document Processing','Database','Search & Retrieval','Frontend','Backend','Other'];
  html += `<div class="card mb-4">
    <div class="card-header">
      <div class="card-title">Technical Change Register</div>
      <button class="btn btn-sm btn-primary no-print" onclick="openChangeModal()">+ Record Change</button>
    </div>
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);padding:0 14px;background:var(--surface-2);border-radius:0;overflow-x:auto">
      ${subsystems.map((s,i)=>`<button class="tab-btn ${i===0?'active':''}" data-tp-tab="${s}" onclick="_setTpTab(this,'${s.replace(/&/g,'&amp;')}')" style="font-size:11px;padding:8px 12px">${s}</button>`).join('')}
    </div>
    <div id="tp-changes-body" style="padding:0">`;
  if (!changes.length) {
    html += `<div class="empty-state" style="padding:30px"><div class="empty-title">No changes recorded</div></div>`;
  } else {
    html += `<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl" id="tp-changes-table">
      <thead><tr><th>ID</th><th>Date</th><th>Subsystem</th><th>Change</th><th>By</th><th>Status</th></tr></thead>
      <tbody>${changes.map(c=>`<tr data-subsystem="${UI.esc(c.subsystem||c.category||'Other')}">
        <td class="id-cell">${UI.esc(c.changeId||'—')}</td>
        <td style="font-size:11px;white-space:nowrap">${UI.fmtDateRaw(c.date)}</td>
        <td>${UI.catChip(c.subsystem||c.category||'—')}</td>
        <td style="max-width:260px">
          <div style="font-size:12px;font-weight:500">${UI.esc(c.title)}</div>
          ${c.newBehaviour?`<div style="font-size:10px;color:var(--text-3)">${UI.esc(c.newBehaviour.slice(0,70))}${c.newBehaviour.length>70?'…':''}</div>`:''}
          ${c.isPlanned?`<span class="badge s-planned" style="font-size:9px">Planned</span>`:''}
        </td>
        <td style="font-size:11px">${UI.esc(c.implementedBy||'—')}</td>
        <td>${UI.statusBadge(c.status)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
  html += `</div></div>`;

  /* Key decisions */
  html += `<div class="card mb-4">
    <div class="card-header">
      <div class="card-title">Key Technical Decisions</div>
      <button class="btn btn-sm btn-secondary no-print" onclick="UI.navigate('decisions')">Full register →</button>
    </div>
    <div class="card-body" style="padding:0">
      ${decisions.length ? `<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl">
        <thead><tr><th>ID</th><th>Question / Decision</th><th>Status</th><th>Implementation</th></tr></thead>
        <tbody>${decisions.map(d=>`<tr>
          <td class="id-cell">${UI.esc(d.decisionId||'—')}</td>
          <td style="max-width:280px">
            <div style="font-size:12px;font-weight:500">${UI.esc(d.question)}</div>
            ${d.decision?`<div style="font-size:10px;color:var(--text-3)">Decision: ${UI.esc(d.decision.slice(0,70))}${d.decision.length>70?'…':''}</div>`:''}
          </td>
          <td>${UI.statusBadge(d.status||'Under Review')}</td>
          <td>${UI.statusBadge(d.implementationStatus||'Planned')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
      : `<div class="empty-state" style="padding:24px"><div class="empty-title">No decisions recorded</div></div>`}
    </div>
  </div>`;

  /* Latest test results */
  html += `<div class="card">
    <div class="card-header">
      <div class="card-title">Latest Test Results</div>
      <button class="btn btn-sm btn-secondary no-print" onclick="UI.navigate('testing')">All test records →</button>
    </div>
    <div class="card-body">
      ${tests.length ? tests.map(t=>`<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border-lt)">
        <div style="font-size:12px;font-weight:600">${UI.esc(t.testId||'—')} — ${UI.fmtDateRaw(t.testDate)}</div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">${UI.esc(t.dataset||'Dataset not recorded')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['precisionK','recallK','mrr','ndcg'].map(k=>`
            <div style="background:var(--accent-lt);border:1px solid var(--accent-bd);border-radius:2px;padding:2px 8px;text-align:center">
              <div style="font-size:9px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em">${{precisionK:'P@K',recallK:'R@K',mrr:'MRR',ndcg:'NDCG'}[k]}</div>
              <div style="font-size:13px;font-weight:700;color:var(--accent)">${t[k]||'—'}</div>
            </div>`).join('')}
          ${t.latency?`<div style="background:var(--surface-3);border:1px solid var(--border);border-radius:2px;padding:2px 8px;text-align:center">
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">Latency</div>
            <div style="font-size:13px;font-weight:700">${t.latency}ms</div>
          </div>`:''}
        </div>
      </div>`).join('')
      : `<div class="t-sm t-muted t-italic">No test records yet. Add via admin links in sidebar.</div>`}
    </div>
  </div>`;

  el.innerHTML = html;
  /* re-apply tab filter after render */
  _setTpTab(document.querySelector('[data-tp-tab="All"]'), 'All');
};

function _setTpTab(btn, tab) {
  document.querySelectorAll('[data-tp-tab]').forEach(b=>b.classList.toggle('active', b.dataset.tpTab===tab));
  const rows = document.querySelectorAll('#tp-changes-table tbody tr');
  rows.forEach(row => {
    row.style.display = (tab==='All' || row.dataset.subsystem===tab) ? '' : 'none';
  });
}

/* ════════════════════════════════════════════════════════════
   CONSOLIDATED PAGE: ISSUES & REPORTS
   ════════════════════════════════════════════════════════════ */
window.render_issues_reports = function () {
  const el = document.getElementById('ir-content');
  if (!el) return;
  const issues   = DB.Issues.list().sort((a,b)=>new Date(b.dateIdentified)-new Date(a.dateIdentified));
  const open     = issues.filter(i=>['Open','Investigating','Blocked'].includes(i.status));
  const is       = DB.Stats.issues();

  /* Stats */
  let html = `<div class="stat-row mb-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr))">
    <div class="stat-cell err-left"><div class="stat-lbl">Open</div><div class="stat-val c-err">${is.open}</div></div>
    <div class="stat-cell ok-left"><div class="stat-lbl">Resolved</div><div class="stat-val c-ok">${is.resolved}</div></div>
    <div class="stat-cell err-left"><div class="stat-lbl">Critical</div><div class="stat-val c-err">${is.critical}</div></div>
    <div class="stat-cell warn-left"><div class="stat-lbl">High</div><div class="stat-val c-warn">${is.high}</div></div>
  </div>`;

  /* Issues table */
  html += `<div class="card mb-4">
    <div class="card-header">
      <div class="card-title">Issues &amp; Blockers</div>
      <button class="btn btn-sm btn-primary no-print" onclick="openIssueModal()">+ Add Issue</button>
    </div>
    <div class="card-body" style="padding:0">
      ${issues.length ? `<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl">
        <thead><tr><th>ID</th><th>Description</th><th>Severity</th><th>Owner</th><th>Root Cause</th><th>Status</th></tr></thead>
        <tbody>${issues.map(i=>`<tr>
          <td class="id-cell">${UI.esc(i.issueId||'—')}</td>
          <td style="max-width:220px;font-size:12px">${UI.esc(i.description)}</td>
          <td><span class="badge ${i.severity==='Critical'?'p-critical':i.severity==='High'?'p-high':i.severity==='Medium'?'p-medium':'p-low'}">${UI.esc(i.severity||'—')}</span></td>
          <td style="font-size:11px">${UI.esc(i.assignedTo||'—')}</td>
          <td style="font-size:11px;max-width:140px">${UI.esc(i.rootCause||'—')}</td>
          <td>${UI.statusBadge(i.status)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
      : `<div class="empty-state" style="padding:24px"><div class="empty-title">No issues recorded</div></div>`}
    </div>
  </div>`;

  /* Report generator */
  const sel = `<select id="ir-member" class="fc" style="width:160px"><option value="">All members</option>${DB.Members.list().map(m=>`<option value="${m.id}">${UI.esc(m.name)}</option>`).join('')}</select>`;
  html += `<div class="card">
    <div class="card-header"><div class="card-title">Generate Progress Report</div></div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="fg"><label class="lbl">From date</label><input type="date" id="rpt-from" class="fc"></div>
          <div class="fg"><label class="lbl">To date</label><input type="date" id="rpt-to" class="fc"></div>
          <div class="fg"><label class="lbl">Member</label>${sel}</div>
          <div class="fg">
            <label class="lbl">Sections</label>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
              ${[['overview','Project Overview'],['team','Team & Responsibilities'],['meetings','Meeting Minutes'],['directives','Faculty Directives'],['changes','Technical History'],['issues','Issues & Resolutions'],['testing','Testing Results'],['milestones','Milestones & Pending Work']].map(([v,l])=>`
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
                  <input type="checkbox" class="rpt-sec-cb" value="${v}" checked> ${l}
                </label>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <button class="btn btn-primary" onclick="generateReport()">▶ Generate</button>
            <button class="btn btn-secondary" onclick="printReport()">🖨 Print / PDF</button>
            <button class="btn btn-secondary" onclick="exportData()">⬇ Backup</button>
          </div>
        </div>
        <div>
          <div class="callout info" style="margin-bottom:10px">
            <strong>How to save as PDF</strong>Click Generate, then Print / PDF. In the print dialog choose <em>Save as PDF</em> as destination.
          </div>
          <div id="rpt-status" class="t-xs t-muted mb-2">Configure and click Generate.</div>
          <div id="rpt-preview" style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r);padding:12px;background:var(--surface);font-size:11px"></div>
        </div>
      </div>
    </div>
  </div>`;

  el.innerHTML = html;
};

/* ════════════════════════════════════════════════════════════
   TASK EVIDENCE, PROOF GALLERY & FACULTY VERIFICATION CONTROLLER
   ════════════════════════════════════════════════════════════ */
let _currentEvidenceTaskId = null;
let _currentEvidenceList = [];
let _currentEvidenceIndex = 0;
let _selectedEvidenceFile = null;
let _currentEvidenceTab = 'gallery';

window.openEvidenceModal = function (taskId, initialIndex = 0, openUpload = false) {
  _currentEvidenceTaskId = taskId;
  const allTasks = DB.Tasks.list();
  const task = allTasks.find(t => t.taskId === taskId || t.id === taskId);
  const actualTaskId = task ? (task.taskId || task.id) : taskId;
  const member = task && task.assignedTo ? DB.Members.get(task.assignedTo) : null;

  // Populate header details
  const idEl = document.getElementById('ev-modal-task-id');
  if (idEl) idEl.textContent = actualTaskId;
  const titleEl = document.getElementById('evidence-modal-title');
  if (titleEl) titleEl.textContent = task ? task.title : 'Task Evidence';
  const badgeEl = document.getElementById('ev-modal-status-badge');
  if (badgeEl) badgeEl.innerHTML = task ? UI.statusBadge(task.status) : '';
  const metaEl = document.getElementById('ev-modal-member-name');
  if (metaEl) metaEl.textContent = member ? member.name : (task?.assignedTo || 'Unassigned');

  // Pre-fill uploader name
  const uploaderInput = document.getElementById('ev-uploader');
  if (uploaderInput) uploaderInput.value = member ? member.name : '';

  // Reset selected file & inputs
  clearSelectedEvidenceFile();
  const captionInput = document.getElementById('ev-caption');
  if (captionInput) captionInput.value = '';

  // Load evidence list
  _currentEvidenceList = DB.Evidence ? DB.Evidence.list(actualTaskId) : [];
  const countEl = document.getElementById('ev-gallery-count');
  if (countEl) countEl.textContent = _currentEvidenceList.length;

  // Background sync with server
  if (DB.Evidence && DB.Evidence.sync) {
    DB.Evidence.sync(actualTaskId).then(serverItems => {
      if (serverItems && _currentEvidenceTaskId === taskId) {
        _currentEvidenceList = serverItems;
        const cnt = document.getElementById('ev-gallery-count');
        if (cnt) cnt.textContent = _currentEvidenceList.length;
        if (_currentEvidenceTab === 'gallery') renderEvidenceGallery();
      }
    }).catch(() => {});
  }

  if (openUpload || _currentEvidenceList.length === 0) {
    switchEvidenceTab('upload');
  } else {
    _currentEvidenceIndex = Math.max(0, Math.min(initialIndex, _currentEvidenceList.length - 1));
    switchEvidenceTab('gallery');
  }

  UI.openModal('evidence-modal');
};

window.switchEvidenceTab = function (tabName) {
  _currentEvidenceTab = tabName;
  ['gallery', 'upload', 'review'].forEach(t => {
    const btn = document.getElementById(`ev-tab-${t}-btn`);
    const pane = document.getElementById(`ev-tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
  });

  if (tabName === 'gallery') renderEvidenceGallery();
  else if (tabName === 'review') renderEvidenceReview();
};

window.renderEvidenceGallery = function () {
  const el = document.getElementById('ev-gallery-content');
  if (!el) return;

  const actualTaskId = _currentEvidenceTaskId;
  _currentEvidenceList = DB.Evidence ? DB.Evidence.list(actualTaskId) : [];
  const countEl = document.getElementById('ev-gallery-count');
  if (countEl) countEl.textContent = _currentEvidenceList.length;

  if (!_currentEvidenceList.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:40px 20px;background:var(--surface-2);border-radius:6px;border:1px dashed var(--border)">
        <div style="font-size:36px;margin-bottom:8px">📷</div>
        <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px">No proof images attached yet</div>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:14px;max-width:380px;margin-left:auto;margin-right:auto">
          Upload screenshots, photos, or diagrams from your computer to prove that this task was completed correctly.
        </div>
        <button class="btn btn-primary btn-sm" onclick="switchEvidenceTab('upload')">+ Attach Proof</button>
      </div>
    `;
    return;
  }

  if (_currentEvidenceIndex >= _currentEvidenceList.length) {
    _currentEvidenceIndex = _currentEvidenceList.length - 1;
  }
  if (_currentEvidenceIndex < 0) _currentEvidenceIndex = 0;

  const current = _currentEvidenceList[_currentEvidenceIndex];
  const total = _currentEvidenceList.length;

  let html = `
    <!-- Large Preview Stage -->
    <div class="evidence-preview-stage">
      <img src="${UI.esc(current.url)}" alt="${UI.esc(current.filename)}" class="evidence-main-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2394a3b8\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg>'">
      <div class="evidence-slide-counter">Proof ${_currentEvidenceIndex + 1} of ${total}</div>
      <a href="${UI.esc(current.url)}" target="_blank" class="evidence-zoom-hint" title="Open high-resolution in new tab">↗ View Full Size</a>
      ${total > 1 ? `
        <button class="evidence-carousel-btn prev" onclick="prevEvidenceImage()" title="Previous Image (←)">‹</button>
        <button class="evidence-carousel-btn next" onclick="nextEvidenceImage()" title="Next Image (→)">›</button>
      ` : ''}
    </div>
  `;

  // Carousel thumbnail strip if multiple images
  if (total > 1) {
    html += `<div class="evidence-thumb-strip">
      ${_currentEvidenceList.map((item, idx) => `
        <div class="evidence-strip-item ${idx === _currentEvidenceIndex ? 'active' : ''}" onclick="selectEvidenceImage(${idx})" title="Proof #${idx+1}: ${UI.esc(item.filename)}">
          <img src="${UI.esc(item.url)}" alt="Thumb ${idx+1}">
        </div>
      `).join('')}
    </div>`;
  }

  // Caption and Metadata Panel
  html += `
    <div class="evidence-meta-panel">
      <div class="evidence-caption-box">
        <div>
          <div class="evidence-meta-lbl">Caption / Explanation</div>
          <div style="font-size:13px;color:var(--text);margin-top:2px" id="ev-display-caption">
            ${current.caption ? UI.esc(current.caption) : '<span class="t-muted t-italic">No caption provided.</span>'}
          </div>
        </div>
        <button class="btn btn-ghost btn-xs" onclick="editCurrentCaption('${current.id}')" title="Edit caption">✏ Edit</button>
      </div>

      <div class="evidence-meta-row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-lt)">
        <span><strong class="evidence-meta-lbl">File:</strong> <code>${UI.esc(current.filename)}</code></span>
        <span><strong class="evidence-meta-lbl">Size:</strong> ${UI.fmtFileSize(current.sizeBytes)}</span>
        <span><strong class="evidence-meta-lbl">Uploaded:</strong> ${UI.fmtDateTime(current.uploadedAt)}</span>
        <span><strong class="evidence-meta-lbl">By:</strong> ${UI.esc(current.uploadedBy || 'Team Member')}</span>
        <span><strong class="evidence-meta-lbl">Review:</strong> ${UI.statusBadge(current.reviewStatus || 'Pending')}</span>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border-lt);flex-wrap:wrap;gap:8px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="replaceCurrentEvidence('${current.id}')">🔄 Replace Image</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--err)" onclick="deleteCurrentEvidence('${current.id}')">🗑 Remove</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="switchEvidenceTab('upload')">+ Add Another Proof</button>
          <button class="btn btn-primary btn-sm" onclick="switchEvidenceTab('review')">🎓 Faculty Review →</button>
        </div>
      </div>
    </div>
  `;

  el.innerHTML = html;
};

window.prevEvidenceImage = function () {
  if (!_currentEvidenceList.length) return;
  _currentEvidenceIndex = (_currentEvidenceIndex - 1 + _currentEvidenceList.length) % _currentEvidenceList.length;
  renderEvidenceGallery();
};

window.nextEvidenceImage = function () {
  if (!_currentEvidenceList.length) return;
  _currentEvidenceIndex = (_currentEvidenceIndex + 1) % _currentEvidenceList.length;
  renderEvidenceGallery();
};

window.selectEvidenceImage = function (index) {
  _currentEvidenceIndex = index;
  renderEvidenceGallery();
};

window.handleEvidenceFileSelect = function (input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const validExts = ['.png', '.jpg', '.jpeg'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    UI.toast('Please select a PNG, JPG, or JPEG image file', 'err');
    input.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    UI.toast('File size exceeds 10MB limit', 'err');
    input.value = '';
    return;
  }

  _selectedEvidenceFile = file;

  // Show preview
  const prevBox = document.getElementById('ev-selected-preview');
  const thumb = document.getElementById('ev-selected-thumb');
  const nameEl = document.getElementById('ev-selected-filename');
  const sizeEl = document.getElementById('ev-selected-size');

  if (prevBox && thumb && nameEl && sizeEl) {
    nameEl.textContent = file.name;
    sizeEl.textContent = `${UI.fmtFileSize(file.size)} · ${file.type || 'image'}`;
    const reader = new FileReader();
    reader.onload = e => { thumb.src = e.target.result; };
    reader.readAsDataURL(file);
    prevBox.style.display = 'flex';
  }
};

window.clearSelectedEvidenceFile = function () {
  _selectedEvidenceFile = null;
  const input = document.getElementById('ev-file-input');
  if (input) input.value = '';
  const prevBox = document.getElementById('ev-selected-preview');
  if (prevBox) prevBox.style.display = 'none';
};

window.handleEvidenceUpload = async function (event) {
  event.preventDefault();
  if (!_selectedEvidenceFile) {
    UI.toast('Please select an image file first', 'err');
    return;
  }

  const submitBtn = document.getElementById('ev-upload-submit-btn');
  const btnText = document.getElementById('ev-upload-btn-text');
  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Uploading to server…';

  const caption = (document.getElementById('ev-caption')?.value || '').trim();
  const uploader = (document.getElementById('ev-uploader')?.value || '').trim();
  const statusUpdate = document.getElementById('ev-upload-status')?.value;

  try {
    await DB.Evidence.upload(_currentEvidenceTaskId, _selectedEvidenceFile, caption, uploader);

    // If member chose "Submitted for Review", update task status
    if (statusUpdate === 'Submitted for Review') {
      const allTasks = DB.Tasks.list();
      const task = allTasks.find(t => t.taskId === _currentEvidenceTaskId || t.id === _currentEvidenceTaskId);
      if (task) {
        DB.Tasks.update(task.id, { status: 'Submitted for Review' });
        const badgeEl = document.getElementById('ev-modal-status-badge');
        if (badgeEl) badgeEl.innerHTML = UI.statusBadge('Submitted for Review');
      }
    }

    UI.toast('Evidence uploaded and saved successfully!', 'ok');
    clearSelectedEvidenceFile();
    document.getElementById('ev-caption').value = '';

    _refreshCurrentTasksView();

    // Switch to gallery and show newly uploaded file
    _currentEvidenceList = DB.Evidence.list(_currentEvidenceTaskId);
    _currentEvidenceIndex = _currentEvidenceList.length - 1;
    switchEvidenceTab('gallery');
  } catch (err) {
    console.error('Upload failed:', err);
    UI.toast('Upload failed: ' + (err.message || 'Server error'), 'err');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = 'Upload Evidence';
  }
};

window.replaceCurrentEvidence = function (evidenceId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/jpg';
  input.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!await UI.confirm(`Replace attachment with "${file.name}"?`, 'Replace Image Proof')) return;

    try {
      UI.toast('Uploading replacement…');
      await DB.Evidence.replace(evidenceId, file);
      UI.toast('Proof image replaced successfully!', 'ok');
      _refreshCurrentTasksView();
      renderEvidenceGallery();
    } catch (err) {
      UI.toast('Replace failed: ' + (err.message || 'Error'), 'err');
    }
  };
  input.click();
};

window.deleteCurrentEvidence = async function (evidenceId) {
  if (!await UI.confirm('Remove this proof attachment? The file will be deleted from storage.', 'Delete Attachment')) return;
  try {
    await DB.Evidence.remove(evidenceId);
    UI.toast('Attachment deleted', 'ok');
    _refreshCurrentTasksView();
    _currentEvidenceList = DB.Evidence.list(_currentEvidenceTaskId);
    if (_currentEvidenceIndex >= _currentEvidenceList.length) {
      _currentEvidenceIndex = Math.max(0, _currentEvidenceList.length - 1);
    }
    renderEvidenceGallery();
  } catch (err) {
    UI.toast('Delete failed: ' + err.message, 'err');
  }
};

window.editCurrentCaption = async function (evidenceId) {
  const ev = DB.Evidence.get(evidenceId);
  const currentCaption = ev ? (ev.caption || '') : '';
  const newCaption = prompt('Enter caption explaining what this image proves:', currentCaption);
  if (newCaption === null) return;
  await DB.Evidence.updateCaption(evidenceId, newCaption.trim());
  UI.toast('Caption updated', 'ok');
  renderEvidenceGallery();
};

window.renderEvidenceReview = function () {
  const el = document.getElementById('ev-review-content');
  if (!el) return;

  const allTasks = DB.Tasks.list();
  const task = allTasks.find(t => t.taskId === _currentEvidenceTaskId || t.id === _currentEvidenceTaskId);
  const meta = DB.Meta.get();
  const member = task && task.assignedTo ? DB.Members.get(task.assignedTo) : null;
  const count = DB.Evidence ? DB.Evidence.list(_currentEvidenceTaskId).length : 0;

  const isVerified = task?.status === 'Verified';
  const isChanges = task?.status === 'Changes Requested';

  el.innerHTML = `
    <!-- Review Status Overview Card -->
    <div class="faculty-review-box ${isVerified ? 'is-verified' : isChanges ? 'is-changes' : ''}">
      <div class="faculty-review-header">
        <div class="faculty-review-title">
          <span>🎓</span> Faculty Review &amp; Task Verification
        </div>
        <div>
          ${task ? UI.statusBadge(task.status) : ''}
        </div>
      </div>

      <div class="kv-grid mb-2">
        ${UI.kv('Task', task ? `${task.taskId}: ${task.title}` : '—')}
        ${UI.kv('Assigned Member', member ? member.name : (task?.assignedTo || '—'))}
        ${UI.kv('Proof Attachments', `${count} image${count !== 1 ? 's' : ''} available for inspection`)}
        ${UI.kv('Last Reviewer', task?.reviewedBy || 'Pending initial review')}
      </div>

      ${task?.reviewComment ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-top:8px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-3);margin-bottom:3px">
            Previous Review Feedback ${task.reviewedAt ? `(${UI.fmtDateTime(task.reviewedAt)})` : ''}:
          </div>
          <div style="font-size:12px;color:var(--text)">${UI.esc(task.reviewComment)}</div>
        </div>
      ` : ''}
    </div>

    <!-- Verification Actions Form -->
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:14px">
      <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:10px">
        Submit Faculty Evaluation
      </div>

      <div class="fg mb-3">
        <label class="lbl">Reviewer Name &amp; Title</label>
        <input type="text" id="rev-reviewer-name" class="fc" value="${UI.esc(task?.reviewedBy || meta.faculty || 'Faculty Guide')}">
        <div class="t-xs t-muted" style="margin-top:2px">Name of faculty supervisor, guide, or project lead.</div>
      </div>

      <div class="fg mb-3">
        <label class="lbl">Review Comment &amp; Recommendations (Optional)</label>
        <textarea id="rev-comment" class="fc" rows="3" placeholder="State reasons for approval, or specific changes required to complete the task...">${UI.esc(task?.reviewComment || '')}</textarea>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
        <button type="button" class="btn btn-secondary btn-sm" onclick="submitTaskReview('In Progress')">
          ↺ Reset to In Progress
        </button>
        <button type="button" class="btn btn-secondary btn-sm" style="color:var(--warn);border-color:var(--warn-bd)" onclick="submitTaskReview('Changes Requested')">
          ⚠ Request Changes
        </button>
        <button type="button" class="btn btn-primary btn-sm" style="background:#059669;border-color:#047857" onclick="submitTaskReview('Verified')">
          ✓ Mark as Verified
        </button>
      </div>
    </div>
  `;
};

window.submitTaskReview = async function (newStatus) {
  const reviewerName = (document.getElementById('rev-reviewer-name')?.value || '').trim() || 'Faculty Reviewer';
  const comment = (document.getElementById('rev-comment')?.value || '').trim();

  try {
    await DB.Evidence.reviewTask(_currentEvidenceTaskId, newStatus, comment, reviewerName);
    UI.toast(`Task status updated to "${newStatus}"`, 'ok');

    // Update modal header badge
    const badgeEl = document.getElementById('ev-modal-status-badge');
    if (badgeEl) badgeEl.innerHTML = UI.statusBadge(newStatus);

    _refreshCurrentTasksView();
    renderEvidenceReview();
  } catch (err) {
    console.error('Review submission error:', err);
    UI.toast('Review submission failed: ' + err.message, 'err');
  }
};

// Global keyboard navigation for carousel
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('evidence-modal');
  if (!modal || !modal.classList.contains('open')) return;
  if (_currentEvidenceTab !== 'gallery') return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevEvidenceImage();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextEvidenceImage();
  }
});



/* ════════════════════════════════════════════════════════════
   MEETING DISCUSSION DOCUMENTATION
   openDiscussionModal, saveDiscussionEntry, editDiscussion,
   deleteDiscussion — full CRUD with backend sync & local fallback
   ════════════════════════════════════════════════════════════ */

/**
 * Open the discussion modal for a given meeting.
 * If editId is provided, the form is pre-filled for editing.
 */
function openDiscussionModal(meetingId, editId) {
  const f = document.getElementById('disc-form');
  if (!f) return;
  f.reset();
  document.getElementById('disc-meeting-id').value = meetingId || '';
  document.getElementById('disc-edit-id').value = editId || '';
  document.getElementById('disc-modal-title').textContent = editId
    ? 'Edit Discussion Entry' : 'Record Meeting Discussion Topic';

  // Populate traceability dropdowns
  const dirSel = document.getElementById('disc-rel-directive');
  if (dirSel) {
    dirSel.innerHTML = '<option value="">— None —</option>' +
      DB.Directives.list().map(d =>
        `<option value="${UI.esc(d.directiveId)}">${UI.esc(d.directiveId)} — ${UI.esc((d.instruction||'').slice(0,50))}</option>`
      ).join('');
  }
  const taskSel = document.getElementById('disc-rel-task');
  if (taskSel) {
    taskSel.innerHTML = '<option value="">— None —</option>' +
      DB.Tasks.list().map(t =>
        `<option value="${UI.esc(t.taskId||t.id)}">${UI.esc(t.taskId||'')} — ${UI.esc((t.title||'').slice(0,50))}</option>`
      ).join('');
  }
  const decSel = document.getElementById('disc-rel-decision');
  if (decSel) {
    decSel.innerHTML = '<option value="">— None —</option>' +
      DB.Decisions.list().map(d =>
        `<option value="${UI.esc(d.decisionId||d.id)}">${UI.esc(d.decisionId||'')} — ${UI.esc((d.question||'').slice(0,50))}</option>`
      ).join('');
  }

  // Pre-fill if editing
  if (editId) {
    const existing = DB.MeetingDiscussions.get(editId);
    if (existing) {
      document.getElementById('disc-topic').value = existing.topic || '';
      document.getElementById('disc-time').value = existing.discussionTime || '';
      document.getElementById('disc-speaker').value = existing.speaker || '';
      document.getElementById('disc-notes').value = existing.notes || '';
      const fiEl = document.getElementById('disc-faculty-instructions');
      if (fiEl) fiEl.value = existing.facultyInstructions || '';
      const decEl = document.getElementById('disc-decisions');
      if (decEl) decEl.value = existing.decisions || '';
      const fuEl = document.getElementById('disc-follow-up');
      if (fuEl) fuEl.value = existing.followUpActions || '';
      if (dirSel) dirSel.value = existing.relatedDirectiveId || '';
      if (taskSel) taskSel.value = existing.relatedTaskId || '';
      if (decSel) decSel.value = existing.relatedDecisionId || '';
    }
  }

  UI.openModal('discussion-modal');
}

/**
 * Called from the discussion modal Save button.
 */
window.saveDiscussionEntry = async function () {
  const f = document.getElementById('disc-form');
  if (!UI.validateForm(f)) return;

  const meetingId = document.getElementById('disc-meeting-id').value;
  const editId    = document.getElementById('disc-edit-id').value;
  const topic     = document.getElementById('disc-topic').value.trim();
  const notes     = document.getElementById('disc-notes').value.trim();
  const time      = document.getElementById('disc-time').value.trim();
  const speaker   = document.getElementById('disc-speaker').value.trim();
  const fi        = (document.getElementById('disc-faculty-instructions')?.value || '').trim();
  const decisions = (document.getElementById('disc-decisions')?.value || '').trim();
  const followUp  = (document.getElementById('disc-follow-up')?.value || '').trim();
  const relDir    = document.getElementById('disc-rel-directive')?.value || '';
  const relTask   = document.getElementById('disc-rel-task')?.value || '';
  const relDec    = document.getElementById('disc-rel-decision')?.value || '';

  const payload = {
    topic,
    notes,
    discussionTime: time,
    speaker,
    facultyInstructions: fi,
    decisions,
    followUpActions: followUp,
    relatedDirectiveId: relDir,
    relatedTaskId: relTask,
    relatedDecisionId: relDec,
    meetingId,
  };

  const submitBtn = document.querySelector('#discussion-modal .modal-ftr .btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  try {
    if (editId) {
      await DB.MeetingDiscussions.update(editId, payload);
      UI.toast('Discussion entry updated', 'ok');
    } else {
      await DB.MeetingDiscussions.create(meetingId, payload);
      UI.toast('Discussion recorded', 'ok');
    }
    UI.closeModal('discussion-modal');
    _renderMeetingDetail(meetingId);
  } catch (err) {
    UI.toast('Save failed: ' + err.message, 'err');
    console.error(err);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Discussion Entry'; }
  }
};

/**
 * Open the discussion modal pre-filled for editing.
 */
window.editDiscussion = function (discId) {
  const disc = DB.MeetingDiscussions.get(discId);
  if (!disc) { UI.toast('Discussion entry not found', 'err'); return; }
  openDiscussionModal(disc.meetingId, discId);
};

/**
 * Delete a discussion entry after confirmation.
 */
window.deleteDiscussion = async function (discId) {
  const disc = DB.MeetingDiscussions.get(discId);
  if (!disc) return;
  const ok = await UI.confirm(
    'Delete this discussion entry? Any images attached only to this topic will be unlinked from it (but not deleted).',
    'Delete Discussion Entry?'
  );
  if (!ok) return;
  const meetingId = disc.meetingId;
  await DB.MeetingDiscussions.remove(discId);
  UI.toast('Discussion entry deleted');
  _renderMeetingDetail(meetingId);
};

/* ════════════════════════════════════════════════════════════
   MEETING MEDIA UPLOAD
   openAttachMediaModal, handleMeetingMediaFileSelect,
   clearSelectedMeetingMediaFile, submitMeetingMediaUpload
   ════════════════════════════════════════════════════════════ */

let _mattSelectedFile = null;   // currently selected File object
let _mattMeetingId   = '';
let _mattDiscussionId = '';

/**
 * Open the meeting media attachment modal.
 * @param {string} meetingId  - ID of the meeting to attach to
 * @param {string} [discussionId] - optional discussion topic to link under
 */
window.openAttachMediaModal = function (meetingId, discussionId) {
  _mattMeetingId    = meetingId || '';
  _mattDiscussionId = discussionId || '';
  _mattSelectedFile = null;

  const f = document.getElementById('matt-form');
  if (!f) return;
  f.reset();
  document.getElementById('matt-meeting-id').value = meetingId || '';
  _clearMattPreview();

  // Populate discussion selector
  const discSel = document.getElementById('matt-discussion-id');
  if (discSel) {
    const discussions = DB.MeetingDiscussions.list(meetingId);
    discSel.innerHTML = '<option value="">— General Meeting Attachment —</option>' +
      discussions.map(d =>
        `<option value="${UI.esc(d.id)}" ${d.id === discussionId ? 'selected' : ''}>
          ${UI.esc(d.topic || 'Discussion #' + (d.orderIndex || ''))}
        </option>`
      ).join('');
  }

  // Populate reference selects
  const dirSel = document.getElementById('matt-rel-directive');
  if (dirSel) {
    dirSel.innerHTML = '<option value="">— None —</option>' +
      DB.Directives.list().map(d =>
        `<option value="${UI.esc(d.directiveId)}">${UI.esc(d.directiveId)} — ${UI.esc((d.instruction||'').slice(0,50))}</option>`
      ).join('');
  }
  const taskSel = document.getElementById('matt-rel-task');
  if (taskSel) {
    taskSel.innerHTML = '<option value="">— None —</option>' +
      DB.Tasks.list().map(t =>
        `<option value="${UI.esc(t.taskId||t.id)}">${UI.esc(t.taskId||'')} — ${UI.esc((t.title||'').slice(0,50))}</option>`
      ).join('');
  }
  const decSel = document.getElementById('matt-rel-decision');
  if (decSel) {
    decSel.innerHTML = '<option value="">— None —</option>' +
      DB.Decisions.list().map(d =>
        `<option value="${UI.esc(d.decisionId||d.id)}">${UI.esc(d.decisionId||'')} — ${UI.esc((d.question||'').slice(0,50))}</option>`
      ).join('');
  }

  document.getElementById('matt-modal-title').textContent = discussionId
    ? 'Attach Media to Discussion Topic'
    : 'Attach Media to Meeting Documentation';

  UI.openModal('meeting-attachment-modal');
};

/**
 * Handle file selection from the file input.
 */
window.handleMeetingMediaFileSelect = function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const ALLOWED = ['image/png','image/jpeg','image/jpg','image/webp','application/pdf'];
  if (!ALLOWED.includes(file.type)) {
    UI.toast('Unsupported file type. Please use PNG, JPG, JPEG, WEBP, or PDF.', 'err');
    input.value = '';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    UI.toast('File exceeds the 15MB limit.', 'err');
    input.value = '';
    return;
  }
  _mattSelectedFile = file;

  // Show preview
  const preview = document.getElementById('matt-selected-preview');
  const thumbWrap = document.getElementById('matt-preview-thumb-wrap');
  const nameEl = document.getElementById('matt-selected-filename');
  const sizeEl = document.getElementById('matt-selected-size');

  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = UI.fmtFileSize ? UI.fmtFileSize(file.size) : (Math.round(file.size/1024) + ' KB');

  if (thumbWrap) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      thumbWrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" alt="preview">`;
    } else {
      thumbWrap.innerHTML = `<span style="font-size:20px">📄</span>`;
    }
  }

  if (preview) preview.style.display = 'flex';
};

window.clearSelectedMeetingMediaFile = function () {
  _mattSelectedFile = null;
  const input = document.getElementById('matt-file-input');
  if (input) input.value = '';
  _clearMattPreview();
};

function _clearMattPreview() {
  const preview = document.getElementById('matt-selected-preview');
  if (preview) preview.style.display = 'none';
  const thumbWrap = document.getElementById('matt-preview-thumb-wrap');
  if (thumbWrap) thumbWrap.innerHTML = '';
}

/**
 * Upload the selected file to the meeting. Called from modal Submit button.
 */
window.submitMeetingMediaUpload = async function () {
  if (!_mattSelectedFile) {
    UI.toast('Please select a file first.', 'warn');
    return;
  }
  const caption    = (document.getElementById('matt-caption')?.value || '').trim();
  if (!caption) {
    UI.toast('Please add a caption explaining what this image shows.', 'warn');
    document.getElementById('matt-caption')?.focus();
    return;
  }
  const meetingId   = document.getElementById('matt-meeting-id')?.value || _mattMeetingId;
  const discId      = document.getElementById('matt-discussion-id')?.value || _mattDiscussionId;
  const uploadedBy  = (document.getElementById('matt-uploader')?.value || '').trim();
  const relDir      = document.getElementById('matt-rel-directive')?.value || '';
  const relTask     = document.getElementById('matt-rel-task')?.value || '';
  const relDec      = document.getElementById('matt-rel-decision')?.value || '';

  const btn = document.getElementById('matt-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

  try {
    const uploaded = await DB.MeetingAttachments.upload(meetingId, _mattSelectedFile, {
      caption,
      uploadedBy,
      discussionId: discId,
      relatedTaskId: relTask,
      relatedDirectiveId: relDir,
      relatedDecisionId: relDec,
    });
    UI.toast('Media attached successfully', 'ok');
    UI.closeModal('meeting-attachment-modal');
    _mattSelectedFile = null;
    // Refresh the meeting detail view
    if (_meetingDetailId === meetingId) {
      _renderMeetingDetail(meetingId);
    }
    // Also refresh meetings-instructions if it's the active page
    if (UI.currentPage() === 'meetings-instructions') {
      render_meetings_instructions();
    }
  } catch (err) {
    UI.toast('Upload failed: ' + err.message, 'err');
    console.error('Meeting media upload error:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Attach'; }
  }
};

/* ════════════════════════════════════════════════════════════
   MEETING MEDIA LIGHTBOX (preview modal)
   openMeetingMediaModal, navMeetingMedia, openMeetingMediaInNewTab,
   editMeetingAttachmentCaption, deleteMeetingAttachment
   ════════════════════════════════════════════════════════════ */

let _mmediaList    = [];  // attachments for the current meeting
let _mmediaIndex   = 0;   // index into _mmediaList
let _mmediaMtgId   = '';

/**
 * Open the media lightbox at a given attachment.
 */
window.openMeetingMediaModal = function (attId, meetingId) {
  _mmediaMtgId = meetingId || '';
  _mmediaList  = DB.MeetingAttachments.list(meetingId || '');
  if (!_mmediaList.length) {
    UI.toast('No attachments found for this meeting.', 'warn');
    return;
  }
  _mmediaIndex = Math.max(0, _mmediaList.findIndex(a => a.id === attId));
  _renderMmedia();
  UI.openModal('meeting-media-modal');
};

function _renderMmedia() {
  const att = _mmediaList[_mmediaIndex];
  if (!att) return;
  const isPdf = att.mimeType === 'application/pdf';
  const container = document.getElementById('mmedia-media-container');
  if (container) {
    if (isPdf) {
      container.innerHTML = `
        <div style="text-align:center;padding:20px">
          <div style="font-size:48px;margin-bottom:12px">📄</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:8px">${UI.esc(att.filename)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:16px">PDF document — cannot preview inline</div>
          <a href="${UI.esc(att.url)}" target="_blank" class="btn btn-primary btn-sm">Open PDF ↗</a>
        </div>`;
    } else {
      container.innerHTML = `<img src="${UI.esc(att.url)}" class="lightbox-img"
        alt="${UI.esc(att.caption || att.filename)}"
        style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px"
        onerror="this.style.display='none';this.nextSibling.style.display='block'">
        <div style="display:none;text-align:center;color:var(--text-3);font-size:13px;padding:20px">
          ⚠ Image could not load — server may not be running.
        </div>`;
    }
  }

  // Update meta
  const titleEl = document.getElementById('mmedia-modal-title');
  if (titleEl) titleEl.textContent = att.caption || att.filename;
  const captionEl = document.getElementById('mmedia-caption-text');
  if (captionEl) captionEl.textContent = att.caption || att.filename;
  const ctxEl = document.getElementById('mmedia-context-info');
  if (ctxEl) {
    const parts = [];
    if (att.uploadedBy) parts.push(`Uploaded by: ${att.uploadedBy}`);
    if (att.relatedTaskId) parts.push(`Task: ${att.relatedTaskId}`);
    if (att.relatedDirectiveId) parts.push(`Directive: ${att.relatedDirectiveId}`);
    if (att.relatedDecisionId) parts.push(`Decision: ${att.relatedDecisionId}`);
    ctxEl.textContent = parts.join(' · ') || 'No context links';
  }
  const fnEl = document.getElementById('mmedia-filename');
  if (fnEl) fnEl.textContent = att.filename || '—';
  const szEl = document.getElementById('mmedia-filesize');
  if (szEl) szEl.textContent = UI.fmtFileSize ? UI.fmtFileSize(att.sizeBytes) : (Math.round((att.sizeBytes||0)/1024) + ' KB');
  const upEl = document.getElementById('mmedia-uploader');
  if (upEl) upEl.textContent = att.uploadedBy || '—';
  const dtEl = document.getElementById('mmedia-date');
  if (dtEl) dtEl.textContent = UI.fmtDateTime(att.uploadedAt);
  const cntEl = document.getElementById('mmedia-counter');
  if (cntEl) cntEl.textContent = `${_mmediaIndex + 1} of ${_mmediaList.length}`;

  // Nav button visibility
  const prevBtn = document.getElementById('mmedia-prev-btn');
  const nextBtn = document.getElementById('mmedia-next-btn');
  if (prevBtn) prevBtn.style.display = _mmediaIndex > 0 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = _mmediaIndex < _mmediaList.length - 1 ? '' : 'none';
}

window.navMeetingMedia = function (dir) {
  const newIdx = _mmediaIndex + dir;
  if (newIdx < 0 || newIdx >= _mmediaList.length) return;
  _mmediaIndex = newIdx;
  _renderMmedia();
};

window.openMeetingMediaInNewTab = function () {
  const att = _mmediaList[_mmediaIndex];
  if (att && att.url) window.open(att.url, '_blank');
};

window.editMeetingAttachmentCaption = async function () {
  const att = _mmediaList[_mmediaIndex];
  if (!att) return;
  const current = att.caption || '';
  const newCap = prompt('Edit caption:', current);
  if (newCap === null) return;
  try {
    const updated = await DB.MeetingAttachments.updateCaption(att.id, newCap.trim());
    if (updated) {
      _mmediaList[_mmediaIndex] = updated;
      _renderMmedia();
      if (_meetingDetailId) _renderMeetingDetail(_meetingDetailId);
    }
    UI.toast('Caption updated', 'ok');
  } catch (err) {
    UI.toast('Update failed: ' + err.message, 'err');
  }
};

window.deleteMeetingAttachment = async function () {
  const att = _mmediaList[_mmediaIndex];
  if (!att) return;
  const ok = await UI.confirm(
    `Remove "${att.filename}" from this meeting? This will delete the file from storage.`,
    'Delete Attachment?'
  );
  if (!ok) return;
  try {
    await DB.MeetingAttachments.remove(att.id);
    _mmediaList.splice(_mmediaIndex, 1);
    UI.toast('Attachment deleted', 'ok');
    if (_mmediaList.length === 0) {
      UI.closeModal('meeting-media-modal');
      if (_meetingDetailId) _renderMeetingDetail(_meetingDetailId);
      return;
    }
    _mmediaIndex = Math.min(_mmediaIndex, _mmediaList.length - 1);
    _renderMmedia();
    if (_meetingDetailId) _renderMeetingDetail(_meetingDetailId);
  } catch (err) {
    UI.toast('Delete failed: ' + err.message, 'err');
  }
};

// Keyboard nav for meeting media lightbox
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('meeting-media-modal');
  if (!modal || !modal.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); navMeetingMedia(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); navMeetingMedia(1); }
});

/* ════════════════════════════════════════════════════════════
   MEETING FORMAL REPORT MODAL
   openMeetingReportModal, generateMeetingReportView, printMeetingReport
   ════════════════════════════════════════════════════════════ */

let _reportMeetingId = null;

window.openMeetingReportModal = function (meetingId) {
  _reportMeetingId = meetingId || null;
  // Populate scope selector
  const scopeSel = document.getElementById('mrpt-scope-select');
  if (scopeSel) {
    const meetings = DB.Meetings.list().sort((a,b) => (a.number||0) - (b.number||0));
    scopeSel.innerHTML = '<option value="all">All Project Meetings (Full Dossier)</option>' +
      meetings.map(m =>
        `<option value="${UI.esc(m.id)}" ${m.id === meetingId ? 'selected' : ''}>
          Meeting ${m.number||'?'}: ${UI.esc(m.title || 'Meeting '+m.number)} — ${UI.fmtDateRaw(m.date)}
        </option>`
      ).join('');
    if (meetingId) scopeSel.value = meetingId;
  }
  // Clear date filters
  const fromEl = document.getElementById('mrpt-date-from');
  const toEl   = document.getElementById('mrpt-date-to');
  if (fromEl) fromEl.value = '';
  if (toEl)   toEl.value   = '';
  generateMeetingReportView();
  UI.openModal('meeting-report-modal');
};

window.generateMeetingReportView = function () {
  const scopeVal  = document.getElementById('mrpt-scope-select')?.value || 'all';
  const fromDate  = document.getElementById('mrpt-date-from')?.value || '';
  const toDate    = document.getElementById('mrpt-date-to')?.value   || '';
  const container = document.getElementById('mrpt-preview-container');
  if (!container) return;

  const meta     = DB.Meta.get();
  const allMtgs  = DB.Meetings.list().sort((a,b) => (a.number||0) - (b.number||0));
  const meetings = scopeVal === 'all'
    ? allMtgs.filter(m => UI.inDateRange(m.date, fromDate, toDate))
    : allMtgs.filter(m => m.id === scopeVal);

  if (!meetings.length) {
    container.innerHTML = `<div style="color:#9ca3af;font-style:italic;text-align:center;padding:30px">No meetings match the selected filter.</div>`;
    return;
  }

  const genDate = new Date().toLocaleString('en-GB');

  let html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11pt;line-height:1.65;color:#111">
      <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1e2332">
        <div style="font-size:20pt;font-weight:700">${UI.esc(meta.projectName||'Search Engine Project')}</div>
        <div style="font-size:12pt;color:#374151;margin-top:4px">Meeting Documentation Report</div>
        <div style="font-size:9pt;color:#6b7280;margin-top:6px">
          ${meta.institution ? UI.esc(meta.institution) + ' · ' : ''}
          ${meta.faculty ? 'Faculty: ' + UI.esc(meta.faculty) + ' · ' : ''}
          Generated: ${genDate}
        </div>
        ${fromDate || toDate ? `<div style="font-size:9pt;color:#6b7280">Period: ${fromDate ? UI.fmtDateRaw(fromDate) : '—'} to ${toDate ? UI.fmtDateRaw(toDate) : '—'}</div>` : ''}
        <div style="font-size:8.5pt;color:#dc2626;margin-top:8px;background:#fef2f2;padding:4px 12px;display:inline-block;border-radius:3px">
          This report contains only recorded data. Missing information is marked as "Not recorded".
        </div>
      </div>`;

  meetings.forEach((m, mi) => {
    const linkedDirs  = DB.Directives.list().filter(d => d.meetingId === m.id);
    const discussions = DB.MeetingDiscussions.list(m.id);
    const atts        = DB.MeetingAttachments.list(m.id);
    const workItems   = m.workItems || [];
    const actionItems = m.actionItems || [];
    const feedback    = m.feedback || [];

    html += `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="background:#1e2332;color:#fff;padding:10px 16px;border-radius:4px 4px 0 0">
          <div style="font-size:14pt;font-weight:700">Meeting ${m.number||mi+1}: ${UI.esc(m.title||'Meeting '+m.number)}</div>
          <div style="font-size:10pt;opacity:.8">${UI.fmtDateRaw(m.date)}${m.time?' · '+UI.esc(m.time):''} · ${UI.esc(m.type||'Regular Meeting')} · State: ${UI.esc(m.state||'Draft')}</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 4px 4px;padding:16px">
          <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px">
            <tr><td style="padding:3px 8px;width:140px;color:#6b7280;font-weight:600">Attendees</td><td style="padding:3px 8px">${UI.esc(m.attendees||'—')}</td></tr>
            <tr><td style="padding:3px 8px;color:#6b7280;font-weight:600">Absent</td><td style="padding:3px 8px">${UI.esc(m.absent||'—')}</td></tr>
            <tr><td style="padding:3px 8px;color:#6b7280;font-weight:600">Objective</td><td style="padding:3px 8px">${UI.esc(m.objective||'—')}</td></tr>
            <tr><td style="padding:3px 8px;color:#6b7280;font-weight:600">Agenda</td><td style="padding:3px 8px">${UI.esc(m.agenda||'—')}</td></tr>
          </table>

          ${linkedDirs.length ? `
            <div style="font-weight:700;font-size:11pt;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Faculty Instructions &amp; Directives</div>
            <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px">
              <thead style="background:#f3f4f6"><tr>
                <th style="padding:5px 8px;text-align:left;border:1px solid #e5e7eb">ID</th>
                <th style="padding:5px 8px;text-align:left;border:1px solid #e5e7eb">Instruction</th>
                <th style="padding:5px 8px;text-align:left;border:1px solid #e5e7eb">Assigned</th>
                <th style="padding:5px 8px;text-align:left;border:1px solid #e5e7eb">Status</th>
              </tr></thead>
              <tbody>${linkedDirs.map(d => `<tr>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace;font-size:9.5pt">${UI.esc(d.directiveId||'—')}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(d.instruction||'—')}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(d.assignedTo||'—')}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(d.status||'—')}</td>
              </tr>`).join('')}</tbody>
            </table>` : ''}

          ${discussions.length ? `
            <div style="font-weight:700;font-size:11pt;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Discussion Timeline</div>
            ${discussions.map((disc, di) => {
              const discAtts = atts.filter(a => a.discussionId === disc.id);
              return `<div style="margin-bottom:16px;padding:12px;background:#f9fafb;border-left:3px solid #2563eb;border-radius:0 4px 4px 0">
                <div style="font-weight:700;font-size:10.5pt;margin-bottom:4px">${di+1}. ${UI.esc(disc.topic||'Discussion')}</div>
                ${disc.speaker ? `<div style="font-size:9pt;color:#6b7280;margin-bottom:6px">🗣 ${UI.esc(disc.speaker)}${disc.discussionTime?' · ⏱ '+UI.esc(disc.discussionTime):''}</div>` : ''}
                <div style="font-size:10pt;margin-bottom:8px;white-space:pre-line">${UI.esc(disc.notes||'—')}</div>
                ${disc.facultyInstructions ? `<div style="margin:6px 0;padding:6px 10px;background:#fffbeb;border-left:3px solid #d97706"><strong style="font-size:9pt">🎓 Faculty Instruction:</strong><br>${UI.esc(disc.facultyInstructions)}</div>` : ''}
                ${disc.decisions ? `<div style="margin:6px 0;padding:6px 10px;background:#f0fdf4;border-left:3px solid #16a34a"><strong style="font-size:9pt">⚖ Decision:</strong><br>${UI.esc(disc.decisions)}</div>` : ''}
                ${disc.followUpActions ? `<div style="margin:6px 0;padding:6px 10px;background:#eff6ff;border-left:3px solid #2563eb"><strong style="font-size:9pt">📋 Follow-up:</strong><br>${UI.esc(disc.followUpActions)}</div>` : ''}
                ${discAtts.length ? `<div style="margin-top:8px">
                  <div style="font-size:9pt;font-weight:700;color:#374151;margin-bottom:6px">📎 Attached References (${discAtts.length}):</div>
                  <div style="display:flex;flex-wrap:wrap;gap:10px">
                    ${discAtts.map(a => {
                      const isPdf = a.mimeType === 'application/pdf';
                      return isPdf
                        ? `<div style="font-size:9pt;background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;padding:6px 10px">📄 ${UI.esc(a.filename)}<br><em style="color:#6b7280">${UI.esc(a.caption||'')}</em></div>`
                        : `<div style="text-align:center;max-width:160px">
                            <img src="${UI.esc(a.url)}" style="width:150px;height:100px;object-fit:cover;border:1px solid #d1d5db;border-radius:3px;display:block" alt="${UI.esc(a.caption||a.filename)}">
                            <div style="font-size:8.5pt;color:#374151;margin-top:4px;font-weight:600">${UI.esc(a.caption||a.filename)}</div>
                            ${a.uploadedBy ? `<div style="font-size:8pt;color:#6b7280">👤 ${UI.esc(a.uploadedBy)}</div>` : ''}
                          </div>`;
                    }).join('')}
                  </div>
                </div>` : ''}
              </div>`;
            }).join('')}` : ''}

          ${workItems.length ? `
            <div style="font-weight:700;font-size:11pt;margin:12px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Work Completed</div>
            <ul style="margin:0 0 12px 20px;font-size:10pt">${workItems.map(w => `<li>${UI.esc(w.title||'')} <span style="color:#6b7280">[${UI.esc(w.member||'?')}]</span></li>`).join('')}</ul>` : ''}

          ${actionItems.length ? `
            <div style="font-weight:700;font-size:11pt;margin:12px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Action Items</div>
            <table style="width:100%;border-collapse:collapse;font-size:10pt">
              <thead style="background:#f3f4f6"><tr>
                <th style="padding:4px 8px;text-align:left;border:1px solid #e5e7eb">Task</th>
                <th style="padding:4px 8px;text-align:left;border:1px solid #e5e7eb">Assigned To</th>
                <th style="padding:4px 8px;text-align:left;border:1px solid #e5e7eb">Deadline</th>
                <th style="padding:4px 8px;text-align:left;border:1px solid #e5e7eb">Status</th>
              </tr></thead>
              <tbody>${actionItems.map(a => `<tr>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(a.task||'—')}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(a.assignedTo||'—')}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.fmtDateRaw(a.deadline)}</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb">${UI.esc(a.status||'—')}</td>
              </tr>`).join('')}</tbody>
            </table>` : ''}

          ${(atts.length - atts.filter(a => a.discussionId).length) > 0 ? `
            <div style="font-weight:700;font-size:11pt;margin:14px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">General Meeting Attachments</div>
            <div style="display:flex;flex-wrap:wrap;gap:10px">
              ${atts.filter(a => !a.discussionId).map(a => {
                const isPdf = a.mimeType === 'application/pdf';
                return isPdf
                  ? `<div style="font-size:9pt;background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;padding:6px 10px">📄 ${UI.esc(a.filename)}<br><em style="color:#6b7280">${UI.esc(a.caption||'')}</em></div>`
                  : `<div style="text-align:center;max-width:160px">
                      <img src="${UI.esc(a.url)}" style="width:150px;height:100px;object-fit:cover;border:1px solid #d1d5db;border-radius:3px;display:block" alt="${UI.esc(a.caption||a.filename)}">
                      <div style="font-size:8.5pt;color:#374151;margin-top:4px;font-weight:600">${UI.esc(a.caption||a.filename)}</div>
                    </div>`;
              }).join('')}
            </div>` : ''}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

window.printMeetingReport = function () {
  const container = document.getElementById('mrpt-preview-container');
  if (!container || !container.innerHTML.trim()) {
    UI.toast('Generate the report first.', 'warn');
    return;
  }
  const win = window.open('', '_blank', 'width=960,height=800');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Meeting Report</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#111;font-size:11pt}
      img{max-width:150px;height:100px;object-fit:cover;border:1px solid #d1d5db;border-radius:3px}
      @media print{@page{margin:16mm;size:A4}}
    </style>
    </head><body>${container.innerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
};

/* ════════════════════════════════════════════════════════════
   TRACEABILITY: viewTaskTrace, viewDecisionTrace
   ════════════════════════════════════════════════════════════ */

window.viewTaskTrace = function (taskId) {
  const task = DB.Tasks.list().find(t => t.taskId === taskId || t.id === taskId);
  if (!task) { UI.toast('Task not found: ' + taskId, 'warn'); return; }
  viewMember(task.assignedTo || '');
  UI.navigate('contributions', false);
};

window.viewDecisionTrace = function (decId) {
  UI.navigate('decisions', false);
  setTimeout(() => {
    const dec = DB.Decisions.list().find(d => d.decisionId === decId || d.id === decId);
    if (dec) {
      const el = document.getElementById('decisions-content');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, 300);
};

/* ════════════════════════════════════════════════════════════
   PAGE: SEARCH ARCHIVE
   render_search_archive, openSearchArchive
   ════════════════════════════════════════════════════════════ */

window.render_search_archive = function () {
  const el = document.getElementById('search-archive-content');
  if (!el) return;
  el.innerHTML = `
    <div class="card mb-4">
      <div class="card-header">
        <div class="card-title">Search Meeting Discussions &amp; Documentation</div>
        <div class="card-sub">Keyword search across all meeting notes, faculty instructions, decisions, and attachment captions</div>
      </div>
      <div class="card-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input type="text" id="arc-q" class="fc" style="flex:2;min-width:200px" placeholder="Search topics, notes, faculty instructions, decisions…" onkeydown="if(event.key==='Enter')runDiscussionSearch()">
          <input type="date" id="arc-from" class="fc" style="width:140px">
          <input type="date" id="arc-to" class="fc" style="width:140px">
          <input type="text" id="arc-speaker" class="fc" style="width:140px" placeholder="Speaker / member…">
          <button class="btn btn-primary" onclick="runDiscussionSearch()">Search</button>
          <button class="btn btn-secondary" onclick="runDiscussionSearch(true)">Browse All</button>
        </div>
        <div id="arc-results"></div>
      </div>
    </div>`;
};

window.runDiscussionSearch = async function (browseAll) {
  const q       = browseAll ? '' : (document.getElementById('arc-q')?.value || '').trim();
  const from    = document.getElementById('arc-from')?.value || '';
  const to      = document.getElementById('arc-to')?.value   || '';
  const speaker = document.getElementById('arc-speaker')?.value || '';

  const el = document.getElementById('arc-results');
  if (!el) return;
  el.innerHTML = '<div class="t-sm t-muted">Searching…</div>';

  try {
    const results = await DB.MeetingDiscussions.search({ query: q, from, to, speaker });

    if (!results.length) {
      el.innerHTML = q
        ? `<div class="empty-state" style="padding:30px"><div class="empty-title">No results found for "${UI.esc(q)}"</div><div class="empty-desc">Try a different keyword, or click Browse All to see all discussions.</div></div>`
        : `<div class="empty-state" style="padding:30px"><div class="empty-title">No discussions recorded yet</div><div class="empty-desc">Record detailed discussion notes in the Meeting Register to build the project archive.</div></div>`;
      return;
    }

    const meetingsMap = {};
    DB.Meetings.list().forEach(m => { meetingsMap[m.id] = m; });

    el.innerHTML = `<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">${results.length} result${results.length!==1?'s':''} found${q?' for "'+UI.esc(q)+'"':''}</div>` +
      results.map(r => {
        // Backend returns flat object with meeting fields merged; local search returns {discussion, meeting, attachments}
        const disc  = r.discussion || r;
        const mtg   = r.meeting || meetingsMap[disc.meetingId] || meetingsMap[disc.meeting_id];
        const atts  = r.attachments || DB.MeetingAttachments.list().filter(a => a.discussionId === disc.id);
        const mtgNum  = mtg?.number || r.meeting_number || '?';
        const mtgTitle = mtg?.title || r.meeting_title || ('Meeting ' + mtgNum);
        const mtgDate  = mtg?.date || r.meeting_date || '';

        const noteSnippet = (() => {
          const raw = disc.notes || '';
          if (!q) return raw.slice(0, 120) + (raw.length > 120 ? '…' : '');
          const idx = raw.toLowerCase().indexOf(q.toLowerCase());
          if (idx === -1) return raw.slice(0, 120) + (raw.length > 120 ? '…' : '');
          const start = Math.max(0, idx - 40);
          const end   = Math.min(raw.length, idx + q.length + 80);
          return (start > 0 ? '…' : '') + raw.slice(start, end) + (end < raw.length ? '…' : '');
        })();

        return `<div class="card mb-3" style="cursor:pointer" onclick="jumpToDiscussion('${UI.esc(disc.meetingId||disc.meeting_id||'')}','${UI.esc(disc.id)}')">
          <div class="card-header" style="padding:8px 14px">
            <div style="display:flex;align-items:center;gap:8px;flex:1">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${mtgNum}</div>
              <div>
                <div style="font-weight:600;font-size:12px">${UI.esc(mtgTitle)}</div>
                <div style="font-size:10px;color:var(--text-3)">${UI.fmtDateRaw(mtgDate)}</div>
              </div>
              <span class="cat-chip" style="margin-left:8px">${UI.esc(disc.topic||'Discussion')}</span>
              ${disc.speaker ? `<span style="font-size:10px;color:var(--text-3)">🗣 ${UI.esc(disc.speaker)}</span>` : ''}
            </div>
            ${atts.length ? `<span class="cat-chip">📎 ${atts.length} attachment${atts.length!==1?'s':''}</span>` : ''}
          </div>
          <div class="card-body" style="padding:10px 14px">
            <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">${UI.esc(noteSnippet)}</div>
            ${disc.facultyInstructions ? `<div style="font-size:11px;background:var(--warn-bg);border-left:2px solid var(--warn);padding:4px 8px;margin-bottom:5px;color:#78350f">🎓 ${UI.esc(disc.facultyInstructions.slice(0,100))}${disc.facultyInstructions.length>100?'…':''}</div>` : ''}
            ${disc.decisions ? `<div style="font-size:11px;background:var(--ok-bg);border-left:2px solid var(--ok);padding:4px 8px;margin-bottom:5px;color:#14532d">⚖ ${UI.esc(disc.decisions.slice(0,100))}${disc.decisions.length>100?'…':''}</div>` : ''}
            ${atts.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
              ${atts.slice(0,4).map(a => {
                const isPdf = a.mimeType === 'application/pdf';
                return isPdf
                  ? `<div style="font-size:10px;background:var(--surface-3);border:1px solid var(--border);border-radius:3px;padding:3px 6px">📄 ${UI.esc(a.filename)}</div>`
                  : `<div style="position:relative;width:56px;height:42px;border-radius:3px;overflow:hidden;border:1px solid var(--border)">
                      <img src="${UI.esc(a.url)}" style="width:100%;height:100%;object-fit:cover" alt="${UI.esc(a.caption||a.filename)}" title="${UI.esc(a.caption||a.filename)}">
                    </div>`;
              }).join('')}
              ${atts.length > 4 ? `<div style="font-size:10px;color:var(--text-3);align-self:center">+${atts.length-4} more</div>` : ''}
            </div>` : ''}
          </div>
        </div>`;
      }).join('');
  } catch (err) {
    el.innerHTML = `<div class="callout err"><strong>Search error</strong>${UI.esc(err.message)}</div>`;
    console.error('Discussion search error:', err);
  }
};

window.jumpToDiscussion = function (meetingId, discId) {
  if (!meetingId) return;
  viewMeeting(meetingId);
  UI.navigate('meetings', false);
  // After render, scroll to the specific discussion entry
  setTimeout(() => {
    const node = document.getElementById('disc-item-' + discId);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.style.outline = '2px solid var(--accent)';
      setTimeout(() => { node.style.outline = ''; }, 2000);
    }
  }, 400);
};

window.openSearchArchive = function () {
  UI.navigate('search-archive');
};


/* ════════════════════════════════════════════════════════════
   MEETING DOCUMENTATION — Minutes of Meeting (MoM)
   ════════════════════════════════════════════════════════════ */

/* ── State ─────────────────────────────────────────────────── */
let _momCurrentId    = null;   // ID of the doc being edited/read
let _momPendingImgs  = [];     // [{file, localUrl, caption, tempId}] — queued before save
let _momEditorMode   = 'list'; // 'list' | 'editor' | 'reader'

/* ── View switching ─────────────────────────────────────────── */
function _momShowView(name) {
  _momEditorMode = name;
  document.getElementById('mom-list-view').style.display   = name === 'list'   ? '' : 'none';
  document.getElementById('mom-editor-view').style.display = name === 'editor' ? '' : 'none';
  document.getElementById('mom-reader-view').style.display = name === 'reader' ? '' : 'none';
}

function momBackToList() {
  _momCurrentId   = null;
  _momPendingImgs = [];
  _momShowView('list');
  render_meeting_docs();
}

/* ── Page renderer ──────────────────────────────────────────── */
window.render_meeting_docs = function () {
  _momShowView('list');
  const docs = DB.MoM.list();
  const el   = document.getElementById('mom-list-content');
  if (!el) return;

  if (!docs.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No meeting documents yet</div>
      <div class="empty-desc">After each meeting, create a formal record of what was discussed, decided, and assigned.</div>
      <button class="btn btn-primary no-print" onclick="momOpenEditor()">+ Create First Meeting Document</button>
    </div>`;
    return;
  }

  el.innerHTML = docs.map(doc => {
    const d    = new Date(doc.date || Date.now());
    const day  = isNaN(d) ? '?' : d.getDate();
    const mon  = isNaN(d) ? '---' : d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
    const imgCount = DB.MoM.images(doc.id).length;
    const isPub = doc.status === 'Published';
    return `<div class="mom-card" onclick="momOpenReader('${doc.id}')">
      <div class="mom-card-date">
        <div class="mom-card-day">${day}</div>
        <div class="mom-card-month">${mon}</div>
      </div>
      <div class="mom-card-body">
        <div class="mom-card-title">${UI.esc(doc.title)}</div>
        <div class="mom-card-meta">
          ${doc.participants ? `Participants: ${UI.esc(doc.participants)} · ` : ''}
          ${doc.author ? `By: ${UI.esc(doc.author)}` : ''}
        </div>
        ${doc.objective ? `<div class="mom-card-summary">${UI.esc(doc.objective)}</div>` : ''}
        <div class="mom-card-footer">
          <span class="${isPub ? 'mom-badge-published' : 'mom-badge-draft'}">${isPub ? '✓ Published' : '⊙ Draft'}</span>
          ${imgCount ? `<span class="cat-chip">📸 ${imgCount} image${imgCount>1?'s':''}</span>` : ''}
          <span class="t-xs t-muted">Updated: ${UI.fmtDateRaw(doc.updatedAt)}</span>
          <button class="btn btn-ghost btn-xs no-print" style="margin-left:auto"
            onclick="event.stopPropagation();momOpenEditor('${doc.id}')">✏ Edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

/* ── Open editor (new or existing) ─────────────────────────── */
window.momOpenEditor = function (docId) {
  _momCurrentId   = docId || null;
  _momPendingImgs = [];

  // Reset all fields
  document.getElementById('mom-title').value          = '';
  document.getElementById('mom-date').value           = new Date().toISOString().split('T')[0];
  document.getElementById('mom-participants').value   = '';
  document.getElementById('mom-author').value         = DB.Meta.get().reportingContact || '';
  document.getElementById('mom-objective').value      = '';
  document.getElementById('mom-instructions').value   = '';
  document.getElementById('mom-decisions').value      = '';
  document.getElementById('mom-tasks-assigned').value = '';
  document.getElementById('mom-next-steps').value     = '';
  document.getElementById('mom-notes-editor').innerHTML = '';

  document.getElementById('mom-editor-heading').textContent = docId
    ? 'Edit Meeting Document' : 'New Meeting Document';

  if (docId) {
    const doc = DB.MoM.get(docId);
    if (doc) {
      document.getElementById('mom-title').value          = doc.title          || '';
      document.getElementById('mom-date').value           = doc.date           || '';
      document.getElementById('mom-participants').value   = doc.participants   || '';
      document.getElementById('mom-author').value         = doc.author         || '';
      document.getElementById('mom-objective').value      = doc.objective      || '';
      document.getElementById('mom-instructions').value   = doc.instructions   || '';
      document.getElementById('mom-decisions').value      = doc.decisions      || '';
      document.getElementById('mom-tasks-assigned').value = doc.tasksAssigned  || '';
      document.getElementById('mom-next-steps').value     = doc.nextSteps      || '';
      document.getElementById('mom-notes-editor').innerHTML = doc.notesHtml   || '';
    }
    // Sync and render saved images
    DB.MoM.syncImages(docId).then(() => _momRenderImgStrip());
  } else {
    _momRenderImgStrip();
  }

  _momShowView('editor');
  document.getElementById('mom-title').focus();
};

/* ── Save (Draft or Published) ──────────────────────────────── */
window.momSave = async function (status) {
  const titleEl = document.getElementById('mom-title');
  const dateEl  = document.getElementById('mom-date');

  if (!titleEl.value.trim()) {
    titleEl.classList.add('is-err');
    document.querySelector('#mom-editor-view .f-err').style.display = 'block';
    titleEl.focus();
    return;
  }
  if (!dateEl.value) {
    dateEl.classList.add('is-err');
    dateEl.focus();
    return;
  }
  titleEl.classList.remove('is-err');

  const payload = {
    id:           _momCurrentId || undefined,
    title:        titleEl.value.trim(),
    date:         dateEl.value,
    participants: document.getElementById('mom-participants').value.trim(),
    author:       document.getElementById('mom-author').value.trim(),
    objective:    document.getElementById('mom-objective').value.trim(),
    notesHtml:    document.getElementById('mom-notes-editor').innerHTML.trim(),
    instructions: document.getElementById('mom-instructions').value.trim(),
    decisions:    document.getElementById('mom-decisions').value.trim(),
    tasksAssigned:document.getElementById('mom-tasks-assigned').value.trim(),
    nextSteps:    document.getElementById('mom-next-steps').value.trim(),
    status,
  };

  const btns = document.querySelectorAll('#mom-editor-view .btn');
  btns.forEach(b => { b.disabled = true; });
  UI.toast('Saving…');

  try {
    const saved = await DB.MoM.save(payload);
    _momCurrentId = saved.id;

    // Upload any pending images
    for (const pi of _momPendingImgs) {
      if (pi.file) {
        await DB.MoM.uploadImage(saved.id, pi.file, pi.caption, '', 0)
          .catch(err => console.warn('Image upload failed:', err));
      }
    }
    _momPendingImgs = [];

    UI.toast(status === 'Published' ? 'Meeting notes published ✓' : 'Draft saved', 'ok');

    if (status === 'Published') {
      // Switch straight to the reader so admin can see the final result
      momOpenReader(saved.id);
    } else {
      _momShowView('editor'); // stay in editor; heading updates
      document.getElementById('mom-editor-heading').textContent = 'Edit Meeting Document';
      _momRenderImgStrip();
    }
  } catch (err) {
    UI.toast('Save failed: ' + err.message, 'err');
    console.error(err);
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
};

/* ── Open reader view ───────────────────────────────────────── */
window.momOpenReader = async function (docId) {
  _momCurrentId = docId;
  // Sync from server in background; show local immediately
  DB.MoM.syncImages(docId).catch(() => {});
  _momRenderReader(docId);
  _momShowView('reader');
};

function _momRenderReader(docId) {
  const doc  = DB.MoM.get(docId);
  const imgs = DB.MoM.images(docId);
  const el   = document.getElementById('mom-reading-content');
  if (!el) return;
  if (!doc) { el.innerHTML = '<p>Document not found.</p>'; return; }

  const meta     = DB.Meta.get();
  const isPub    = doc.status === 'Published';
  const genDate  = new Date().toLocaleString('en-GB');

  // Build sections only when content exists
  function section(heading, content) {
    if (!content || !content.trim()) return '';
    return `<div class="mom-rv-section">
      <h2>${heading}</h2>
      <div class="mom-rv-content" style="white-space:pre-line">${UI.esc(content)}</div>
    </div>`;
  }

  const imagesHtml = imgs.length ? `
    <div class="mom-rv-section">
      <h2>Meeting Photos &amp; Diagrams</h2>
      <div class="mom-rv-images">
        ${imgs.map(img => `
          <div class="mom-rv-img-wrap">
            <img src="${UI.esc(img.url)}" alt="${UI.esc(img.caption || img.filename)}"
                 onclick="momLightbox('${UI.esc(img.url)}', '${UI.esc(img.caption||img.filename)}')"
                 style="cursor:zoom-in"
                 onerror="this.style.opacity='.3'">
            ${img.caption ? `<div class="mom-rv-img-caption">${UI.esc(img.caption)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="mom-rv-masthead">
      <div class="mom-rv-project">${UI.esc(meta.projectName || 'Search Engine Project')} — Minutes of Meeting</div>
      <div class="mom-rv-title">${UI.esc(doc.title)}</div>
      <div class="mom-rv-meta">
        <span>📅 ${UI.fmtDateRaw(doc.date)}</span>
        ${doc.participants ? `<span>👥 ${UI.esc(doc.participants)}</span>` : ''}
        ${doc.objective    ? `<span>🎯 ${UI.esc(doc.objective)}</span>`    : ''}
        ${doc.author       ? `<span>✍ Prepared by: ${UI.esc(doc.author)}</span>` : ''}
      </div>
      ${!isPub ? `<div style="margin-top:10px;padding:5px 10px;background:var(--warn-bg);border:1px solid var(--warn-bd);border-radius:3px;font-size:9.5pt;color:var(--warn);display:inline-block">⊙ Draft — not yet published</div>` : ''}
    </div>

    ${doc.notesHtml
      ? `<div class="mom-rv-section">
           <h2>Discussion Notes</h2>
           <div class="mom-rv-content">${doc.notesHtml}</div>
         </div>`
      : ''}

    ${section('Instructions Given by Faculty', doc.instructions)}
    ${section('Decisions Made', doc.decisions)}
    ${section('Tasks Assigned', doc.tasksAssigned)}
    ${section('Next Steps &amp; Pending Questions', doc.nextSteps)}
    ${imagesHtml}

    <div class="mom-rv-footer">
      ${meta.institution ? UI.esc(meta.institution) + ' · ' : ''}
      ${isPub ? 'Published' : 'Draft'} · Last updated: ${UI.fmtDateRaw(doc.updatedAt)} · Generated: ${genDate}
    </div>`;
}

/* ── Edit button from reader ────────────────────────────────── */
window.momEditCurrent = function () {
  if (_momCurrentId) momOpenEditor(_momCurrentId);
};

/* ── Delete ─────────────────────────────────────────────────── */
window.momDeleteCurrent = async function () {
  if (!_momCurrentId) return;
  const doc = DB.MoM.get(_momCurrentId);
  const ok = await UI.confirm(
    `Delete "${doc?.title || 'this document'}"? This will permanently remove the document and all its images.`,
    'Delete Meeting Document?'
  );
  if (!ok) return;
  await DB.MoM.remove(_momCurrentId);
  UI.toast('Document deleted');
  momBackToList();
};

/* ── Print / PDF ────────────────────────────────────────────── */
window.momPrint = function () {
  const content = document.getElementById('mom-reading-content');
  if (!content) return;
  const win = window.open('', '_blank', 'width=900,height=800');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Meeting Minutes</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #111; font-size: 11pt; line-height: 1.7; }
      .mom-rv-masthead { border-bottom: 2px solid #1e2332; padding-bottom: 14px; margin-bottom: 22px; }
      .mom-rv-project  { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 4px; }
      .mom-rv-title    { font-size: 18pt; font-weight: 700; color: #1e2332; }
      .mom-rv-meta     { font-size: 9.5pt; color: #6b7280; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 14px; }
      .mom-rv-section  { margin-bottom: 20px; }
      .mom-rv-section h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #1e2332; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; }
      .mom-rv-content  { font-size: 11pt; white-space: pre-line; }
      .mom-rv-content h2 { font-size: 13pt; font-weight: 700; margin: 14px 0 5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
      .mom-rv-content h3 { font-size: 11pt; font-weight: 600; margin: 10px 0 4px; }
      .mom-rv-content ul, .mom-rv-content ol { margin: 4px 0 8px 22px; }
      .mom-rv-content li { margin-bottom: 3px; }
      .mom-rv-content blockquote { border-left: 3px solid #2563eb; padding: 5px 10px; background: #eff6ff; margin: 6px 0; font-style: italic; }
      .mom-rv-images   { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
      .mom-rv-img-wrap { text-align: center; page-break-inside: avoid; }
      .mom-rv-img-wrap img { max-width: 280px; width: 100%; border: 1px solid #d1d5db; border-radius: 3px; display: block; }
      .mom-rv-img-caption { font-size: 8.5pt; color: #6b7280; margin-top: 4px; font-style: italic; }
      .mom-rv-footer   { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; text-align: right; }
      @page { margin: 18mm; size: A4; }
      @media print { body { padding: 0; } }
    </style></head>
    <body>${content.innerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
};

/* ── Lightbox for image click ───────────────────────────────── */
window.momLightbox = function (url, caption) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <img src="${UI.esc(url)}" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,.6)" alt="${UI.esc(caption)}">
    ${caption ? `<div style="margin-top:14px;font-size:13px;color:#e2e8f0;max-width:600px;text-align:center">${UI.esc(caption)}</div>` : ''}
    <div style="position:absolute;top:16px;right:20px;color:#fff;font-size:22px;cursor:pointer" onclick="this.parentElement.remove()">×</div>`;
  document.body.appendChild(overlay);
};

/* ── Rich-text formatting commands ──────────────────────────── */
window.momFmt = function (cmd) {
  document.getElementById('mom-notes-editor').focus();
  document.execCommand(cmd, false, null);
};
window.momFmtBlock = function (tag) {
  document.getElementById('mom-notes-editor').focus();
  if (tag === 'BLOCKQUOTE') {
    document.execCommand('formatBlock', false, 'blockquote');
  } else {
    document.execCommand('formatBlock', false, tag);
  }
};

/* ── Image handling ─────────────────────────────────────────── */
window.momHandleDrop = function (e) {
  e.preventDefault();
  document.getElementById('mom-dropzone').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) momHandleFiles(files);
};

window.momHandleFiles = async function (fileListOrArr) {
  const files = Array.from(fileListOrArr);
  const ALLOWED = ['image/png','image/jpeg','image/jpg','image/webp'];
  const MAX = 15 * 1024 * 1024;
  const statusEl = document.getElementById('mom-upload-status');

  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      UI.toast(`${file.name}: unsupported type — use PNG, JPG, or WEBP`, 'warn');
      continue;
    }
    if (file.size > MAX) {
      UI.toast(`${file.name}: exceeds 15MB limit`, 'warn');
      continue;
    }
    // Show local preview immediately
    const localUrl = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    _momPendingImgs.push({ file, localUrl, caption: '', tempId });
    if (statusEl) statusEl.textContent = `${_momPendingImgs.length} image(s) queued — will upload when you save`;
  }
  _momRenderImgStrip();
  // Reset file input so the same file can be selected again
  const inp = document.getElementById('mom-file-input');
  if (inp) inp.value = '';
};

function _momRenderImgStrip() {
  const strip = document.getElementById('mom-img-strip');
  if (!strip) return;

  // Saved images (already on server)
  const savedImgs = _momCurrentId ? DB.MoM.images(_momCurrentId) : [];
  // Pending (local only)
  const pendingImgs = _momPendingImgs;

  let html = '';

  savedImgs.forEach(img => {
    html += `<div class="mom-img-card" title="${UI.esc(img.caption||img.filename)}">
      <img src="${UI.esc(img.url)}" alt="${UI.esc(img.caption||img.filename)}"
           onclick="momLightbox('${UI.esc(img.url)}','${UI.esc(img.caption||img.filename)}')"
           style="cursor:zoom-in">
      <div class="mom-img-caption">${UI.esc(img.caption || img.filename)}</div>
      <button class="mom-img-del" onclick="momRemoveSavedImg('${img.id}')" title="Remove">×</button>
      <button class="mom-img-edit-cap" onclick="momEditImgCaption('${img.id}')" title="Edit caption">✏</button>
    </div>`;
  });

  pendingImgs.forEach(pi => {
    html += `<div class="mom-img-card" title="${UI.esc(pi.file.name)}">
      <img src="${UI.esc(pi.localUrl)}" alt="${UI.esc(pi.file.name)}" style="cursor:zoom-in"
           onclick="momLightbox('${UI.esc(pi.localUrl)}','${UI.esc(pi.caption||pi.file.name)}')">
      <div class="mom-img-caption">${UI.esc(pi.caption || pi.file.name)}</div>
      <button class="mom-img-del" onclick="momRemovePendingImg('${pi.tempId}')" title="Remove">×</button>
      <button class="mom-img-edit-cap" onclick="momEditPendingCaption('${pi.tempId}')" title="Edit caption">✏</button>
    </div>`;
  });

  html += `<button class="mom-img-add-btn no-print" onclick="document.getElementById('mom-file-input').click()" title="Add more images">
    <span style="font-size:20px">+</span>
    <span>Add image</span>
  </button>`;

  strip.innerHTML = html;
}

window.momRemoveSavedImg = async function (imgId) {
  if (!await UI.confirm('Remove this image from the document?', 'Remove Image?')) return;
  await DB.MoM.removeImage(imgId);
  _momRenderImgStrip();
  UI.toast('Image removed');
};
window.momRemovePendingImg = function (tempId) {
  _momPendingImgs = _momPendingImgs.filter(p => p.tempId !== tempId);
  _momRenderImgStrip();
};
window.momEditImgCaption = async function (imgId) {
  const img = DB.MoM.images(_momCurrentId).find(i => i.id === imgId);
  const newCap = prompt('Edit caption:', img?.caption || '');
  if (newCap === null) return;
  await DB.MoM.updateImageCaption(imgId, newCap.trim());
  _momRenderImgStrip();
};
window.momEditPendingCaption = function (tempId) {
  const pi = _momPendingImgs.find(p => p.tempId === tempId);
  if (!pi) return;
  const newCap = prompt('Edit caption:', pi.caption || '');
  if (newCap === null) return;
  pi.caption = newCap.trim();
  _momRenderImgStrip();
};
