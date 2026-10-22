/* =============================================================
   GOVERNANCE PORTAL — DATA LAYER  v2
   Expanded schema: verification fields, audit log, directive
   traceability, contribution tiers, meeting lifecycle,
   change IDs, acceptance criteria, closure workflow.
   All existing plb_* keys preserved for backward compatibility.
   ============================================================= */
'use strict';

const DB = (() => {

  /* ── Storage keys ────────────────────────────────────────── */
  const K = {
    meta:               'plb_meta',
    meetings:           'plb_meetings',
    members:            'plb_members',
    directives:         'plb_instructions',   // was instructions
    tasks:              'plb_tasks',
    changes:            'plb_tech_changes',   // was techChanges
    decisions:          'plb_research',       // was research
    tests:              'plb_tests',
    issues:             'plb_issues',
    milestones:         'plb_milestones',
    deliverables:       'plb_deliverables',
    auditLog:           'plb_audit_log',
    contribs:           'plb_contributions',
    evidence:           'plb_evidence',
    meetingDiscussions: 'plb_meeting_discussions',
    meetingAttachments: 'plb_meeting_attachments',
  };

  /* ── Backend API base ────────────────────────────────────── */
  const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? ''
    : 'http://localhost:3000';

  /* ── Primitive helpers ───────────────────────────────────── */
  const genId = (pfx) =>
    `${pfx}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const now = () => new Date().toISOString();

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function loadList(key) { return load(key) || []; }
  function saveList(key, arr) { save(key, arr); }

  /* ── Audit log ───────────────────────────────────────────── */
  const AuditLog = {
    append(action, entity, entityId, detail = '') {
      const log = loadList(K.auditLog);
      log.push({ id: genId('aud'), ts: now(), action, entity, entityId, detail });
      // Keep last 500 entries
      if (log.length > 500) log.splice(0, log.length - 500);
      saveList(K.auditLog, log);
    },
    list() { return loadList(K.auditLog); },
    forEntity(entity, entityId) {
      return loadList(K.auditLog).filter(e => e.entity === entity && e.entityId === entityId);
    },
  };

  /* ── Generic CRUD factory ────────────────────────────────── */
  function makeCRUD(key, idPrefix, entityName) {
    return {
      list()    { return loadList(key); },
      get(id)   { return loadList(key).find(r => r.id === id) || null; },
      add(data) {
        const list = loadList(key);
        const rec  = { ...data, id: genId(idPrefix), createdAt: now(), updatedAt: now() };
        list.push(rec);
        saveList(key, list);
        AuditLog.append('CREATE', entityName, rec.id, data.title || data.name || data.question || data.instruction || '');
        return rec;
      },
      update(id, data) {
        const list = loadList(key);
        const idx  = list.findIndex(r => r.id === id);
        if (idx === -1) return null;
        const prev = list[idx];
        list[idx]  = { ...prev, ...data, id, createdAt: prev.createdAt, updatedAt: now() };
        saveList(key, list);
        AuditLog.append('UPDATE', entityName, id, data.status ? `status→${data.status}` : '');
        return list[idx];
      },
      remove(id) {
        const rec  = loadList(key).find(r => r.id === id);
        const list = loadList(key).filter(r => r.id !== id);
        saveList(key, list);
        AuditLog.append('DELETE', entityName, id, rec?.title || rec?.name || '');
      },
      clear() { saveList(key, []); },
    };
  }

  /* ── Domain stores ───────────────────────────────────────── */
  const Meetings     = makeCRUD(K.meetings,     'mtg', 'Meeting');
  const Members      = makeCRUD(K.members,      'mbr', 'Member');
  const Directives   = makeCRUD(K.directives,   'dir', 'Directive');
  const Tasks        = makeCRUD(K.tasks,        'tsk', 'Task');
  const Changes      = makeCRUD(K.changes,      'chg', 'Change');
  const Decisions    = makeCRUD(K.decisions,    'dec', 'Decision');
  const Tests        = makeCRUD(K.tests,        'tst', 'Test');
  const Issues       = makeCRUD(K.issues,       'iss', 'Issue');
  const Milestones   = makeCRUD(K.milestones,   'mls', 'Milestone');
  const Deliverables = makeCRUD(K.deliverables, 'dlv', 'Deliverable');
  const Contribs     = makeCRUD(K.contribs,     'cbt', 'Contribution');

  /* ── Evidence Store & Persistent Backend Integration ─────── */
  const Evidence = {
    list(taskId) {
      const all = loadList(K.evidence);
      if (!taskId) return all;
      return all.filter(e => e.taskId === taskId || e.task_id === taskId);
    },
    get(id) {
      return loadList(K.evidence).find(e => e.id === id) || null;
    },
    addLocal(data) {
      const all = loadList(K.evidence);
      const rec = {
        ...data,
        id: data.id || genId('ev'),
        uploadedAt: data.uploadedAt || data.uploaded_at || now(),
        reviewStatus: data.reviewStatus || data.review_status || 'Pending',
      };
      all.push(rec);
      saveList(K.evidence, all);
      AuditLog.append('ATTACH_PROOF', 'Task', rec.taskId || rec.task_id, rec.filename || 'Proof attachment');
      return rec;
    },
    updateLocal(id, data) {
      const all = loadList(K.evidence);
      const idx = all.findIndex(e => e.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...data, id };
      saveList(K.evidence, all);
      return all[idx];
    },
    removeLocal(id) {
      const rec = loadList(K.evidence).find(e => e.id === id);
      const filtered = loadList(K.evidence).filter(e => e.id !== id);
      saveList(K.evidence, filtered);
      if (rec) AuditLog.append('REMOVE_PROOF', 'Task', rec.taskId || rec.task_id, rec.filename || '');
    },

    // Sync from server database
    async sync(taskId) {
      try {
        const url = taskId
          ? `${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/evidence`
          : `${API_BASE}/api/evidence`;
        const res = await fetch(url);
        if (!res.ok) return Evidence.list(taskId);
        const data = await res.json();
        const serverList = (data.evidence || []).map(normalizeEvidence);

        const currentAll = loadList(K.evidence);
        let merged;
        if (taskId) {
          // Replace records for this task, keep others
          merged = currentAll.filter(e => e.taskId !== taskId && e.task_id !== taskId).concat(serverList);
        } else {
          merged = serverList;
        }
        saveList(K.evidence, merged);
        return Evidence.list(taskId);
      } catch (err) {
        console.warn('Backend sync failed, using cached evidence:', err);
        return Evidence.list(taskId);
      }
    },

    // Upload one or multiple files to persistent backend
    async upload(taskId, file, caption = '', uploadedBy = '') {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', caption);
        formData.append('uploadedBy', uploadedBy);

        const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/evidence`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }

        const resData = await res.json();
        const uploadedRecords = (resData.uploaded || []).map(normalizeEvidence);

        uploadedRecords.forEach(rec => {
          Evidence.addLocal(rec);
        });

        return uploadedRecords;
      } catch (err) {
        console.error('Evidence upload error:', err);
        // Fallback: if server is unreachable, store as base64 in local storage
        if (err.message && err.message.includes('fetch')) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const localRec = Evidence.addLocal({
                taskId,
                filename: file.name,
                stored_filename: file.name,
                url: e.target.result,
                file_url: e.target.result,
                file_path: 'local-storage',
                mime_type: file.type || 'image/png',
                size_bytes: file.size,
                caption,
                uploaded_by: uploadedBy,
                uploaded_at: now(),
                review_status: 'Pending',
              });
              resolve([normalizeEvidence(localRec)]);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        }
        throw err;
      }
    },

    // Replace an existing attachment
    async replace(evidenceId, file, caption = '') {
      const existing = Evidence.get(evidenceId);
      try {
        // Read file as base64 for reliable replace endpoint
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`${API_BASE}/api/evidence/${encodeURIComponent(evidenceId)}/replace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: base64Data,
            filename: file.name,
            caption: caption || existing?.caption || '',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Replace failed with status ${res.status}`);
        }

        const data = await res.json();
        const normalized = normalizeEvidence(data.evidence);
        Evidence.updateLocal(evidenceId, normalized);
        AuditLog.append('REPLACE_PROOF', 'Task', normalized.taskId, `Replaced with ${file.name}`);
        return normalized;
      } catch (err) {
        console.error('Replace error:', err);
        throw err;
      }
    },

    // Delete evidence attachment
    async remove(evidenceId) {
      const rec = Evidence.get(evidenceId);
      Evidence.removeLocal(evidenceId);
      try {
        await fetch(`${API_BASE}/api/evidence/${encodeURIComponent(evidenceId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('Backend delete sync failed:', err);
      }
      return rec;
    },

    // Update caption
    async updateCaption(evidenceId, caption) {
      Evidence.updateLocal(evidenceId, { caption });
      try {
        await fetch(`${API_BASE}/api/evidence/${encodeURIComponent(evidenceId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption }),
        });
      } catch (err) {
        console.warn('Backend patch failed:', err);
      }
    },

    // Faculty verification / review action
    async reviewTask(taskId, status, comment = '', reviewerName = '') {
      // Find matching task record
      const allTasks = Tasks.list();
      const task = allTasks.find(t => t.id === taskId || t.taskId === taskId);
      const taskRecordId = task ? task.id : taskId;

      // Update local task status and review details
      Tasks.update(taskRecordId, {
        status,
        reviewComment: comment,
        reviewedBy: reviewerName,
        reviewedAt: now(),
      });

      // Update local evidence review statuses
      const taskEvidences = Evidence.list(task?.taskId || taskId);
      taskEvidences.forEach(ev => {
        Evidence.updateLocal(ev.id, {
          reviewStatus: status,
          reviewComment: comment,
          reviewedBy: reviewerName,
          reviewedAt: now(),
        });
      });

      AuditLog.append('VERIFY_TASK', 'Task', task?.taskId || taskId, `${status}: ${comment}`);

      // Call backend API
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(task?.taskId || taskId)}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, comment, reviewerName }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.evidence) {
            resData.evidence.map(normalizeEvidence).forEach(e => Evidence.updateLocal(e.id, e));
          }
        }
      } catch (err) {
        console.warn('Backend review sync failed:', err);
      }

      return { status, comment, reviewerName };
    },
  };

  /**
   * Helper to normalize evidence object field names between SQLite and JS
   */
  function normalizeEvidence(raw) {
    if (!raw) return null;
    const url = raw.file_url || raw.url || '';
    // Resolve relative URL to absolute if accessing from file://
    const fullUrl = (url && url.startsWith('/') && API_BASE) ? (API_BASE + url) : url;
    return {
      id: raw.id,
      taskId: raw.task_id || raw.taskId,
      filename: raw.filename,
      storedFilename: raw.stored_filename || raw.storedFilename,
      filePath: raw.file_path || raw.filePath,
      url: fullUrl,
      mimeType: raw.mime_type || raw.mimeType,
      sizeBytes: raw.size_bytes !== undefined ? raw.size_bytes : (raw.sizeBytes || 0),
      caption: raw.caption || '',
      uploadedBy: raw.uploaded_by || raw.uploadedBy || '',
      uploadedAt: raw.uploaded_at || raw.uploadedAt || now(),
      reviewStatus: raw.review_status || raw.reviewStatus || 'Pending',
      reviewComment: raw.review_comment || raw.reviewComment || '',
      reviewedBy: raw.reviewed_by || raw.reviewedBy || '',
      reviewedAt: raw.reviewed_at || raw.reviewedAt || '',
    };
  }

  /* ── Normalizers for Meeting Discussions & Attachments ─── */
  function normalizeDiscussion(raw) {
    if (!raw) return null;
    return {
      id: raw.id,
      meetingId: raw.meeting_id || raw.meetingId,
      topic: raw.topic || '',
      notes: raw.notes || '',
      speaker: raw.speaker || '',
      discussionTime: raw.discussion_time || raw.discussionTime || '',
      decisions: raw.decisions || '',
      facultyInstructions: raw.faculty_instructions || raw.facultyInstructions || '',
      followUpActions: raw.follow_up_actions || raw.followUpActions || '',
      relatedTaskId: raw.related_task_id || raw.relatedTaskId || '',
      relatedDirectiveId: raw.related_directive_id || raw.relatedDirectiveId || '',
      relatedDecisionId: raw.related_decision_id || raw.relatedDecisionId || '',
      orderIndex: raw.order_index !== undefined ? raw.order_index : (raw.orderIndex || 0),
      createdAt: raw.created_at || raw.createdAt || now(),
      updatedAt: raw.updated_at || raw.updatedAt || now(),
    };
  }

  function normalizeMeetingAttachment(raw) {
    if (!raw) return null;
    const url = raw.file_url || raw.url || '';
    const fullUrl = (url && url.startsWith('/') && API_BASE) ? (API_BASE + url) : url;
    return {
      id: raw.id,
      meetingId: raw.meeting_id || raw.meetingId,
      discussionId: raw.discussion_id || raw.discussionId || '',
      filename: raw.filename || '',
      storedFilename: raw.stored_filename || raw.storedFilename || '',
      filePath: raw.file_path || raw.filePath || '',
      url: fullUrl,
      mimeType: raw.mime_type || raw.mimeType || 'image/png',
      sizeBytes: raw.size_bytes !== undefined ? raw.size_bytes : (raw.sizeBytes || 0),
      caption: raw.caption || '',
      uploadedBy: raw.uploaded_by || raw.uploadedBy || '',
      uploadedAt: raw.uploaded_at || raw.uploadedAt || now(),
      relatedTaskId: raw.related_task_id || raw.relatedTaskId || '',
      relatedDirectiveId: raw.related_directive_id || raw.relatedDirectiveId || '',
      relatedDecisionId: raw.related_decision_id || raw.relatedDecisionId || '',
    };
  }

  /* ── Meeting Discussions Store ────────────────────────────── */
  const MeetingDiscussions = {
    list(meetingId) {
      const all = loadList(K.meetingDiscussions).map(normalizeDiscussion);
      if (!meetingId) return all.sort((a,b) => (a.orderIndex - b.orderIndex) || (a.createdAt.localeCompare(b.createdAt)));
      return all
        .filter(d => d.meetingId === meetingId)
        .sort((a,b) => (a.orderIndex - b.orderIndex) || (a.createdAt.localeCompare(b.createdAt)));
    },
    get(id) {
      const rec = loadList(K.meetingDiscussions).find(d => d.id === id);
      return rec ? normalizeDiscussion(rec) : null;
    },
    addLocal(data) {
      const all = loadList(K.meetingDiscussions);
      const normalized = normalizeDiscussion({
        ...data,
        id: data.id || genId('disc'),
        createdAt: data.createdAt || now(),
        updatedAt: data.updatedAt || now(),
        orderIndex: data.orderIndex !== undefined ? data.orderIndex : all.filter(d => (d.meeting_id||d.meetingId) === (data.meeting_id||data.meetingId)).length + 1
      });
      all.push(normalized);
      saveList(K.meetingDiscussions, all);
      AuditLog.append('ADD_DISCUSSION', 'Meeting', normalized.meetingId, normalized.topic || 'Discussion topic');
      return normalized;
    },
    updateLocal(id, data) {
      const all = loadList(K.meetingDiscussions);
      const idx = all.findIndex(d => d.id === id);
      if (idx === -1) return null;
      all[idx] = normalizeDiscussion({ ...all[idx], ...data, id, updatedAt: now() });
      saveList(K.meetingDiscussions, all);
      AuditLog.append('UPDATE_DISCUSSION', 'Meeting', all[idx].meetingId, all[idx].topic || '');
      return all[idx];
    },
    removeLocal(id) {
      const rec = MeetingDiscussions.get(id);
      const filtered = loadList(K.meetingDiscussions).filter(d => d.id !== id);
      saveList(K.meetingDiscussions, filtered);
      if (rec) AuditLog.append('DELETE_DISCUSSION', 'Meeting', rec.meetingId, rec.topic || '');
    },
    async sync(meetingId) {
      try {
        const url = meetingId
          ? `${API_BASE}/api/meetings/${encodeURIComponent(meetingId)}/discussions`
          : `${API_BASE}/api/meetings`;
        if (!meetingId) return MeetingDiscussions.list();
        const res = await fetch(url);
        if (!res.ok) return MeetingDiscussions.list(meetingId);
        const data = await res.json();
        const serverList = (data.discussions || []).map(normalizeDiscussion);
        const currentAll = loadList(K.meetingDiscussions);
        const merged = currentAll.filter(d => (d.meetingId !== meetingId && d.meeting_id !== meetingId)).concat(serverList);
        saveList(K.meetingDiscussions, merged);
        return MeetingDiscussions.list(meetingId);
      } catch (err) {
        console.warn('Meeting discussions sync failed, using cached list:', err);
        return MeetingDiscussions.list(meetingId);
      }
    },
    async create(meetingId, data) {
      try {
        const res = await fetch(`${API_BASE}/api/meetings/${encodeURIComponent(meetingId)}/discussions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to create discussion (${res.status})`);
        }
        const resData = await res.json();
        const created = normalizeDiscussion(resData.discussion);
        MeetingDiscussions.addLocal(created);
        return created;
      } catch (err) {
        console.error('Discussion create error, falling back locally:', err);
        return MeetingDiscussions.addLocal({ ...data, meetingId });
      }
    },
    async update(id, data) {
      try {
        const res = await fetch(`${API_BASE}/api/discussions/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to update discussion (${res.status})`);
        }
        const resData = await res.json();
        const updated = normalizeDiscussion(resData.discussion);
        MeetingDiscussions.updateLocal(id, updated);
        return updated;
      } catch (err) {
        console.error('Discussion update error, falling back locally:', err);
        return MeetingDiscussions.updateLocal(id, data);
      }
    },
    async remove(id) {
      const rec = MeetingDiscussions.get(id);
      MeetingDiscussions.removeLocal(id);
      try {
        await fetch(`${API_BASE}/api/discussions/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('Backend discussion delete sync failed:', err);
      }
      return rec;
    },
    async search(params = {}) {
      try {
        const q = new URLSearchParams();
        if (params.query) q.set('query', params.query);
        if (params.from) q.set('from', params.from);
        if (params.to) q.set('to', params.to);
        if (params.speaker) q.set('speaker', params.speaker);
        if (params.topic) q.set('topic', params.topic);
        const res = await fetch(`${API_BASE}/api/discussions/search?${q.toString()}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        return (data.results || []).map(r => ({
          ...r,
          discussion: normalizeDiscussion(r.discussion),
          attachments: (r.attachments || []).map(normalizeMeetingAttachment),
        }));
      } catch (err) {
        console.warn('Server discussion search failed, searching local cache:', err);
        const allDiscussions = MeetingDiscussions.list();
        const allMeetings = Meetings.list();
        const allAtts = MeetingAttachments.list();
        const qStr = (params.query || '').toLowerCase();
        const filtered = allDiscussions.filter(d => {
          const mtg = allMeetings.find(m => m.id === d.meetingId);
          if (params.from && mtg && mtg.date < params.from) return false;
          if (params.to && mtg && mtg.date > params.to) return false;
          if (params.speaker && !d.speaker.toLowerCase().includes(params.speaker.toLowerCase())) return false;
          if (params.topic && !d.topic.toLowerCase().includes(params.topic.toLowerCase())) return false;
          if (!qStr) return true;
          const matchText = [d.topic, d.notes, d.speaker, d.decisions, d.facultyInstructions, d.followUpActions, mtg?.title || ''].join(' ').toLowerCase();
          return matchText.includes(qStr);
        });
        return filtered.map(d => ({
          discussion: d,
          meeting: allMeetings.find(m => m.id === d.meetingId) || null,
          attachments: allAtts.filter(a => a.discussionId === d.id || a.meetingId === d.meetingId),
        }));
      }
    }
  };

  /* ── Meeting Attachments Store ───────────────────────────── */
  const MeetingAttachments = {
    list(meetingId, discussionId) {
      let all = loadList(K.meetingAttachments).map(normalizeMeetingAttachment);
      if (meetingId) all = all.filter(a => a.meetingId === meetingId);
      if (discussionId) all = all.filter(a => a.discussionId === discussionId);
      return all;
    },
    get(id) {
      const rec = loadList(K.meetingAttachments).find(a => a.id === id);
      return rec ? normalizeMeetingAttachment(rec) : null;
    },
    addLocal(data) {
      const all = loadList(K.meetingAttachments);
      const normalized = normalizeMeetingAttachment({
        ...data,
        id: data.id || genId('matt'),
        uploadedAt: data.uploadedAt || now(),
      });
      all.push(normalized);
      saveList(K.meetingAttachments, all);
      AuditLog.append('ATTACH_MEETING_MEDIA', 'Meeting', normalized.meetingId, normalized.filename || 'Meeting attachment');
      return normalized;
    },
    updateLocal(id, data) {
      const all = loadList(K.meetingAttachments);
      const idx = all.findIndex(a => a.id === id);
      if (idx === -1) return null;
      all[idx] = normalizeMeetingAttachment({ ...all[idx], ...data, id });
      saveList(K.meetingAttachments, all);
      return all[idx];
    },
    removeLocal(id) {
      const rec = MeetingAttachments.get(id);
      const filtered = loadList(K.meetingAttachments).filter(a => a.id !== id);
      saveList(K.meetingAttachments, filtered);
      if (rec) AuditLog.append('REMOVE_MEETING_MEDIA', 'Meeting', rec.meetingId, rec.filename || '');
    },
    async sync(meetingId) {
      try {
        const url = meetingId
          ? `${API_BASE}/api/meetings/${encodeURIComponent(meetingId)}/attachments`
          : `${API_BASE}/api/meetings`;
        if (!meetingId) return MeetingAttachments.list();
        const res = await fetch(url);
        if (!res.ok) return MeetingAttachments.list(meetingId);
        const data = await res.json();
        const serverList = (data.attachments || []).map(normalizeMeetingAttachment);
        const currentAll = loadList(K.meetingAttachments);
        const merged = currentAll.filter(a => (a.meetingId !== meetingId && a.meeting_id !== meetingId)).concat(serverList);
        saveList(K.meetingAttachments, merged);
        return MeetingAttachments.list(meetingId);
      } catch (err) {
        console.warn('Meeting attachments sync failed, using cached list:', err);
        return MeetingAttachments.list(meetingId);
      }
    },
    async upload(meetingId, file, options = {}) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (options.discussionId) formData.append('discussionId', options.discussionId);
        if (options.caption) formData.append('caption', options.caption);
        if (options.uploadedBy) formData.append('uploadedBy', options.uploadedBy);
        if (options.relatedTaskId) formData.append('relatedTaskId', options.relatedTaskId);
        if (options.relatedDirectiveId) formData.append('relatedDirectiveId', options.relatedDirectiveId);
        if (options.relatedDecisionId) formData.append('relatedDecisionId', options.relatedDecisionId);

        const res = await fetch(`${API_BASE}/api/meetings/${encodeURIComponent(meetingId)}/attachments`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }

        const resData = await res.json();
        const uploaded = normalizeMeetingAttachment(resData.attachment);
        MeetingAttachments.addLocal(uploaded);
        return uploaded;
      } catch (err) {
        console.error('Meeting attachment upload error, offline fallback:', err);
        if (err.message && err.message.includes('fetch')) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const localRec = MeetingAttachments.addLocal({
                meetingId,
                discussionId: options.discussionId || '',
                filename: file.name,
                storedFilename: file.name,
                filePath: 'local-storage',
                url: e.target.result,
                mimeType: file.type || 'image/png',
                sizeBytes: file.size,
                caption: options.caption || '',
                uploadedBy: options.uploadedBy || '',
                uploadedAt: now(),
                relatedTaskId: options.relatedTaskId || '',
                relatedDirectiveId: options.relatedDirectiveId || '',
                relatedDecisionId: options.relatedDecisionId || '',
              });
              resolve(localRec);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        }
        throw err;
      }
    },
    async update(attachmentId, data) {
      MeetingAttachments.updateLocal(attachmentId, data);
      try {
        const res = await fetch(`${API_BASE}/api/attachments/${encodeURIComponent(attachmentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const resData = await res.json();
          return normalizeMeetingAttachment(resData.attachment);
        }
      } catch (err) {
        console.warn('Backend attachment patch failed:', err);
      }
      return MeetingAttachments.get(attachmentId);
    },
    async remove(attachmentId) {
      const rec = MeetingAttachments.get(attachmentId);
      MeetingAttachments.removeLocal(attachmentId);
      try {
        await fetch(`${API_BASE}/api/attachments/${encodeURIComponent(attachmentId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('Backend attachment delete sync failed:', err);
      }
      return rec;
    }
  };

  /* ── Project meta ────────────────────────────────────────── */
  const Meta = {
    defaults() {
      return {
        projectName:      'Study-Material Search Engine',
        projectCode:      '',
        objective:        '',
        scope:            '',
        institution:      '',
        department:       '',
        faculty:          '',
        facultyEmail:     '',
        startDate:        '',
        currentPhase:     '',
        teamName:         '',
        reportingContact: '',
        updatedAt:        now(),
      };
    },
    get()       { return load(K.meta) || Meta.defaults(); },
    save(data)  { save(K.meta, { ...data, updatedAt: now() }); },
  };

  /* ── ID sequence generators ──────────────────────────────── */
  function nextSeq(list, field, prefix, pad = 3) {
    if (!list.length) return `${prefix}-${String(1).padStart(pad,'0')}`;
    const nums = list.map(r => parseInt((r[field] || `${prefix}-000`).split('-').pop()) || 0);
    return `${prefix}-${String(Math.max(...nums) + 1).padStart(pad,'0')}`;
  }
  const Seq = {
    meeting()    { return nextSeq(Meetings.list(),   'meetingId',   'MTG'); },
    directive()  { return nextSeq(Directives.list(), 'directiveId', 'DIR'); },
    change()     { return nextSeq(Changes.list(),    'changeId',    'CHG'); },
    decision()   { return nextSeq(Decisions.list(),  'decisionId',  'DEC'); },
    issue()      { return nextSeq(Issues.list(),     'issueId',     'ISS'); },
    milestone()  { return nextSeq(Milestones.list(), 'milestoneId', 'MLS'); },
    test()       { return nextSeq(Tests.list(),      'testId',      'TST'); },
    task()       { return nextSeq(Tasks.list(),      'taskId',      'TSK'); },
    deliverable(){ return nextSeq(Deliverables.list(),'deliverableId','DLV'); },
  };

  /* ── Status enumerations ─────────────────────────────────── */
  const STATUS = {
    directive:  ['Not Started','In Progress','Blocked','Submitted for Review','Changes Requested','Completed and Verified'],
    task:       ['Not Started','In Progress','Submitted for Review','Verified','Changes Requested','Blocked','Completed'],
    meeting:    ['Draft','Reviewed','Finalized'],
    change:     ['Planned','In Progress','Completed','Reverted'],
    decision:   ['Under Review','Approved','Rejected','Deferred','Implemented'],
    issue:      ['Open','Investigating','Blocked','Resolved','Closed'],
    milestone:  ['Planned','In Progress','Completed','Delayed','Cancelled'],
    test:       ['Planned','In Progress','Completed'],
    contrib:    ['Assigned','Self-Reported','Demonstrated','Verified'],
  };

  /* ── Computed statistics ─────────────────────────────────── */
  const Stats = {
    tasks(filter) {
      let all = Tasks.list();
      if (filter?.memberId) all = all.filter(t => t.assignedTo === filter.memberId);
      if (filter?.from)     all = all.filter(t => t.createdAt >= filter.from);
      if (filter?.to)       all = all.filter(t => t.createdAt <= filter.to);
      return {
        total:      all.length,
        completed:  all.filter(t => ['Completed','Verified'].includes(t.status)).length,
        verified:   all.filter(t => t.status === 'Verified').length,
        inProgress: all.filter(t => t.status === 'In Progress').length,
        review:     all.filter(t => ['Submitted for Review','Awaiting Review'].includes(t.status)).length,
        changes:    all.filter(t => t.status === 'Changes Requested').length,
        blocked:    all.filter(t => t.status === 'Blocked').length,
        pending:    all.filter(t => ['Not Started','Awaiting Review','Submitted for Review','Changes Requested'].includes(t.status)).length,
      };
    },
    progressPct(filter) {
      const s = Stats.tasks(filter);
      return s.total ? Math.round((s.completed / s.total) * 100) : 0;
    },
    directives() {
      const all = Directives.list();
      return {
        total:    all.length,
        verified: all.filter(d => d.status === 'Completed and Verified').length,
        inProg:   all.filter(d => d.status === 'In Progress').length,
        blocked:  all.filter(d => d.status === 'Blocked').length,
        pending:  all.filter(d => d.status === 'Not Started').length,
        review:   all.filter(d => ['Submitted for Review','Changes Requested'].includes(d.status)).length,
      };
    },
    issues() {
      const all = Issues.list();
      return {
        total:    all.length,
        open:     all.filter(i => ['Open','Investigating','Blocked'].includes(i.status)).length,
        resolved: all.filter(i => ['Resolved','Closed'].includes(i.status)).length,
        critical: all.filter(i => i.severity === 'Critical' && i.status === 'Open').length,
        high:     all.filter(i => i.severity === 'High'     && ['Open','Investigating'].includes(i.status)).length,
      };
    },
    milestones() {
      const all = Milestones.list();
      return {
        total:     all.length,
        completed: all.filter(m => m.status === 'Completed').length,
        delayed:   all.filter(m => m.status === 'Delayed').length,
        planned:   all.filter(m => m.status === 'Planned').length,
      };
    },
    meetings()   { return { total: Meetings.list().length }; },
    changes()    { return { total: Changes.list().length, planned: Changes.list().filter(c=>c.status==='Planned').length }; },
    memberSummary(memberId) {
      const s = Stats.tasks({ memberId });
      const contribs = Contribs.list().filter(c => c.memberId === memberId);
      return {
        ...s,
        verified:   contribs.filter(c => c.tier === 'Verified').length,
        deliverables: Deliverables.list().filter(d => d.memberId === memberId).length,
      };
    },
  };

  /* ── Traceability resolver ───────────────────────────────── */
  const Trace = {
    // For a directive: find related tasks, changes, meetings, discussions, attachments
    forDirective(dirId) {
      const dir = Directives.get(dirId) || Directives.list().find(d => d.directiveId === dirId);
      const targetId = dir?.id || dirId;
      const targetCode = dir?.directiveId || dirId;
      return {
        tasks:       Tasks.list().filter(t => t.directiveId === targetId || t.directiveId === targetCode),
        changes:     Changes.list().filter(c => c.directiveId === targetId || c.directiveId === targetCode),
        meeting:     dir?.meetingId ? Meetings.get(dir.meetingId) : null,
        discussions: MeetingDiscussions.list().filter(d => d.relatedDirectiveId === targetId || d.relatedDirectiveId === targetCode),
        attachments: MeetingAttachments.list().filter(a => a.relatedDirectiveId === targetId || a.relatedDirectiveId === targetCode),
      };
    },
    // For a task: find directive, member, changes, evidence, discussions, attachments
    forTask(taskId) {
      const task = Tasks.get(taskId) || Tasks.list().find(t => t.taskId === taskId);
      if (!task) return {};
      const targetId = task.id;
      const targetCode = task.taskId || taskId;
      return {
        directive:   task.directiveId ? Directives.get(task.directiveId) : null,
        member:      task.assignedTo  ? Members.get(task.assignedTo)     : null,
        changes:     Changes.list().filter(c => c.taskId === targetId || c.taskId === targetCode),
        evidence:    Evidence.list(targetCode || targetId),
        discussions: MeetingDiscussions.list().filter(d => d.relatedTaskId === targetId || d.relatedTaskId === targetCode),
        attachments: MeetingAttachments.list().filter(a => a.relatedTaskId === targetId || a.relatedTaskId === targetCode),
      };
    },
    // For a decision: find discussions and attachments
    forDecision(decId) {
      const dec = Decisions.get(decId) || Decisions.list().find(d => d.decisionId === decId);
      const targetId = dec?.id || decId;
      const targetCode = dec?.decisionId || decId;
      return {
        discussions: MeetingDiscussions.list().filter(d => d.relatedDecisionId === targetId || d.relatedDecisionId === targetCode),
        attachments: MeetingAttachments.list().filter(a => a.relatedDecisionId === targetId || a.relatedDecisionId === targetCode),
      };
    },
    // For a meeting: find directives, tasks, discussions, attachments
    forMeeting(meetingId) {
      return {
        directives:  Directives.list().filter(d => d.meetingId === meetingId),
        tasks:       Tasks.list().filter(t => t.meetingId === meetingId),
        discussions: MeetingDiscussions.list(meetingId),
        attachments: MeetingAttachments.list(meetingId),
      };
    },
  };

  /* ── Export / import ─────────────────────────────────────── */
  const IO = {
    exportAll() {
      const out = {};
      Object.entries(K).forEach(([k, v]) => { out[k] = load(v); });
      return JSON.stringify({ _version: 2, _exported: now(), data: out }, null, 2);
    },
    importAll(jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const data   = parsed.data || parsed; // support v1 and v2
      Object.entries(K).forEach(([k, v]) => {
        if (data[k] !== undefined) save(v, data[k]);
      });
      AuditLog.append('IMPORT', 'System', 'all', 'Data import');
    },
  };

  /* ── Minutes of Meeting store ────────────────────────────── */
  const K_MOM       = 'plb_mom_documents';
  const K_MOM_IMGS  = 'plb_mom_images';

  function normalizeMoM(raw) {
    if (!raw) return null;
    return {
      id:            raw.id,
      title:         raw.title || '',
      date:          raw.date  || '',
      participants:  raw.participants  || '',
      objective:     raw.objective     || '',
      notesHtml:     raw.notes_html    || raw.notesHtml    || '',
      instructions:  raw.instructions  || '',
      decisions:     raw.decisions     || '',
      tasksAssigned: raw.tasks_assigned || raw.tasksAssigned || '',
      nextSteps:     raw.next_steps    || raw.nextSteps    || '',
      author:        raw.author        || '',
      status:        raw.status        || 'Draft',
      createdAt:     raw.created_at    || raw.createdAt    || now(),
      updatedAt:     raw.updated_at    || raw.updatedAt    || now(),
    };
  }
  function normalizeMoMImage(raw) {
    if (!raw) return null;
    const url = raw.file_url || raw.url || '';
    const fullUrl = (url && url.startsWith('/') && API_BASE) ? (API_BASE + url) : url;
    return {
      id:             raw.id,
      momId:          raw.mom_id  || raw.momId  || '',
      filename:       raw.filename || '',
      storedFilename: raw.stored_filename || raw.storedFilename || '',
      url:            fullUrl,
      mimeType:       raw.mime_type  || raw.mimeType  || 'image/png',
      sizeBytes:      raw.size_bytes !== undefined ? raw.size_bytes : (raw.sizeBytes || 0),
      caption:        raw.caption    || '',
      uploadedBy:     raw.uploaded_by || raw.uploadedBy || '',
      uploadedAt:     raw.uploaded_at || raw.uploadedAt || now(),
      sortOrder:      raw.sort_order  !== undefined ? raw.sort_order : (raw.sortOrder || 0),
    };
  }

  const MoM = {
    /* ── Local cache helpers ── */
    _list()          { return loadList(K_MOM).map(normalizeMoM); },
    _imgs(momId)     { return loadList(K_MOM_IMGS).map(normalizeMoMImage).filter(i => !momId || i.momId === momId); },
    _saveList(arr)   { saveList(K_MOM,      arr); },
    _saveImgs(arr)   { saveList(K_MOM_IMGS, arr); },

    /* ── Read (always local-first for speed) ── */
    list()           { return [...this._list()].sort((a,b) => b.date.localeCompare(a.date)); },
    get(id)          { return this._list().find(d => d.id === id) || null; },
    images(momId)    { return this._imgs(momId).sort((a,b) => a.sortOrder - b.sortOrder); },

    /* ── Sync from server ── */
    async sync() {
      try {
        const res = await fetch(`${API_BASE}/api/mom`);
        if (!res.ok) return this.list();
        const data = await res.json();
        this._saveList(data.documents || []);
        return this.list();
      } catch { return this.list(); }
    },
    async syncImages(momId) {
      try {
        const res = await fetch(`${API_BASE}/api/mom/${encodeURIComponent(momId)}`);
        if (!res.ok) return this.images(momId);
        const data = await res.json();
        const fresh = (data.images || []).map(normalizeMoMImage);
        const others = loadList(K_MOM_IMGS).map(normalizeMoMImage).filter(i => i.momId !== momId);
        this._saveImgs([...others, ...fresh]);
        return this.images(momId);
      } catch { return this.images(momId); }
    },

    /* ── Write ── */
    async save(fields) {
      /* Upsert: create or update. fields.id determines whether it's new. */
      const isNew = !fields.id;
      const id = fields.id || genId('mom');
      const payload = { ...fields, id };
      // Optimistic local update
      const existing = this.get(id);
      const merged = normalizeMoM({ ...(existing || {}), ...payload });
      const all = loadList(K_MOM).filter(d => d.id !== id);
      all.push(merged);
      this._saveList(all);
      AuditLog.append(isNew ? 'MOM_CREATE' : 'MOM_UPDATE', 'MoM', id, fields.title || '');
      // Sync to backend
      try {
        const method = 'POST';
        const url = `${API_BASE}/api/mom`;
        const r = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, notes_html: payload.notesHtml, tasks_assigned: payload.tasksAssigned, next_steps: payload.nextSteps }),
        });
        if (r.ok) {
          const d = await r.json();
          const serverDoc = normalizeMoM(d.document);
          const updated = loadList(K_MOM).filter(x => x.id !== id);
          updated.push(serverDoc);
          this._saveList(updated);
          return serverDoc;
        }
      } catch { /* keep local copy */ }
      return this.get(id);
    },

    async patch(id, fields) {
      const existing = this.get(id);
      if (!existing) return null;
      const merged = normalizeMoM({ ...existing, ...fields });
      const all = loadList(K_MOM).filter(d => d.id !== id);
      all.push(merged);
      this._saveList(all);
      AuditLog.append('MOM_PATCH', 'MoM', id, fields.status || '');
      try {
        const r = await fetch(`${API_BASE}/api/mom/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, notes_html: fields.notesHtml, tasks_assigned: fields.tasksAssigned, next_steps: fields.nextSteps }),
        });
        if (r.ok) {
          const d = await r.json();
          const serverDoc = normalizeMoM(d.document);
          const updated = loadList(K_MOM).filter(x => x.id !== id);
          updated.push(serverDoc);
          this._saveList(updated);
          return serverDoc;
        }
      } catch {}
      return this.get(id);
    },

    async remove(id) {
      const imgs = this.images(id);
      this._saveList(loadList(K_MOM).filter(d => d.id !== id));
      this._saveImgs(loadList(K_MOM_IMGS).filter(i => (i.mom_id || i.momId) !== id));
      AuditLog.append('MOM_DELETE', 'MoM', id, '');
      try { await fetch(`${API_BASE}/api/mom/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
      catch {}
    },

    async uploadImage(momId, file, caption, uploadedBy, sortOrder) {
      // Optimistic local preview (base64) while upload runs
      const localId = genId('momi_local');
      const localUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const localRec = normalizeMoMImage({
        id: localId, mom_id: momId, filename: file.name,
        stored_filename: file.name, file_url: localUrl,
        mime_type: file.type, size_bytes: file.size,
        caption: caption || '', uploaded_by: uploadedBy || '',
        uploaded_at: now(), sort_order: sortOrder || 0,
      });
      const imgs = loadList(K_MOM_IMGS);
      imgs.push(localRec);
      this._saveImgs(imgs);

      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('caption', caption || '');
        fd.append('uploadedBy', uploadedBy || '');
        fd.append('sortOrder', String(sortOrder || 0));
        const r = await fetch(`${API_BASE}/api/mom/${encodeURIComponent(momId)}/images`, { method: 'POST', body: fd });
        if (r.ok) {
          const d = await r.json();
          const serverImgs = (d.images || []).map(normalizeMoMImage);
          // Replace the local placeholder with the server record
          const updated = loadList(K_MOM_IMGS).filter(i => (i.id || i.momId) !== localId);
          updated.push(...serverImgs);
          this._saveImgs(updated);
          return serverImgs[0] || localRec;
        }
      } catch { /* keep base64 local record */ }
      return localRec;
    },

    async removeImage(imgId) {
      this._saveImgs(loadList(K_MOM_IMGS).filter(i => i.id !== imgId));
      try { await fetch(`${API_BASE}/api/mom-images/${encodeURIComponent(imgId)}`, { method: 'DELETE' }); }
      catch {}
    },

    async updateImageCaption(imgId, caption) {
      const all = loadList(K_MOM_IMGS);
      const idx = all.findIndex(i => i.id === imgId);
      if (idx !== -1) { all[idx] = normalizeMoMImage({ ...all[idx], caption }); this._saveImgs(all); }
      try {
        await fetch(`${API_BASE}/api/mom-images/${encodeURIComponent(imgId)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption }),
        });
      } catch {}
    },
  };

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    if (!load(K.meta)) Meta.save(Meta.defaults());
    setTimeout(() => {
      Evidence.sync().catch(() => {});
      MeetingDiscussions.sync().catch(() => {});
      MeetingAttachments.sync().catch(() => {});
      MoM.sync().catch(() => {});
    }, 150);
  }
  init();

  /* ── Public API ──────────────────────────────────────────── */
  return {
    Meta,
    Meetings, Members, Directives, Tasks, Evidence,
    MeetingDiscussions, MeetingAttachments, MoM,
    Changes, Decisions, Tests, Issues,
    Milestones, Deliverables, Contribs,
    AuditLog, Stats, Seq, Trace, IO, STATUS,
    API_BASE,
    genId, now,
  };
})();

