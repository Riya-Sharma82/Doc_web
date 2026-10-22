# Search Engine Project — Governance Portal

A faculty-review-grade documentation and progress tracking portal for the study-material search engine project.

## Quick Start

1. Start the backend server:
   ```bash
   cd project-logbook
   npm start
   ```
2. Open **`http://localhost:3000`** in your browser (or double-click `index.html`).
3. To attach proof to any task: click **"+ Attach Proof"** or the camera icon in **Team & Tasks**.
4. Faculty members can inspect uploaded photos/screenshots, navigate the multi-image gallery/carousel, and verify the work directly from the modal!

---

## Architecture — What Was Built

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES2020) | Navy & white faculty-review design system |
| Backend & API | Node.js native `http` server (`server.js`) | Zero external dependencies, persistent RESTful API |
| File Storage | Persistent filesystem (`uploads/`) | Server-side MIME & magic-bytes validation, safe filenames |
| Database | SQLite (`data/governance.db`) via `node:sqlite` | Persistent task evidence, review history & audit log |
| Fallback | Browser `localStorage` / JSON backup | Syncs with backend and export/import |

**Files:**
```
project-logbook/
├── index.html              ← Portal UI with Evidence & Verification Modal
├── server.js               ← Zero-dependency backend server with SQLite & file storage
├── package.json            ← npm start / dev scripts
├── uploads/                ← Persistent directory for uploaded proof images
├── data/                   ← Persistent SQLite database (governance.db)
├── test-evidence-suite.js  ← Automated verification test suite
├── assets/
│   ├── css/styles.css      ← Design system + Evidence carousel & modal styles
│   └── js/
│       ├── db.js           ← Data layer: Evidence store, backend sync, verification
│       ├── ui.js           ← UI utilities: thumbnail generator, badges, formatting
│       └── app.js          ← Gallery carousel, upload handler, review workflow
└── README.md
```

---

## Portal Sections

| # | Section | Purpose |
|---|---|---|
| 1 | **Project Overview** | Live metrics dashboard — meetings, tasks, directives, issues, progress % |
| 2 | **Meeting Register** | Full formal minutes with Draft → Reviewed → Finalized lifecycle |
| 3 | **Faculty Directives** | Every instruction from faculty with traceability chain and verification status |
| 4 | **Team Contributions** | Member profiles, task matrix, deliverable evidence, contribution tiers |
| 5 | **Tasks & Milestones** | Task register linked to directives — milestone table — project timeline |
| 6 | **Development History** | Change register (CHG-001…) tabbed by subsystem with verification status |
| 7 | **Technical Decisions** | Engineering decisions register — options considered, reasoning, approval status |
| 8 | **Testing & Evaluation** | Test sessions with P@K, R@K, MRR, NDCG, latency, before/after comparison |
| 9 | **Issues & Risks** | Bug and risk tracker with severity classification and resolution history |
| 10 | **Reports & Export** | Formal report generator for faculty review — section selector, date filter, print to PDF |
| 11 | **Project Configuration** | Project metadata, JSON backup/restore, audit log |

---

## Recording a New Meeting

1. Click **Meeting Register** → **+ Add Meeting**.
2. Fill in meeting number, ID (auto-generated as MTG-001), date, type, attendees, and objective. Set state to **Draft**.
3. Click **Save Meeting** — you are taken to the meeting detail view.
4. Use the **+ Add** buttons in each section to fill in:
   - **A** — Meeting information (pre-filled from the form)
   - **B** — Faculty directives (links to the Faculty Directives register)
   - **C** — Technical discussions and decisions
   - **D** — Work demonstrated or reported (select evidence tier: Self-Reported / Demonstrated / Verified)
   - **E** — Faculty feedback and corrective actions
   - **F** — Action items (owner, deadline, deliverable, status)
   - **G** — Next meeting preparation items
5. When minutes are agreed by the team, click **Advance State →** to move to **Reviewed**.
6. After faculty confirmation, advance to **Finalized**. All subsequent edits are logged in the audit trail.

---

## Generating a Faculty Progress Report

1. Click **Reports & Export** in the sidebar.
2. Set the **Reporting Period** (from / to dates). Leave blank to include all records.
3. Select the **sections** to include (all checked by default).
4. Click **▶ Generate Report**.
5. Review the preview for accuracy — check that all figures match your records.
6. Click **🖨 Print / Save PDF**.
7. In the browser print dialog: set **Destination** to *Save as PDF*, margins to *Normal*, enable *Background graphics*.

The report includes a notice that it reflects only recorded data, and marks any section without data as "Not recorded" rather than fabricating content.

---

## Directive Traceability

The traceability chain connects:

```
Faculty Meeting  →  Directive (DIR-001)  →  Task (TSK-003)  →  Member  →  Change (CHG-002)  →  Verification Evidence
```

To view this chain for any directive:
1. Go to **Faculty Directives**.
2. Click the 🔗 icon on any directive row.
3. The **Traceability Modal** shows the linked meeting, assigned tasks, technical changes, and verification evidence.

A directive cannot be marked **Completed and Verified** without a documented Verification Method.

---

## Contribution Tiers

Each contribution is classified by the highest level of evidence available:

| Tier | Meaning |
|---|---|
| **Assigned** | Work was assigned to this member |
| **Self-Reported** | Member states the work is complete |
| **Demonstrated** | Work was shown in a meeting or review session |
| **Verified** | Reviewed by another team member, tested, or confirmed by faculty |

Do not escalate a tier beyond what the evidence supports.

---

## Backing Up and Sharing Data

Data lives in `localStorage` — it is device and browser specific.

**To share with teammates:**
1. Go to **Reports & Export** → **⬇ Export JSON**.
2. Share the `.json` file.
3. Each teammate clicks **⬆ Import JSON** to load it.

**Warning:** Import overwrites all current data. Always export a backup first.

**For shared team access:** migrate to a backend REST API (SQLite or PostgreSQL). The frontend is structured to support this — `db.js` uses a consistent CRUD interface that can be replaced with `fetch()` calls with minimal changes to `app.js`.

---

## Data Model Summary

| Store | ID Format | Key Fields |
|---|---|---|
| Meetings | MTG-001 | number, date, type, state (Draft/Reviewed/Finalized), 7 sub-sections |
| Directives | DIR-001 | instruction, meetingId, status (6 workflow states), verificationMethod, acceptanceCriteria |
| Tasks | TSK-001 | title, assignedTo, directiveId, status, evidence |
| Members | — | name, role, responsibilities, components |
| Changes | CHG-001 | title, subsystem, directiveId, isPlanned flag, verificationStatus |
| Decisions | DEC-001 | question, options, decision, reasoning, approvalStatus, implementationStatus |
| Tests | TST-001 | testDate, dataset, queries, P@K, R@K, MRR, NDCG, latency |
| Issues | ISS-001 | severity, priority, rootCause, resolution, status |
| Milestones | MLS-001 | plannedDate, actualDate, status, evidence |
| Deliverables | DLV-001 | memberId, type, link |
| Contributions | — | memberId, tier (4 levels), meetingId, evidence |
| Audit Log | — | Auto-appended on every create/update/delete |

---

## Accuracy Commitment

This portal enforces the principle that **every reported achievement must be traceable to a documented record**:

- Progress percentages are calculated from actual task statuses — never manually entered.
- Empty sections display templates rather than fabricated content.
- The "Completed and Verified" status requires a documented verification method.
- Planned technical changes are clearly labelled and not counted as implemented work.
- The report generator marks all unfilled sections as "Not recorded".
- The audit log records every change transparently.
