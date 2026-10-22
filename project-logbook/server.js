/**
 * Search Engine Project — Governance Portal Server
 * Zero-dependency Node.js server with:
 * - Persistent file uploads in uploads/ directory (images + PDFs)
 * - SQLite metadata database via node:sqlite (Node 22+)
 * - MIME and magic bytes validation (PNG, JPG, JPEG, WEBP, PDF, max 15MB)
 * - Safe filename generation & path traversal prevention
 * - Task Evidence & Proof Verification APIs
 * - Centralized Meeting Documentation, Discussion Timeline & Shared Media Gallery APIs
 * - Central Project Discussion Search Archive
 * - Static file serving for portal frontend
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BASE_DIR = __dirname;
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'governance.db');

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);
const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'
]);

// Ensure persistent directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS task_evidence (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    caption TEXT DEFAULT '',
    uploaded_by TEXT DEFAULT '',
    uploaded_at TEXT NOT NULL,
    review_status TEXT DEFAULT 'Pending',
    review_comment TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    reviewed_at TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_task_evidence_task_id ON task_evidence(task_id);

  CREATE TABLE IF NOT EXISTS task_reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    comment TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meetings_record (
    id TEXT PRIMARY KEY,
    number INTEGER,
    meeting_id TEXT UNIQUE,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    type TEXT DEFAULT 'Regular Meeting',
    attendees TEXT DEFAULT '',
    absent TEXT DEFAULT '',
    chair TEXT DEFAULT '',
    minutes_by TEXT DEFAULT '',
    objective TEXT DEFAULT '',
    agenda TEXT DEFAULT '',
    state TEXT DEFAULT 'Draft',
    data_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_meetings_record_date ON meetings_record(date);

  CREATE TABLE IF NOT EXISTS meeting_discussions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    notes TEXT NOT NULL,
    speaker TEXT DEFAULT '',
    discussion_time TEXT DEFAULT '',
    decision TEXT DEFAULT '',
    reasoning TEXT DEFAULT '',
    faculty_instructions TEXT DEFAULT '',
    unresolved_questions TEXT DEFAULT '',
    follow_up_action TEXT DEFAULT '',
    linked_task_id TEXT DEFAULT '',
    linked_directive_id TEXT DEFAULT '',
    linked_decision_id TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_meeting_discussions_meeting_id ON meeting_discussions(meeting_id);

  CREATE TABLE IF NOT EXISTS meeting_attachments (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    discussion_id TEXT DEFAULT '',
    filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    caption TEXT DEFAULT '',
    uploaded_by TEXT DEFAULT '',
    uploaded_at TEXT NOT NULL,
    topic TEXT DEFAULT '',
    linked_task_id TEXT DEFAULT '',
    linked_directive_id TEXT DEFAULT '',
    linked_decision_id TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting_id ON meeting_attachments(meeting_id);
  CREATE INDEX IF NOT EXISTS idx_meeting_attachments_discussion_id ON meeting_attachments(discussion_id);

  CREATE TABLE IF NOT EXISTS mom_documents (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL,
    participants TEXT DEFAULT '',
    objective   TEXT DEFAULT '',
    notes_html  TEXT DEFAULT '',
    instructions TEXT DEFAULT '',
    decisions   TEXT DEFAULT '',
    tasks_assigned TEXT DEFAULT '',
    next_steps  TEXT DEFAULT '',
    author      TEXT DEFAULT '',
    status      TEXT DEFAULT 'Draft',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mom_documents_date ON mom_documents(date);

  CREATE TABLE IF NOT EXISTS mom_images (
    id              TEXT PRIMARY KEY,
    mom_id          TEXT NOT NULL,
    filename        TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL,
    caption         TEXT DEFAULT '',
    uploaded_by     TEXT DEFAULT '',
    uploaded_at     TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_mom_images_mom_id ON mom_images(mom_id);
`);

/**
 * Validate image or document buffer using magic numbers and extension
 */
function validateFileBuffer(buffer, originalFilename, declaredMime) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file received' };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds 15MB limit (size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)` };
  }

  const ext = path.extname(originalFilename || '').toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return { valid: false, error: `Unsupported file extension (${ext || 'none'}). Allowed: PNG, JPG, JPEG, WEBP, PDF.` };
  }

  if (declaredMime && !ALLOWED_MIMES.has(declaredMime.toLowerCase())) {
    return { valid: false, error: `Unsupported MIME type (${declaredMime}). Allowed: PNG, JPG, JPEG, WEBP, PDF.` };
  }

  // Check magic bytes:
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng = buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;

  // JPEG: FF D8 FF
  const isJpeg = buffer.length >= 3 &&
    buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

  // WEBP: RIFF....WEBP (52 49 46 46 at 0, 57 45 42 50 at 8)
  const isWebp = buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  // PDF: %PDF (25 50 44 46)
  const isPdf = buffer.length >= 4 &&
    buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  if (!isPng && !isJpeg && !isWebp && !isPdf) {
    return { valid: false, error: 'Invalid file format. File signature does not match PNG, JPEG, WEBP, or PDF.' };
  }

  let detectedMime = 'application/octet-stream';
  if (isPng) detectedMime = 'image/png';
  else if (isJpeg) detectedMime = 'image/jpeg';
  else if (isWebp) detectedMime = 'image/webp';
  else if (isPdf) detectedMime = 'application/pdf';

  return { valid: true, mime: detectedMime, isPdf, isImage: !isPdf };
}

/**
 * Generate safe, unique filename
 */
