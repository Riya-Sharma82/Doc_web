/* =============================================================
   GOVERNANCE PORTAL — UI LAYER  v2
   Navigation, modals, toasts, confirm, helpers, badge renderers,
   traceability chain, form utilities, search/filter.
   ============================================================= */
'use strict';

const UI = (() => {

  /* ── Navigation ──────────────────────────────────────────── */
  let _current = 'overview';
  const _stack = [];

  function navigate(pageId, push = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));

    const pg = document.getElementById('page-' + pageId);
    if (!pg) { console.warn('Page not found:', pageId); return; }
    pg.classList.add('active');

    const nav = document.querySelector(`.sb-item[data-page="${pageId}"]`);
    if (nav) nav.classList.add('active');

    const title = nav?.querySelector('.sb-label')?.textContent || pageId;
    const tb = document.getElementById('tb-section');
    if (tb) tb.textContent = title;

    if (push) _stack.push(_current);
    _current = pageId;

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');
    // Scroll to top
    document.getElementById('main-content')?.scrollTo?.(0, 0);
    window.scrollTo?.(0, 0);

    // Trigger render function — convert hyphens to underscores
    const fn = window['render_' + pageId.replace(/-/g,'_')];
    if (typeof fn === 'function') fn();
  }

  function goBack() {
    const prev = _stack.pop();
    if (prev) navigate(prev, false);
  }

  function currentPage() { return _current; }

  /* ── Toast ───────────────────────────────────────────────── */
  function toast(msg, type = '', dur = 3000) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, dur);
  }

  /* ── Confirm dialog ──────────────────────────────────────── */
  function confirm(msg, title = 'Confirm Action') {
    return new Promise(resolve => {
      const ov = document.getElementById('confirm-overlay');
      document.getElementById('confirm-title').textContent   = title;
      document.getElementById('confirm-message').textContent = msg;
      const ok  = document.getElementById('confirm-ok');
      const can = document.getElementById('confirm-cancel');
      const yes = () => { close(); resolve(true);  };
      const no  = () => { close(); resolve(false); };
      function close() {
        ov.classList.remove('open');
        ok.removeEventListener('click', yes);
        can.removeEventListener('click', no);
      }
      ok.addEventListener('click', yes);
      can.addEventListener('click', no);
      ov.classList.add('open');
    });
  }

  /* ── Modals ──────────────────────────────────────────────── */
  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
  function closeAll()     { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')); }

  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  /* ── HTML escaping ───────────────────────────────────────── */
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  /* ── Date formatting ─────────────────────────────────────── */
  function fmtDate(iso) {
    if (!iso) return '<span class="nr">—</span>';
    try {
      return new Date(iso).toLocaleDateString('en-GB',
        { day:'2-digit', month:'short', year:'numeric' });
    } catch { return esc(iso); }
  }
  function fmtDateTime(iso) {
    if (!iso) return '<span class="nr">—</span>';
    try {
      return new Date(iso).toLocaleString('en-GB',
        { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return esc(iso); }
  }
  function fmtDateRaw(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return iso; }
  }

  /* ── Avatar ──────────────────────────────────────────────── */
  const _AV_COLORS = ['#2563eb','#7c3aed','#0891b2','#d97706','#16a34a','#db2777','#ea580c','#0d9488'];
  function avatarColor(name) {
    let h = 0;
    for (let i=0; i<(name||'').length; i++) h = name.charCodeAt(i) + ((h<<5)-h);
    return _AV_COLORS[Math.abs(h) % _AV_COLORS.length];
  }
  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  }
  function avatar(name, size=32) {
    return `<div class="mbr-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.35)}px;background:${avatarColor(name)}">${esc(initials(name))}</div>`;
  }

  /* ── Status / priority / tier badges ─────────────────────── */
  const _STATUS_CLS = {
    'Not Started':            's-not-started',
    'In Progress':            's-in-progress',
    'Completed':              's-completed',
    'Verified':               's-verified',
    'Completed and Verified': 's-verified',
    'Blocked':                's-blocked',
    'Submitted for Review':   's-review',
    'Awaiting Review':        's-review',
    'Changes Requested':      's-changes',
    'Draft':                  's-draft',
    'Reviewed':               's-reviewed',
    'Finalized':              's-finalized',
    'Planned':                's-planned',
    'Open':                   's-in-progress',
    'Investigating':          's-review',
    'Resolved':               's-resolved',
    'Closed':                 's-not-started',
    'Pending':                's-pending',
    'Under Review':           's-review',
    'Approved':               's-completed',
    'Implemented':            's-verified',
    'Rejected':               's-blocked',
    'Deferred':               's-pending',
    'Reverted':               's-blocked',
  };
  const _PRIORITY_CLS = {
    Critical: 'p-critical', High: 'p-high', Medium: 'p-medium', Low: 'p-low',
  };
  const _TIER_CLS = {
    'Assigned':      'tier-assigned',
    'Self-Reported': 'tier-self',
    'Demonstrated':  'tier-demo',
    'Verified':      'tier-verified',
  };

  function statusBadge(s)   { return `<span class="badge ${_STATUS_CLS[s]||'s-not-started'}">${esc(s||'—')}</span>`; }
  function priorityBadge(p) { return `<span class="badge ${_PRIORITY_CLS[p]||'p-low'}">${esc(p||'—')}</span>`; }
  function tierBadge(t)     { return `<span class="badge ${_TIER_CLS[t]||'tier-assigned'}">${esc(t||'—')}</span>`; }
  function verifyBadge(method) {
    if (!method) return `<span class="unverified-badge">⚠ Unverified</span>`;
    return `<span class="verify-badge">✓ ${esc(method)}</span>`;
  }
  function idTag(id) { return `<span class="id-tag">${esc(id||'—')}</span>`; }
  function catChip(c) { return `<span class="cat-chip">${esc(c||'—')}</span>`; }

  function fmtFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* ── Evidence thumbnail & proof indicator ────────────────── */
  function evidenceThumb(taskId, opts = {}) {
    const list = (typeof DB !== 'undefined' && DB.Evidence)
      ? DB.Evidence.list(taskId)
      : [];

    if (!list || !list.length) {
      if (opts.badgeOnly) return '<span class="nr t-xs">No proof</span>';
      return `<button class="btn-attach-proof" onclick="openEvidenceModal('${esc(taskId)}', 0, true)" title="Upload proof or screenshot for this task">
        <span class="icon">📷</span>
        <span>+ Attach Proof</span>
      </button>`;
    }

    const first = list[0];
    const latest = list[list.length - 1];
    const count = list.length;
    const latestDate = fmtDateRaw(latest.uploadedAt || latest.uploaded_at);

    return `
      <div class="evidence-cell-wrap" onclick="openEvidenceModal('${esc(taskId)}', 0)" title="Click to view ${count} evidence attachment${count > 1 ? 's' : ''}">
        <div class="evidence-thumb-container">
          <img src="${esc(first.url || first.file_url)}" class="evidence-thumb-img" alt="Proof thumbnail" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'36\\' height=\\'36\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2394a3b8\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg>'">
          ${count > 1 ? `<span class="evidence-thumb-badge">+${count - 1}</span>` : ''}
        </div>
        <div class="evidence-info">
          <span class="evidence-attached-tag">✓ Proof attached (${count})</span>
          <span class="evidence-upload-date">${latestDate}</span>
        </div>
      </div>
    `;
  }

  /* ── Meeting attachment card & thumbnail ─────────────────── */
  function meetingAttachmentThumb(att, opts = {}) {
    if (!att) return '';
    const isPdf = att.mimeType === 'application/pdf' || (att.filename && att.filename.toLowerCase().endsWith('.pdf'));
    const sizeStr = fmtFileSize(att.sizeBytes);
    const dateStr = fmtDateTime(att.uploadedAt);
    const clickAttr = opts.noClick ? '' : `onclick="openMeetingMediaModal('${esc(att.id)}', '${esc(att.meetingId)}')"`;

    return `
      <div class="mtg-media-card" ${clickAttr} title="Click to preview ${esc(att.filename)}">
        <div class="mtg-media-thumb-wrap">
          ${isPdf
            ? `<div class="mtg-media-pdf-box">
                <span class="mtg-pdf-icon">📄 PDF</span>
                <span class="mtg-pdf-title" title="${esc(att.filename)}">${esc(att.filename)}</span>
               </div>`
            : `<img src="${esc(att.url)}" class="mtg-media-img" alt="${esc(att.caption || att.filename)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2394a3b8\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg>'">`
          }
        </div>
        <div class="mtg-media-body">
          <div class="mtg-media-caption" title="${esc(att.caption || att.filename)}">
            ${esc(att.caption || att.filename)}
          </div>
          <div class="mtg-media-sub">
            <span class="mtg-media-fname" title="${esc(att.filename)}">${esc(att.filename)}</span>
            <span class="mtg-media-size">${sizeStr}</span>
          </div>
          <div class="mtg-media-meta">
            ${att.uploadedBy ? `<span class="mtg-media-uploader">👤 ${esc(att.uploadedBy)}</span>` : ''}
            <span class="mtg-media-date">${dateStr}</span>
          </div>
          <div class="mtg-media-tags">
            ${att.relatedTaskId ? `<span class="id-tag" style="font-size:9px" title="Linked Task">${esc(att.relatedTaskId)}</span>` : ''}
            ${att.relatedDirectiveId ? `<span class="id-tag" style="font-size:9px" title="Linked Directive">${esc(att.relatedDirectiveId)}</span>` : ''}
            ${att.relatedDecisionId ? `<span class="id-tag" style="font-size:9px" title="Linked Decision">${esc(att.relatedDecisionId)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ── Discussion Timeline Node ────────────────────────────── */
  function discussionTimelineNode(disc, index, attachments = [], opts = {}) {
    if (!disc) return '';
    const hasMedia = attachments && attachments.length > 0;
    const orderNum = disc.orderIndex || (index + 1);

    return `
      <div class="disc-timeline-item" id="disc-item-${esc(disc.id)}">
        <div class="disc-timeline-marker">
          <span class="disc-order-num">${orderNum}</span>
          <div class="disc-timeline-line"></div>
        </div>
        <div class="disc-timeline-card">
          <div class="disc-timeline-header">
            <div class="disc-header-main">
              <span class="disc-topic-title">${esc(disc.topic || 'Discussion Entry')}</span>
              ${disc.discussionTime ? `<span class="disc-time-badge">⏱ ${esc(disc.discussionTime)}</span>` : ''}
              ${disc.speaker ? `<span class="disc-speaker-badge">🗣 ${esc(disc.speaker)}</span>` : ''}
            </div>
            <div class="disc-header-actions no-print">
              <button class="btn btn-ghost btn-xs" onclick="openAttachMediaModal('${esc(disc.meetingId)}', '${esc(disc.id)}')">+ Attach Media</button>
              <button class="btn btn-ghost btn-xs btn-icon" onclick="editDiscussion('${esc(disc.id)}')" title="Edit Notes">✏</button>
              <button class="btn btn-ghost btn-xs btn-icon" onclick="deleteDiscussion('${esc(disc.id)}')" title="Delete Entry">✕</button>
            </div>
          </div>

          <!-- Detailed Discussion Notes -->
          <div class="disc-notes-content">
            ${esc(disc.notes || 'No detailed notes recorded.')}
          </div>

          <!-- Structured Context Callouts -->
          ${disc.facultyInstructions ? `
            <div class="disc-callout disc-callout-directive">
              <div class="disc-callout-title">🎓 Faculty Instruction / Suggestion:</div>
              <div>${esc(disc.facultyInstructions)}</div>
            </div>
          ` : ''}

          ${disc.decisions ? `
            <div class="disc-callout disc-callout-decision">
              <div class="disc-callout-title">⚖ Decision &amp; Rationale:</div>
              <div>${esc(disc.decisions)}</div>
            </div>
          ` : ''}

          ${disc.followUpActions ? `
            <div class="disc-callout disc-callout-action">
              <div class="disc-callout-title">📋 Next Steps &amp; Follow-up Tasks:</div>
              <div>${esc(disc.followUpActions)}</div>
            </div>
          ` : ''}

          <!-- Contextual Media Gallery Attached to this topic -->
          ${hasMedia ? `
            <div class="disc-attached-media-section">
              <div class="disc-media-hdr">
                <span>📎 Attached References &amp; Demonstrations (${attachments.length})</span>
                <span class="t-xs t-muted">Click image for high-res preview</span>
              </div>
              <div class="disc-media-grid">
                ${attachments.map(att => meetingAttachmentThumb(att)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Traceability Links Footer -->
          <div class="disc-timeline-footer">
            <div class="disc-links-row">
              ${disc.relatedDirectiveId ? `<span class="disc-trace-pill" onclick="viewDirectiveTrace('${esc(disc.relatedDirectiveId)}')">🎓 Directive: ${esc(disc.relatedDirectiveId)}</span>` : ''}
              ${disc.relatedTaskId ? `<span class="disc-trace-pill" onclick="viewTaskTrace('${esc(disc.relatedTaskId)}')">✅ Task: ${esc(disc.relatedTaskId)}</span>` : ''}
              ${disc.relatedDecisionId ? `<span class="disc-trace-pill" onclick="viewDecisionTrace('${esc(disc.relatedDecisionId)}')">⚖ Decision: ${esc(disc.relatedDecisionId)}</span>` : ''}
            </div>
            <div class="t-xs t-muted" style="margin-left:auto">
              Recorded: ${fmtDateTime(disc.createdAt)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Traceability chain builder ──────────────────────────── */
  function traceChain(items) {
    // items = [{label, id, page, onclick}]
    if (!items || !items.length) return `<span class="trace-empty">No linked records</span>`;
    return `<div class="trace-chain">${items.map((item, i) => `
      ${i > 0 ? '<span class="trace-arrow">→</span>' : ''}
      <span class="trace-link" ${item.onclick ? `onclick="${esc(item.onclick)}"` : ''}
            title="${esc(item.id)}">${esc(item.label)}</span>
    `).join('')}</div>`;
  }

  /* ── Progress bar ────────────────────────────────────────── */
  function progressBar(pct, cls = '') {
    const p = Math.max(0, Math.min(100, pct));
    return `
      <div class="prog-wrap"><div class="prog-fill ${cls}" style="width:${p}%"></div></div>
      <div class="prog-label"><span>${p}% complete</span><span style="opacity:.6">${p}/100</span></div>`;
  }

  /* ── Section divider ─────────────────────────────────────── */
  function secDiv(title, icon='') {
    return `<div class="sec-div">
      ${icon ? `<span style="font-size:13px">${icon}</span>` : ''}
      <span class="sec-div-title">${esc(title)}</span>
      <div class="sec-div-line"></div>
    </div>`;
  }

  /* ── Key-value grid ──────────────────────────────────────── */
  function kv(label, value, opts={}) {
    const cls  = opts.mono    ? ' mono'         : '';
    const vcls = opts.isHtml  ? ''              : '';
    const disp = opts.isHtml
      ? (value || '<span class="nr">Not recorded</span>')
      : `<span${cls}>${esc(value) || '<span class="nr">Not recorded</span>'}</span>`;
    return `
      <div class="kv-label t-upper">${esc(label)}</div>
      <div class="kv-val${cls}">${disp}</div>`;
  }
  function kvGrid(pairs) {
    return `<div class="kv-grid">${pairs.map(([l,v,o])=>kv(l,v,o||{})).join('')}</div>`;
  }

  /* ── Empty state ─────────────────────────────────────────── */
  function emptyState({ icon='📄', title, desc, btn, btnCb, tplNote }={}) {
    return `<div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${esc(title||'No records yet')}</div>
      <div class="empty-desc">${esc(desc||'')}</div>
      ${btn ? `<button class="btn btn-primary no-print" onclick="${esc(btnCb)}">${esc(btn)}</button>` : ''}
      ${tplNote ? `<div class="empty-tpl mt-4"><strong>📋 Template — complete when data is available</strong>${esc(tplNote)}</div>` : ''}
    </div>`;
  }

  /* ── Form helpers ────────────────────────────────────────── */
  function opts(options, selected, blank='') {
    const blankOpt = blank ? `<option value="">${esc(blank)}</option>` : '';
    return blankOpt + options.map(o => {
      const v = typeof o === 'object' ? o.value : o;
      const l = typeof o === 'object' ? o.label : o;
      return `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(l)}</option>`;
    }).join('');
  }

  function memberOpts(selected) {
    const list = DB.Members.list();
    if (!list.length) return '<option value="">— Add members first —</option>';
    return opts([{value:'',label:'— Select member —'}, ...list.map(m=>({value:m.id,label:m.name}))], selected);
  }

  function meetingOpts(selected) {
    const list = DB.Meetings.list().sort((a,b)=>(a.number||0)-(b.number||0));
    if (!list.length) return '<option value="">— No meetings recorded —</option>';
    return opts([{value:'',label:'— Select meeting —'},
      ...list.map(m=>({value:m.id,label:`Meeting ${m.number||'?'} — ${m.title||fmtDateRaw(m.date)}`}))
    ], selected);
  }

  function directiveOpts(selected) {
    const list = DB.Directives.list().sort((a,b)=>(a.directiveId||'').localeCompare(b.directiveId||''));
    if (!list.length) return '<option value="">— No directives recorded —</option>';
    return opts([{value:'',label:'— Select directive (optional) —'},
      ...list.map(d=>({value:d.id,label:`${d.directiveId} — ${(d.instruction||'').slice(0,60)}`}))
    ], selected);
  }

  function validateForm(form) {
    let ok = true;
    form.querySelectorAll('[required]').forEach(el => {
      const grp = el.closest('.fg');
      const err = grp?.querySelector('.f-err');
      if (!el.value.trim()) {
        el.classList.add('is-err'); if (err) err.style.display='block'; ok=false;
      } else {
        el.classList.remove('is-err'); if (err) err.style.display='none';
      }
    });
    return ok;
  }

  function readForm(form) {
    const d = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type==='checkbox') {
        if (!d[el.name]) d[el.name]=[];
        if (el.checked) d[el.name].push(el.value);
      } else { d[el.name] = el.value; }
    });
    return d;
  }

  /* ── Filter/search utility ───────────────────────────────── */
  function filterList(list, q, fields) {
    if (!q) return list;
    const lq = q.toLowerCase();
    return list.filter(item => fields.some(f => String(item[f]||'').toLowerCase().includes(lq)));
  }

  function inDateRange(dateStr, from, to) {
    if (!from && !to) return true;
    const d = new Date(dateStr||0);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to+'T23:59:59')) return false;
    return true;
  }

  /* ── Member name lookup ──────────────────────────────────── */
  function memberName(id) {
    if (!id) return '<span class="nr">—</span>';
    const m = DB.Members.get(id);
    return m ? esc(m.name) : '<span class="nr">Unknown member</span>';
  }

  function meetingRef(id) {
    if (!id) return '<span class="nr">—</span>';
    const m = DB.Meetings.get(id);
    return m ? `<span class="id-tag">MTG-${String(m.number||'?').padStart(3,'0')}</span> ${esc(m.title||'')}` : '<span class="nr">—</span>';
  }

  function directiveRef(id) {
    if (!id) return '<span class="nr">—</span>';
    const d = DB.Directives.get(id);
    return d ? `${idTag(d.directiveId)} ${esc((d.instruction||'').slice(0,50))}` : '<span class="nr">—</span>';
  }

  /* ── Render a sub-list with empty state ──────────────────── */
  function subList(items, renderFn, emptyMsg, addBtn, addCb) {
    const content = items?.length
      ? items.map(renderFn).join('')
      : `<div class="t-sm t-muted t-italic mb-3">${esc(emptyMsg)}</div>`;
    return `${content}
      <button class="btn btn-sm btn-secondary no-print mt-2" onclick="${addCb}">+ ${esc(addBtn)}</button>`;
  }

  /* ── Detail section shell ────────────────────────────────── */
  function detailSec(title, body, actions='', icon='') {
    return `<div class="detail-sec">
      <div class="detail-sec-hdr">
        <div class="detail-sec-title">${icon?`<span>${icon}</span>`:''}${esc(title)}</div>
        ${actions ? `<div class="flex gap-1 no-print">${actions}</div>` : ''}
      </div>
      <div class="detail-sec-body">${body}</div>
    </div>`;
  }

  /* ── Sort helpers ────────────────────────────────────────── */
  function sortBy(list, field, dir='desc') {
    return [...list].sort((a,b) => {
      const va = a[field]||'', vb = b[field]||'';
      const cmp = typeof va==='number' ? va-vb : String(va).localeCompare(String(vb));
      return dir==='desc' ? -cmp : cmp;
    });
  }

  /* ── Callout helper ──────────────────────────────────────── */
  function callout(type, strong, text) {
    return `<div class="callout ${type}"><strong>${esc(strong)}</strong>${esc(text)}</div>`;
  }

  /* ── Report helpers ──────────────────────────────────────── */
  function rptRow(...cells) {
    return `<tr>${cells.map(c=>`<td>${c==null?'—':c}</td>`).join('')}</tr>`;
  }
  function rptHead(...cells) {
    return `<tr>${cells.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>`;
  }

  return {
    navigate, goBack, currentPage,
    toast, confirm,
    openModal, closeModal, closeAll,
    esc, fmtDate, fmtDateTime, fmtDateRaw,
    avatarColor, initials, avatar,
    statusBadge, priorityBadge, tierBadge, verifyBadge, idTag, catChip,
    traceChain, progressBar, secDiv, kv, kvGrid,
    emptyState, subList, detailSec, callout,
    opts, memberOpts, meetingOpts, directiveOpts,
    validateForm, readForm,
    filterList, inDateRange, sortBy,
    memberName, meetingRef, directiveRef,
    evidenceThumb, fmtFileSize,
    meetingAttachmentThumb, discussionTimelineNode,
    rptRow, rptHead,
  };
})();