function generateSafeFilename(originalFilename, mime, prefix = 'ev') {
  const parsed = path.parse(originalFilename || 'attachment');
  const safeBase = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'file';
  let ext = '.bin';
  if (mime === 'image/png') ext = '.png';
  else if (mime === 'image/jpeg') ext = '.jpg';
  else if (mime === 'image/webp') ext = '.webp';
  else if (mime === 'application/pdf') ext = '.pdf';
  else ext = parsed.ext || '.bin';

  const timestamp = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${rand}_${safeBase}${ext}`;
}

/**
 * Parse multipart/form-data body
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = 0;

  while ((start = buffer.indexOf(boundaryBuffer, start)) !== -1) {
    start += boundaryBuffer.length;
    if (buffer.slice(start, start + 2).toString() === '--') break;
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;

    const partBuffer = buffer.slice(start, nextBoundary - 2);
    const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      start = nextBoundary;
      continue;
    }

    const headersStr = partBuffer.slice(0, headerEnd).toString('utf-8');
    const bodyBuffer = partBuffer.slice(headerEnd + 4);

    const dispositionMatch = headersStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
    const mimeMatch = headersStr.match(/Content-Type:\s*([^\r\n;]+)/i);

    if (dispositionMatch) {
      const fieldName = dispositionMatch[1];
      const filename = dispositionMatch[2];
      const mime = mimeMatch ? mimeMatch[1].trim() : null;

      parts.push({
        name: fieldName,
        filename: filename || null,
        mime: mime,
        data: bodyBuffer,
      });
    }

    start = nextBoundary;
  }

  return parts;
}

/**
 * Helper to send JSON responses
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

/**
 * Helper to collect request body buffer
 */
function getBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_FILE_SIZE * 2) {
        reject(new Error('Payload too large'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

/**
 * MIME types for static file serving
 */
const STATIC_MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    /* ══════════════════════════════════════════════════════════
       API: HEALTH CHECK
       ══════════════════════════════════════════════════════════ */
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'Governance Portal API with Meeting Documentation & Discussion Archive',
        storage: 'persistent',
        uploadsDir: UPLOADS_DIR,
        dbPath: DB_PATH,
        time: new Date().toISOString(),
      });
    }

    /* ══════════════════════════════════════════════════════════
       API: MEETINGS CRUD & SYNC
       GET /api/meetings
       POST /api/meetings
       ══════════════════════════════════════════════════════════ */
    if (pathname === '/api/meetings' && req.method === 'GET') {
      const stmt = db.prepare('SELECT * FROM meetings_record ORDER BY date DESC, number DESC');
      const rows = stmt.all();
      return sendJson(res, 200, { success: true, meetings: rows });
    }

    if (pathname === '/api/meetings' && req.method === 'POST') {
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      const id = json.id || `mtg_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();
      const num = parseInt(json.number, 10) || 1;
      const mtgId = json.meetingId || `MTG-${String(num).padStart(3, '0')}`;
      const title = (json.title || `Meeting ${num}`).trim();
      const date = json.date || now.split('T')[0];
      const time = json.time || '';
      const duration = json.duration || '';
      const type = json.type || 'Regular Meeting';
      const attendees = json.attendees || '';
      const absent = json.absent || '';
      const chair = json.chair || '';
      const minutesBy = json.minutesBy || '';
      const objective = json.objective || '';
      const agenda = json.agenda || '';
      const state = json.state || 'Draft';
      const dataJson = typeof json.dataJson === 'string' ? json.dataJson : JSON.stringify(json);

      const upsertStmt = db.prepare(`
        INSERT INTO meetings_record (
          id, number, meeting_id, title, date, time, duration, type,
          attendees, absent, chair, minutes_by, objective, agenda, state, data_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          number = excluded.number,
          meeting_id = excluded.meeting_id,
          title = excluded.title,
          date = excluded.date,
          time = excluded.time,
          duration = excluded.duration,
          type = excluded.type,
          attendees = excluded.attendees,
          absent = excluded.absent,
          chair = excluded.chair,
          minutes_by = excluded.minutes_by,
          objective = excluded.objective,
          agenda = excluded.agenda,
          state = excluded.state,
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
      `);

      upsertStmt.run(
        id, num, mtgId, title, date, time, duration, type,
        attendees, absent, chair, minutesBy, objective, agenda, state, dataJson, now, now
      );

      const saved = db.prepare('SELECT * FROM meetings_record WHERE id = ?').get(id);
      return sendJson(res, 201, { success: true, meeting: saved });
    }

    const meetingIdMatch = pathname.match(/^\/api\/meetings\/([^/]+)$/);
    if (meetingIdMatch && req.method === 'GET') {
      const mid = decodeURIComponent(meetingIdMatch[1]);
      const m = db.prepare('SELECT * FROM meetings_record WHERE id = ? OR meeting_id = ?').get(mid, mid);
      if (!m) return sendJson(res, 404, { success: false, error: 'Meeting not found' });

      const discussions = db.prepare('SELECT * FROM meeting_discussions WHERE meeting_id = ? OR meeting_id = ? ORDER BY order_index ASC, created_at ASC').all(mid, m.id);
      const attachments = db.prepare('SELECT * FROM meeting_attachments WHERE meeting_id = ? OR meeting_id = ? ORDER BY uploaded_at ASC').all(mid, m.id);

      return sendJson(res, 200, { success: true, meeting: m, discussions, attachments });
    }

    if (meetingIdMatch && req.method === 'DELETE') {
      const mid = decodeURIComponent(meetingIdMatch[1]);
      // Remove attachments on disk
      const atts = db.prepare('SELECT * FROM meeting_attachments WHERE meeting_id = ?').all(mid);
      for (const a of atts) {
        if (a.file_path && fs.existsSync(a.file_path)) {
          try { fs.unlinkSync(a.file_path); } catch (e) { /* ignore */ }
        }
      }
      db.prepare('DELETE FROM meeting_attachments WHERE meeting_id = ?').run(mid);
      db.prepare('DELETE FROM meeting_discussions WHERE meeting_id = ?').run(mid);
      db.prepare('DELETE FROM meetings_record WHERE id = ? OR meeting_id = ?').run(mid, mid);

      return sendJson(res, 200, { success: true, deletedMeetingId: mid });
    }

    /* ══════════════════════════════════════════════════════════
       API: MEETING DISCUSSIONS
       GET /api/meetings/:meetingId/discussions
       POST /api/meetings/:meetingId/discussions
       ══════════════════════════════════════════════════════════ */
    const meetingDiscussionsMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/discussions$/);
    if (meetingDiscussionsMatch && req.method === 'GET') {
      const mid = decodeURIComponent(meetingDiscussionsMatch[1]);
      const stmt = db.prepare('SELECT * FROM meeting_discussions WHERE meeting_id = ? ORDER BY order_index ASC, created_at ASC');
      const rows = stmt.all(mid);

      // Attach matching media references to each discussion
      const attStmt = db.prepare('SELECT * FROM meeting_attachments WHERE meeting_id = ?');
      const allAtts = attStmt.all(mid);

      const results = rows.map(disc => {
        const linkedAtts = allAtts.filter(a => a.discussion_id === disc.id || (a.topic && disc.topic && a.topic.toLowerCase() === disc.topic.toLowerCase()));
        return { ...disc, attachments: linkedAtts };
      });

      return sendJson(res, 200, { success: true, meetingId: mid, discussions: results });
    }

    if (meetingDiscussionsMatch && req.method === 'POST') {
      const mid = decodeURIComponent(meetingDiscussionsMatch[1]);
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      if (!json.topic || !json.topic.trim()) {
        return sendJson(res, 400, { success: false, error: 'Discussion topic title is required' });
      }

      const id = json.id || `disc_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date().toISOString();
      const topic = json.topic.trim();
      const notes = (json.notes || '').trim();
      const speaker = (json.speaker || '').trim();
      const discussionTime = (json.discussionTime || json.discussion_time || '').trim();
      const decision = (json.decision || '').trim();
      const reasoning = (json.reasoning || '').trim();
      const facultyInstructions = (json.facultyInstructions || json.faculty_instructions || '').trim();
      const unresolvedQuestions = (json.unresolvedQuestions || json.unresolved_questions || '').trim();
      const followUpAction = (json.followUpAction || json.follow_up_action || '').trim();
      const linkedTaskId = (json.linkedTaskId || json.linked_task_id || '').trim();
      const linkedDirectiveId = (json.linkedDirectiveId || json.linked_directive_id || '').trim();
      const linkedDecisionId = (json.linkedDecisionId || json.linked_decision_id || '').trim();
      const orderIndex = parseInt(json.orderIndex || json.order_index, 10) || 0;

      const insertStmt = db.prepare(`
        INSERT INTO meeting_discussions (
          id, meeting_id, topic, notes, speaker, discussion_time, decision,
          reasoning, faculty_instructions, unresolved_questions, follow_up_action,
          linked_task_id, linked_directive_id, linked_decision_id, order_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        id, mid, topic, notes, speaker, discussionTime, decision,
        reasoning, facultyInstructions, unresolvedQuestions, followUpAction,
        linkedTaskId, linkedDirectiveId, linkedDecisionId, orderIndex, now, now
      );

      const created = db.prepare('SELECT * FROM meeting_discussions WHERE id = ?').get(id);
      return sendJson(res, 201, { success: true, discussion: created });
    }

    /* ══════════════════════════════════════════════════════════
       API: UPDATE / DELETE SINGLE DISCUSSION ENTRY
       PATCH /api/discussions/:id
       DELETE /api/discussions/:id
       ══════════════════════════════════════════════════════════ */
    const discussionItemMatch = pathname.match(/^\/api\/discussions\/([^/]+)$/);
    if (discussionItemMatch && req.method === 'PATCH') {
      const discId = decodeURIComponent(discussionItemMatch[1]);
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      const existing = db.prepare('SELECT * FROM meeting_discussions WHERE id = ?').get(discId);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Discussion entry not found' });

      const now = new Date().toISOString();
      const topic = json.topic !== undefined ? json.topic.trim() : existing.topic;
      const notes = json.notes !== undefined ? json.notes.trim() : existing.notes;
      const speaker = json.speaker !== undefined ? json.speaker.trim() : existing.speaker;
      const discussionTime = json.discussionTime !== undefined ? json.discussionTime.trim() : existing.discussion_time;
      const decision = json.decision !== undefined ? json.decision.trim() : existing.decision;
      const reasoning = json.reasoning !== undefined ? json.reasoning.trim() : existing.reasoning;
      const facultyInstructions = json.facultyInstructions !== undefined ? json.facultyInstructions.trim() : existing.faculty_instructions;
      const unresolvedQuestions = json.unresolvedQuestions !== undefined ? json.unresolvedQuestions.trim() : existing.unresolved_questions;
      const followUpAction = json.followUpAction !== undefined ? json.followUpAction.trim() : existing.follow_up_action;
      const linkedTaskId = json.linkedTaskId !== undefined ? json.linkedTaskId.trim() : existing.linked_task_id;
      const linkedDirectiveId = json.linkedDirectiveId !== undefined ? json.linkedDirectiveId.trim() : existing.linked_directive_id;
      const linkedDecisionId = json.linkedDecisionId !== undefined ? json.linkedDecisionId.trim() : existing.linked_decision_id;
      const orderIndex = json.orderIndex !== undefined ? parseInt(json.orderIndex, 10) : existing.order_index;

      const updateStmt = db.prepare(`
        UPDATE meeting_discussions SET
          topic = ?, notes = ?, speaker = ?, discussion_time = ?, decision = ?,
          reasoning = ?, faculty_instructions = ?, unresolved_questions = ?, follow_up_action = ?,
          linked_task_id = ?, linked_directive_id = ?, linked_decision_id = ?, order_index = ?, updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        topic, notes, speaker, discussionTime, decision,
        reasoning, facultyInstructions, unresolvedQuestions, followUpAction,
        linkedTaskId, linkedDirectiveId, linkedDecisionId, orderIndex, now, discId
      );

      const updated = db.prepare('SELECT * FROM meeting_discussions WHERE id = ?').get(discId);
      return sendJson(res, 200, { success: true, discussion: updated });
    }

    if (discussionItemMatch && req.method === 'DELETE') {
      const discId = decodeURIComponent(discussionItemMatch[1]);
      db.prepare('DELETE FROM meeting_discussions WHERE id = ?').run(discId);
      // Unlink discussion_id from attachments without deleting the attachment file
      db.prepare('UPDATE meeting_attachments SET discussion_id = "" WHERE discussion_id = ?').run(discId);
      return sendJson(res, 200, { success: true, deletedId: discId });
    }

    /* ══════════════════════════════════════════════════════════
       API: MEETING ATTACHMENTS & GALLERY
       GET /api/meetings/:meetingId/attachments
       POST /api/meetings/:meetingId/attachments
       ══════════════════════════════════════════════════════════ */
    const meetingAttachmentsMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/attachments$/);
    if (meetingAttachmentsMatch && req.method === 'GET') {
      const mid = decodeURIComponent(meetingAttachmentsMatch[1]);
      const stmt = db.prepare('SELECT * FROM meeting_attachments WHERE meeting_id = ? ORDER BY uploaded_at ASC');
      const rows = stmt.all(mid);
      return sendJson(res, 200, { success: true, meetingId: mid, attachments: rows });
    }

    if (meetingAttachmentsMatch && req.method === 'POST') {
      const mid = decodeURIComponent(meetingAttachmentsMatch[1]);
      const contentType = req.headers['content-type'] || '';
      const bodyBuffer = await getBodyBuffer(req);

      const uploadedRecords = [];

      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:["']([^"']+)["']|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
        if (!boundary) {
          return sendJson(res, 400, { success: false, error: 'Malformed multipart form: missing boundary' });
        }

        const parts = parseMultipart(bodyBuffer, boundary);
        let caption = '';
        let uploadedBy = '';
        let topic = '';
        let discussionId = '';
        let linkedTaskId = '';
        let linkedDirectiveId = '';
        let linkedDecisionId = '';

        for (const p of parts) {
          if (!p.filename) {
            const val = p.data.toString('utf-8').trim();
            if (p.name === 'caption') caption = val;
            if (p.name === 'uploadedBy') uploadedBy = val;
            if (p.name === 'topic') topic = val;
            if (p.name === 'discussionId') discussionId = val;
            if (p.name === 'linkedTaskId') linkedTaskId = val;
            if (p.name === 'linkedDirectiveId') linkedDirectiveId = val;
            if (p.name === 'linkedDecisionId') linkedDecisionId = val;
          }
        }

        for (const p of parts) {
          if (p.filename && p.data && p.data.length > 0) {
            const validation = validateFileBuffer(p.data, p.filename, p.mime);
            if (!validation.valid) {
              return sendJson(res, 400, { success: false, error: `${p.filename}: ${validation.error}` });
            }

            const storedFilename = generateSafeFilename(p.filename, validation.mime, 'mtg');
            const diskPath = path.join(UPLOADS_DIR, storedFilename);
            fs.writeFileSync(diskPath, p.data);

            const attId = `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const fileUrl = `/uploads/${storedFilename}`;
            const now = new Date().toISOString();

            const insertStmt = db.prepare(`
              INSERT INTO meeting_attachments (
                id, meeting_id, discussion_id, filename, stored_filename, file_path, file_url,
                mime_type, size_bytes, caption, uploaded_by, uploaded_at, topic,
                linked_task_id, linked_directive_id, linked_decision_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertStmt.run(
              attId, mid, discussionId, p.filename, storedFilename, diskPath, fileUrl,
              validation.mime, p.data.length, caption, uploadedBy, now, topic,
              linkedTaskId, linkedDirectiveId, linkedDecisionId
            );

            uploadedRecords.push({
              id: attId,
              meeting_id: mid,
              discussion_id: discussionId,
              filename: p.filename,
              stored_filename: storedFilename,
              file_path: diskPath,
              file_url: fileUrl,
              mime_type: validation.mime,
              size_bytes: p.data.length,
              caption,
              uploaded_by: uploadedBy,
              uploaded_at: now,
              topic,
              linked_task_id: linkedTaskId,
              linked_directive_id: linkedDirectiveId,
              linked_decision_id: linkedDecisionId,
            });
          }
        }
      } else {
        // JSON payload
        let json;
        try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
          return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
        }

        const files = Array.isArray(json.files) ? json.files : [json];
        for (const item of files) {
          const raw = item.dataUrl || item.base64 || item.data;
          if (!raw) continue;

          const originalFilename = item.filename || 'attachment.png';
          const caption = (item.caption || '').trim();
          const uploadedBy = (item.uploadedBy || '').trim();
          const topic = (item.topic || '').trim();
          const discussionId = (item.discussionId || item.discussion_id || '').trim();
          const linkedTaskId = (item.linkedTaskId || item.linked_task_id || '').trim();
          const linkedDirectiveId = (item.linkedDirectiveId || item.linked_directive_id || '').trim();
          const linkedDecisionId = (item.linkedDecisionId || item.linked_decision_id || '').trim();

          let buffer;
          let declaredMime = null;
          if (raw.startsWith('data:')) {
            const commaIdx = raw.indexOf(',');
            const metaStr = raw.slice(5, commaIdx);
            declaredMime = metaStr.split(';')[0];
            buffer = Buffer.from(raw.slice(commaIdx + 1), 'base64');
          } else {
            buffer = Buffer.from(raw, 'base64');
          }

          const validation = validateFileBuffer(buffer, originalFilename, declaredMime);
          if (!validation.valid) {
            return sendJson(res, 400, { success: false, error: `${originalFilename}: ${validation.error}` });
          }

          const storedFilename = generateSafeFilename(originalFilename, validation.mime, 'mtg');
          const diskPath = path.join(UPLOADS_DIR, storedFilename);
          fs.writeFileSync(diskPath, buffer);

          const attId = `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const fileUrl = `/uploads/${storedFilename}`;
          const now = new Date().toISOString();

          const insertStmt = db.prepare(`
            INSERT INTO meeting_attachments (
              id, meeting_id, discussion_id, filename, stored_filename, file_path, file_url,
              mime_type, size_bytes, caption, uploaded_by, uploaded_at, topic,
              linked_task_id, linked_directive_id, linked_decision_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          insertStmt.run(
            attId, mid, discussionId, originalFilename, storedFilename, diskPath, fileUrl,
            validation.mime, buffer.length, caption, uploadedBy, now, topic,
            linkedTaskId, linkedDirectiveId, linkedDecisionId
          );

          uploadedRecords.push({
            id: attId,
            meeting_id: mid,
            discussion_id: discussionId,
            filename: originalFilename,
            stored_filename: storedFilename,
            file_path: diskPath,
            file_url: fileUrl,
            mime_type: validation.mime,
            size_bytes: buffer.length,
            caption,
            uploaded_by: uploadedBy,
            uploaded_at: now,
            topic,
            linked_task_id: linkedTaskId,
            linked_directive_id: linkedDirectiveId,
            linked_decision_id: linkedDecisionId,
          });
        }
      }

      if (uploadedRecords.length === 0) {
        return sendJson(res, 400, { success: false, error: 'No valid files received' });
      }

      return sendJson(res, 201, { success: true, uploaded: uploadedRecords });
    }

    /* ══════════════════════════════════════════════════════════
       API: UPDATE / DELETE MEETING ATTACHMENT
       PATCH /api/attachments/:id
       DELETE /api/attachments/:id
       ══════════════════════════════════════════════════════════ */
    const attachmentItemMatch = pathname.match(/^\/api\/attachments\/([^/]+)$/);
    if (attachmentItemMatch && req.method === 'PATCH') {
      const attId = decodeURIComponent(attachmentItemMatch[1]);
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch { /* ignore */ }

      const existing = db.prepare('SELECT * FROM meeting_attachments WHERE id = ?').get(attId);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Attachment not found' });

      const caption = json.caption !== undefined ? json.caption.trim() : existing.caption;
      const topic = json.topic !== undefined ? json.topic.trim() : existing.topic;
      const discussionId = json.discussionId !== undefined ? json.discussionId.trim() : existing.discussion_id;
      const linkedTaskId = json.linkedTaskId !== undefined ? json.linkedTaskId.trim() : existing.linked_task_id;
      const linkedDirectiveId = json.linkedDirectiveId !== undefined ? json.linkedDirectiveId.trim() : existing.linked_directive_id;
      const linkedDecisionId = json.linkedDecisionId !== undefined ? json.linkedDecisionId.trim() : existing.linked_decision_id;

      const updateStmt = db.prepare(`
        UPDATE meeting_attachments SET
          caption = ?, topic = ?, discussion_id = ?,
          linked_task_id = ?, linked_directive_id = ?, linked_decision_id = ?
        WHERE id = ?
      `);
      updateStmt.run(caption, topic, discussionId, linkedTaskId, linkedDirectiveId, linkedDecisionId, attId);

      const updated = db.prepare('SELECT * FROM meeting_attachments WHERE id = ?').get(attId);
      return sendJson(res, 200, { success: true, attachment: updated });
    }

    if (attachmentItemMatch && req.method === 'DELETE') {
      const attId = decodeURIComponent(attachmentItemMatch[1]);
      const existing = db.prepare('SELECT * FROM meeting_attachments WHERE id = ?').get(attId);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Attachment not found' });

      if (existing.file_path && fs.existsSync(existing.file_path)) {
        try { fs.unlinkSync(existing.file_path); } catch (e) { /* ignore */ }
      }

      db.prepare('DELETE FROM meeting_attachments WHERE id = ?').run(attId);
      return sendJson(res, 200, { success: true, deletedId: attId });
    }

    /* ══════════════════════════════════════════════════════════
       API: CENTRAL PROJECT DISCUSSION ARCHIVE SEARCH
       GET /api/discussions/search?q=...&topic=...&speaker=...&from=...&to=...
       ══════════════════════════════════════════════════════════ */
    if (pathname === '/api/discussions/search' && req.method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const topicFilter = (parsedUrl.searchParams.get('topic') || '').trim();
      const speakerFilter = (parsedUrl.searchParams.get('speaker') || '').trim();
      const fromDate = (parsedUrl.searchParams.get('from') || '').trim();
      const toDate = (parsedUrl.searchParams.get('to') || '').trim();

      // Query meeting discussions joined with meeting details
      let sql = `
        SELECT
          d.*,
          m.title as meeting_title,
          m.meeting_id as meeting_code,
          m.number as meeting_number,
          m.date as meeting_date,
          m.type as meeting_type,
          m.attendees as meeting_attendees
        FROM meeting_discussions d
        LEFT JOIN meetings_record m ON (d.meeting_id = m.id OR d.meeting_id = m.meeting_id)
        WHERE 1=1
      `;
      const params = [];

      if (q) {
        sql += ` AND (
          d.topic LIKE ? OR
          d.notes LIKE ? OR
          d.decision LIKE ? OR
          d.reasoning LIKE ? OR
          d.faculty_instructions LIKE ? OR
          d.unresolved_questions LIKE ? OR
          d.follow_up_action LIKE ? OR
          d.speaker LIKE ? OR
          m.title LIKE ?
        )`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ);
      }

      if (topicFilter) {
        sql += ` AND d.topic LIKE ?`;
        params.push(`%${topicFilter}%`);
      }

      if (speakerFilter) {
        sql += ` AND d.speaker LIKE ?`;
        params.push(`%${speakerFilter}%`);
      }

      if (fromDate) {
        sql += ` AND (m.date >= ? OR d.created_at >= ?)`;
        params.push(fromDate, fromDate);
      }

      if (toDate) {
        sql += ` AND (m.date <= ? OR d.created_at <= ?)`;
        params.push(toDate, toDate);
      }

      sql += ` ORDER BY m.date DESC, d.order_index ASC, d.created_at DESC`;

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);

      // Attach relevant media for each matching result
      const allAtts = db.prepare('SELECT * FROM meeting_attachments').all();
      const enrichedResults = rows.map(r => {
        const atts = allAtts.filter(a =>
          a.discussion_id === r.id ||
          (a.meeting_id === r.meeting_id && a.topic && r.topic && a.topic.toLowerCase() === r.topic.toLowerCase())
        );
        return { ...r, attachments: atts };
      });

      return sendJson(res, 200, {
        success: true,
        count: enrichedResults.length,
        query: { q, topic: topicFilter, speaker: speakerFilter, from: fromDate, to: toDate },
        results: enrichedResults,
      });
    }

    /* ══════════════════════════════════════════════════════════
       API: TASK EVIDENCE (PRESERVED & ENHANCED)
       ══════════════════════════════════════════════════════════ */
    if (pathname === '/api/evidence' && req.method === 'GET') {
      const stmt = db.prepare('SELECT * FROM task_evidence ORDER BY uploaded_at DESC');
      const rows = stmt.all();
      return sendJson(res, 200, { success: true, evidence: rows });
    }

    const taskEvidenceMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/evidence$/);
    if (taskEvidenceMatch && req.method === 'GET') {
      const taskId = decodeURIComponent(taskEvidenceMatch[1]);
      const stmt = db.prepare('SELECT * FROM task_evidence WHERE task_id = ? ORDER BY uploaded_at ASC');
      const rows = stmt.all(taskId);
      return sendJson(res, 200, { success: true, taskId, evidence: rows });
    }

    if (taskEvidenceMatch && req.method === 'POST') {
      const taskId = decodeURIComponent(taskEvidenceMatch[1]);
      const contentType = req.headers['content-type'] || '';
      const bodyBuffer = await getBodyBuffer(req);

      const uploadedRecords = [];

      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:["']([^"']+)["']|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
        if (!boundary) {
          return sendJson(res, 400, { success: false, error: 'Malformed multipart/form-data: missing boundary' });
        }

        const parts = parseMultipart(bodyBuffer, boundary);
        let caption = '';
        let uploadedBy = '';

        for (const p of parts) {
          if (p.name === 'caption' && !p.filename) caption = p.data.toString('utf-8').trim();
          if (p.name === 'uploadedBy' && !p.filename) uploadedBy = p.data.toString('utf-8').trim();
        }

        for (const p of parts) {
          if (p.filename && p.data && p.data.length > 0) {
            const validation = validateFileBuffer(p.data, p.filename, p.mime);
            if (!validation.valid) {
              return sendJson(res, 400, { success: false, error: `${p.filename}: ${validation.error}` });
            }

            const storedFilename = generateSafeFilename(p.filename, validation.mime, 'ev');
            const diskPath = path.join(UPLOADS_DIR, storedFilename);
            fs.writeFileSync(diskPath, p.data);

            const evidenceId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const fileUrl = `/uploads/${storedFilename}`;
            const now = new Date().toISOString();

            const insertStmt = db.prepare(`
              INSERT INTO task_evidence (
                id, task_id, filename, stored_filename, file_path, file_url,
                mime_type, size_bytes, caption, uploaded_by, uploaded_at, review_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `);

            insertStmt.run(
              evidenceId, taskId, p.filename, storedFilename,
              diskPath, fileUrl, validation.mime, p.data.length,
              caption, uploadedBy, now
            );

            uploadedRecords.push({
              id: evidenceId,
              task_id: taskId,
              filename: p.filename,
              stored_filename: storedFilename,
              file_path: diskPath,
              file_url: fileUrl,
              mime_type: validation.mime,
              size_bytes: p.data.length,
              caption,
              uploaded_by: uploadedBy,
              uploaded_at: now,
              review_status: 'Pending',
            });
          }
        }
      } else {
        let json;
        try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
          return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
        }

        const files = Array.isArray(json.files) ? json.files : [json];
        for (const item of files) {
          const raw = item.dataUrl || item.base64 || item.data;
          if (!raw) continue;

          const originalFilename = item.filename || 'evidence.png';
          const caption = (item.caption || '').trim();
          const uploadedBy = (item.uploadedBy || '').trim();

          let buffer;
          let declaredMime = null;
          if (raw.startsWith('data:')) {
            const commaIdx = raw.indexOf(',');
            const metaStr = raw.slice(5, commaIdx);
            declaredMime = metaStr.split(';')[0];
            buffer = Buffer.from(raw.slice(commaIdx + 1), 'base64');
          } else {
            buffer = Buffer.from(raw, 'base64');
          }

          const validation = validateFileBuffer(buffer, originalFilename, declaredMime);
          if (!validation.valid) {
            return sendJson(res, 400, { success: false, error: `${originalFilename}: ${validation.error}` });
          }

          const storedFilename = generateSafeFilename(originalFilename, validation.mime, 'ev');
          const diskPath = path.join(UPLOADS_DIR, storedFilename);
          fs.writeFileSync(diskPath, buffer);

          const evidenceId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const fileUrl = `/uploads/${storedFilename}`;
          const now = new Date().toISOString();

          const insertStmt = db.prepare(`
            INSERT INTO task_evidence (
              id, task_id, filename, stored_filename, file_path, file_url,
              mime_type, size_bytes, caption, uploaded_by, uploaded_at, review_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
          `);

          insertStmt.run(
            evidenceId, taskId, originalFilename, storedFilename,
            diskPath, fileUrl, validation.mime, buffer.length,
            caption, uploadedBy, now
          );

          uploadedRecords.push({
            id: evidenceId,
            task_id: taskId,
            filename: originalFilename,
            stored_filename: storedFilename,
            file_path: diskPath,
            file_url: fileUrl,
            mime_type: validation.mime,
            size_bytes: buffer.length,
            caption,
            uploaded_by: uploadedBy,
            uploaded_at: now,
            review_status: 'Pending',
          });
        }
      }

      if (uploadedRecords.length === 0) {
        return sendJson(res, 400, { success: false, error: 'No valid images provided' });
      }

      return sendJson(res, 201, { success: true, uploaded: uploadedRecords });
    }

    const replaceMatch = pathname.match(/^\/api\/evidence\/([^/]+)\/replace$/);
    if (replaceMatch && req.method === 'POST') {
      const evidenceId = decodeURIComponent(replaceMatch[1]);
      const selectStmt = db.prepare('SELECT * FROM task_evidence WHERE id = ?');
      const existing = selectStmt.get(evidenceId);
      if (!existing) {
        return sendJson(res, 404, { success: false, error: 'Evidence record not found' });
      }

      const bodyBuffer = await getBodyBuffer(req);
      let json;
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      const raw = json.dataUrl || json.base64 || json.data;
      if (!raw) return sendJson(res, 400, { success: false, error: 'Missing image data' });

      const originalFilename = json.filename || existing.filename;
      let buffer;
      let declaredMime = null;
      if (raw.startsWith('data:')) {
        const commaIdx = raw.indexOf(',');
        declaredMime = raw.slice(5, commaIdx).split(';')[0];
        buffer = Buffer.from(raw.slice(commaIdx + 1), 'base64');
      } else {
        buffer = Buffer.from(raw, 'base64');
      }

      const validation = validateFileBuffer(buffer, originalFilename, declaredMime);
      if (!validation.valid) {
        return sendJson(res, 400, { success: false, error: validation.error });
      }

      if (fs.existsSync(existing.file_path)) {
        try { fs.unlinkSync(existing.file_path); } catch (e) { /* ignore */ }
      }

      const newStoredFilename = generateSafeFilename(originalFilename, validation.mime, 'ev');
      const newDiskPath = path.join(UPLOADS_DIR, newStoredFilename);
      fs.writeFileSync(newDiskPath, buffer);

      const newFileUrl = `/uploads/${newStoredFilename}`;
      const now = new Date().toISOString();
      const caption = json.caption !== undefined ? json.caption.trim() : existing.caption;

      const updateStmt = db.prepare(`
        UPDATE task_evidence SET
          filename = ?,
          stored_filename = ?,
          file_path = ?,
          file_url = ?,
          mime_type = ?,
          size_bytes = ?,
          caption = ?,
          uploaded_at = ?
        WHERE id = ?
      `);
      updateStmt.run(
        originalFilename, newStoredFilename, newDiskPath, newFileUrl,
        validation.mime, buffer.length, caption, now, evidenceId
      );

      const updated = selectStmt.get(evidenceId);
      return sendJson(res, 200, { success: true, evidence: updated });
    }

    const evidenceItemMatch = pathname.match(/^\/api\/evidence\/([^/]+)$/);
    if (evidenceItemMatch && req.method === 'PATCH') {
      const evidenceId = decodeURIComponent(evidenceItemMatch[1]);
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch { /* ignore */ }

      const existing = db.prepare('SELECT * FROM task_evidence WHERE id = ?').get(evidenceId);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Evidence record not found' });

      const caption = json.caption !== undefined ? json.caption.trim() : existing.caption;
      const reviewStatus = json.reviewStatus !== undefined ? json.reviewStatus : existing.review_status;
      const reviewComment = json.reviewComment !== undefined ? json.reviewComment : existing.review_comment;

      const updateStmt = db.prepare(`
        UPDATE task_evidence SET
          caption = ?,
          review_status = ?,
          review_comment = ?
        WHERE id = ?
      `);
      updateStmt.run(caption, reviewStatus, reviewComment, evidenceId);

      const updated = db.prepare('SELECT * FROM task_evidence WHERE id = ?').get(evidenceId);
      return sendJson(res, 200, { success: true, evidence: updated });
    }

    if (evidenceItemMatch && req.method === 'DELETE') {
      const evidenceId = decodeURIComponent(evidenceItemMatch[1]);
      const existing = db.prepare('SELECT * FROM task_evidence WHERE id = ?').get(evidenceId);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Evidence record not found' });

      if (existing.file_path && fs.existsSync(existing.file_path)) {
        try { fs.unlinkSync(existing.file_path); } catch (e) { /* ignore */ }
      }

      db.prepare('DELETE FROM task_evidence WHERE id = ?').run(evidenceId);
      return sendJson(res, 200, { success: true, deletedId: evidenceId });
    }

    const taskReviewMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/review$/);
    if (taskReviewMatch && req.method === 'POST') {
      const taskId = decodeURIComponent(taskReviewMatch[1]);
      const bodyBuffer = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(bodyBuffer.toString('utf-8')); } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      const status = json.status || 'Verified';
      const reviewerName = json.reviewerName || 'Faculty Reviewer';
      const comment = (json.comment || '').trim();
      const now = new Date().toISOString();

      const reviewId = `rev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const revStmt = db.prepare(`
        INSERT INTO task_reviews (id, task_id, status, reviewer_name, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      revStmt.run(reviewId, taskId, status, reviewerName, comment, now);

      const evUpdateStmt = db.prepare(`
        UPDATE task_evidence SET
          review_status = ?,
          review_comment = ?,
          reviewed_by = ?,
          reviewed_at = ?
        WHERE task_id = ?
      `);
      evUpdateStmt.run(status, comment, reviewerName, now, taskId);

      const evStmt = db.prepare('SELECT * FROM task_evidence WHERE task_id = ? ORDER BY uploaded_at ASC');
      const evidenceList = evStmt.all(taskId);

      return sendJson(res, 200, {
        success: true,
        taskId,
        status,
        reviewerName,
        comment,
        reviewedAt: now,
        evidence: evidenceList,
      });
    }

    /* ══════════════════════════════════════════════════════════
       API: MINUTES OF MEETING (MoM)
       GET    /api/mom                   list all, ordered newest first
       POST   /api/mom                   create or upsert
       GET    /api/mom/:id               single doc + images
       PATCH  /api/mom/:id               update fields
       DELETE /api/mom/:id               delete doc + images on disk
       POST   /api/mom/:id/images        upload image(s) to a MoM
       DELETE /api/mom-images/:imgId     delete one image
       PATCH  /api/mom-images/:imgId     update caption / sort_order
       ══════════════════════════════════════════════════════════ */

    if (pathname === '/api/mom' && req.method === 'GET') {
      const rows = db.prepare(
        'SELECT * FROM mom_documents ORDER BY date DESC, created_at DESC'
      ).all();
      return sendJson(res, 200, { success: true, documents: rows });
    }

    if (pathname === '/api/mom' && req.method === 'POST') {
      const body = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(body.toString('utf-8')); }
      catch { return sendJson(res, 400, { success: false, error: 'Invalid JSON' }); }

      const now = new Date().toISOString();
      const id = json.id || `mom_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const stmt = db.prepare(`
        INSERT INTO mom_documents
          (id, title, date, participants, objective, notes_html, instructions,
           decisions, tasks_assigned, next_steps, author, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, date=excluded.date,
          participants=excluded.participants, objective=excluded.objective,
          notes_html=excluded.notes_html, instructions=excluded.instructions,
          decisions=excluded.decisions, tasks_assigned=excluded.tasks_assigned,
          next_steps=excluded.next_steps, author=excluded.author,
          status=excluded.status, updated_at=excluded.updated_at
      `);
      stmt.run(
        id,
        (json.title || 'Untitled Meeting').trim(),
        json.date || now.split('T')[0],
        (json.participants || '').trim(),
        (json.objective || '').trim(),
        (json.notes_html || '').trim(),
        (json.instructions || '').trim(),
        (json.decisions || '').trim(),
        (json.tasks_assigned || '').trim(),
        (json.next_steps || '').trim(),
        (json.author || '').trim(),
        json.status || 'Draft',
        now, now
      );
      const saved = db.prepare('SELECT * FROM mom_documents WHERE id=?').get(id);
      return sendJson(res, 201, { success: true, document: saved });
    }

    const momIdMatch = pathname.match(/^\/api\/mom\/([^/]+)$/);

    if (momIdMatch && req.method === 'GET') {
      const mid = decodeURIComponent(momIdMatch[1]);
      const doc = db.prepare('SELECT * FROM mom_documents WHERE id=?').get(mid);
      if (!doc) return sendJson(res, 404, { success: false, error: 'MoM not found' });
      const images = db.prepare(
        'SELECT * FROM mom_images WHERE mom_id=? ORDER BY sort_order ASC, uploaded_at ASC'
      ).all(mid);
      return sendJson(res, 200, { success: true, document: doc, images });
    }

    if (momIdMatch && req.method === 'PATCH') {
      const mid = decodeURIComponent(momIdMatch[1]);
      const body = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(body.toString('utf-8')); } catch {}
      const existing = db.prepare('SELECT * FROM mom_documents WHERE id=?').get(mid);
      if (!existing) return sendJson(res, 404, { success: false, error: 'MoM not found' });
      const now = new Date().toISOString();
      const f = (k) => json[k] !== undefined ? json[k] : existing[k];
      db.prepare(`
        UPDATE mom_documents SET title=?,date=?,participants=?,objective=?,
        notes_html=?,instructions=?,decisions=?,tasks_assigned=?,next_steps=?,
        author=?,status=?,updated_at=? WHERE id=?
      `).run(
        f('title'), f('date'), f('participants'), f('objective'),
        f('notes_html'), f('instructions'), f('decisions'),
        f('tasks_assigned'), f('next_steps'), f('author'), f('status'),
        now, mid
      );
      const updated = db.prepare('SELECT * FROM mom_documents WHERE id=?').get(mid);
      return sendJson(res, 200, { success: true, document: updated });
    }

    if (momIdMatch && req.method === 'DELETE') {
      const mid = decodeURIComponent(momIdMatch[1]);
      const imgs = db.prepare('SELECT * FROM mom_images WHERE mom_id=?').all(mid);
      for (const img of imgs) {
        if (img.file_path && fs.existsSync(img.file_path)) {
          try { fs.unlinkSync(img.file_path); } catch {}
        }
      }
      db.prepare('DELETE FROM mom_images WHERE mom_id=?').run(mid);
      db.prepare('DELETE FROM mom_documents WHERE id=?').run(mid);
      return sendJson(res, 200, { success: true, deletedId: mid });
    }

    const momImagesMatch = pathname.match(/^\/api\/mom\/([^/]+)\/images$/);

    if (momImagesMatch && req.method === 'POST') {
      const mid = decodeURIComponent(momImagesMatch[1]);
      const contentType = req.headers['content-type'] || '';
      const bodyBuffer = await getBodyBuffer(req);
      const uploaded = [];

      if (contentType.includes('multipart/form-data')) {
        const bm = contentType.match(/boundary=(?:["']([^"']+)["']|([^;]+))/i);
        const boundary = bm ? (bm[1] || bm[2]) : null;
        if (!boundary) return sendJson(res, 400, { success: false, error: 'Missing boundary' });
        const parts = parseMultipart(bodyBuffer, boundary);
        let caption = '', uploadedBy = '', sortOrder = 0;
        for (const p of parts) {
          if (!p.filename) {
            const v = p.data.toString('utf-8').trim();
            if (p.name === 'caption') caption = v;
            if (p.name === 'uploadedBy') uploadedBy = v;
            if (p.name === 'sortOrder') sortOrder = parseInt(v, 10) || 0;
          }
        }
        for (const p of parts) {
          if (p.filename && p.data && p.data.length > 0) {
            const v = validateFileBuffer(p.data, p.filename, p.mime);
            if (!v.valid) return sendJson(res, 400, { success: false, error: `${p.filename}: ${v.error}` });
            const sf = generateSafeFilename(p.filename, v.mime, 'mom');
            const dp = path.join(UPLOADS_DIR, sf);
            fs.writeFileSync(dp, p.data);
            const imgId = `momi_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const now = new Date().toISOString();
            db.prepare(`
              INSERT INTO mom_images
                (id,mom_id,filename,stored_filename,file_path,file_url,
                 mime_type,size_bytes,caption,uploaded_by,uploaded_at,sort_order)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            `).run(imgId, mid, p.filename, sf, dp, `/uploads/${sf}`,
                   v.mime, p.data.length, caption, uploadedBy, now, sortOrder);
            uploaded.push(db.prepare('SELECT * FROM mom_images WHERE id=?').get(imgId));
          }
        }
      }
      if (!uploaded.length) return sendJson(res, 400, { success: false, error: 'No valid images received' });
      return sendJson(res, 201, { success: true, images: uploaded });
    }

    const momImageItemMatch = pathname.match(/^\/api\/mom-images\/([^/]+)$/);

    if (momImageItemMatch && req.method === 'PATCH') {
      const iid = decodeURIComponent(momImageItemMatch[1]);
      const body = await getBodyBuffer(req);
      let json = {};
      try { json = JSON.parse(body.toString('utf-8')); } catch {}
      const existing = db.prepare('SELECT * FROM mom_images WHERE id=?').get(iid);
      if (!existing) return sendJson(res, 404, { success: false, error: 'Image not found' });
      const caption = json.caption !== undefined ? json.caption.trim() : existing.caption;
      const sortOrder = json.sortOrder !== undefined ? parseInt(json.sortOrder,10) : existing.sort_order;
      db.prepare('UPDATE mom_images SET caption=?,sort_order=? WHERE id=?').run(caption, sortOrder, iid);
      return sendJson(res, 200, { success: true, image: db.prepare('SELECT * FROM mom_images WHERE id=?').get(iid) });
    }

    if (momImageItemMatch && req.method === 'DELETE') {
      const iid = decodeURIComponent(momImageItemMatch[1]);
      const img = db.prepare('SELECT * FROM mom_images WHERE id=?').get(iid);
      if (!img) return sendJson(res, 404, { success: false, error: 'Image not found' });
      if (img.file_path && fs.existsSync(img.file_path)) {
        try { fs.unlinkSync(img.file_path); } catch {}
      }
      db.prepare('DELETE FROM mom_images WHERE id=?').run(iid);
      return sendJson(res, 200, { success: true, deletedId: iid });
    }

    /* ══════════════════════════════════════════════════════════
       SERVE UPLOADED FILES (IMAGES & PDFS)
       GET /uploads/:filename
       ══════════════════════════════════════════════════════════ */
    if (pathname.startsWith('/uploads/')) {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, filename);

      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access denied');
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Attachment not found');
      }

      const ext = path.extname(filename).toLowerCase();
      const mime = STATIC_MIMES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    /* ══════════════════════════════════════════════════════════
       STATIC FILE SERVING FOR PORTAL FRONTEND
       ══════════════════════════════════════════════════════════ */
    let safeRelPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let staticFilePath = path.join(BASE_DIR, safeRelPath);

    const resolvedStatic = path.resolve(staticFilePath);
    if (!resolvedStatic.startsWith(path.resolve(BASE_DIR))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isDirectory()) {
      staticFilePath = path.join(staticFilePath, 'index.html');
    }

    if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
      const ext = path.extname(staticFilePath).toLowerCase();
      const mime = STATIC_MIMES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      fs.createReadStream(staticFilePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Resource not found');

  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { success: false, error: 'Internal server error: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Governance Portal server running at http://localhost:${PORT}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  console.log(`SQLite database:   ${DB_PATH}`);
  console.log(`====================================================`);
});
