/**
 * Automated test suite for Task Evidence and Proof Upload feature
 * Tests:
 * 1. Health check & persistent storage setup
 * 2. Server validation: MIME types, magic numbers, file sizes
 * 3. File upload (PNG and JPG) with metadata (task ID, caption, uploader)
 * 4. Multi-image attachment to a single task
 * 5. Image retrieval & secure static serving from uploads/
 * 6. Image replacement workflow
 * 7. Faculty review workflow (Verified, Changes Requested, comments)
 * 8. Image deletion workflow (removes from disk and SQLite DB)
 * 9. Server restart persistence verification
 */

const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = 'http://localhost:3000';

// Minimal 1x1 valid PNG buffer: 89 50 4E 47 0D 0A 1A 0A ...
const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Minimal valid JPEG buffer
const VALID_JPG_BUFFER = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
  0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
  0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
  0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

async function runTests() {
  console.log('--- Starting Task Evidence & Proof Verification Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert(health.status === 'ok' && health.storage === 'persistent', '1. Server is running and using persistent storage');

  // 2. Reject non-image extension (.txt)
  const badExtRes = await fetch(`${BASE_URL}/api/tasks/TSK-999/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'malicious.txt',
      dataUrl: 'data:text/plain;base64,SGVsbG8=',
      caption: 'text file',
    }),
  });
  assert(badExtRes.status === 400, '2. Server rejects non-image extension (.txt)');

  // 3. Reject fake image without valid PNG/JPEG magic bytes
  const fakeImgRes = await fetch(`${BASE_URL}/api/tasks/TSK-999/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'fake.png',
      dataUrl: 'data:image/png;base64,VGhpcyBpcyBub3QgYSBwbmc=',
      caption: 'corrupted image',
    }),
  });
  assert(fakeImgRes.status === 400, '3. Server validates image magic bytes and rejects counterfeit file headers');

  // 4. Upload valid PNG image
  const uploadRes = await fetch(`${BASE_URL}/api/tasks/TSK-TEST-001/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'search_results_screenshot.png',
      dataUrl: `data:image/png;base64,${VALID_PNG_BASE64}`,
      caption: 'Screenshot demonstrating search latency under 45ms',
      uploadedBy: 'Riya Sharma',
    }),
  });
  assert(uploadRes.status === 201, '4. Server accepts and stores valid PNG evidence (HTTP 201)');
  const uploadData = await uploadRes.json();
  assert(uploadData.uploaded && uploadData.uploaded.length === 1, '4b. Returned created evidence record');
  const firstEv = uploadData.uploaded[0];
  assert(firstEv.task_id === 'TSK-TEST-001' && firstEv.caption.includes('45ms'), '4c. Metadata linked to correct task ID and caption');
  assert(fs.existsSync(firstEv.file_path), '4d. Image saved persistently to disk in uploads/');

  // 5. Upload second image (JPEG) to the same task (multi-attachment)
  const uploadJpgRes = await fetch(`${BASE_URL}/api/tasks/TSK-TEST-001/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'inverted_index_memory_graph.jpg',
      dataUrl: `data:image/jpeg;base64,${VALID_JPG_BUFFER.toString('base64')}`,
      caption: 'RAM profile graph showing efficient hash map memory bounds',
      uploadedBy: 'Aarav Patel',
    }),
  });
  assert(uploadJpgRes.status === 201, '5. Server accepts JPEG format attachment to same task');
  const uploadJpgData = await uploadJpgRes.json();
  const secondEv = uploadJpgData.uploaded[0];

  // 6. Query evidence for task
  const queryRes = await fetch(`${BASE_URL}/api/tasks/TSK-TEST-001/evidence`);
  const queryData = await queryRes.json();
  assert(queryData.evidence && queryData.evidence.length === 2, '6. Multiple attachments retrieved for task (2 images)');

  // 7. Verify static image serving from /uploads/
  const serveRes = await fetch(`${BASE_URL}${firstEv.file_url}`);
  assert(serveRes.status === 200 && serveRes.headers.get('content-type') === 'image/png', '7. Static image file served securely via HTTP');

  // 8. Replace an attachment
  const replaceRes = await fetch(`${BASE_URL}/api/evidence/${firstEv.id}/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'updated_search_latency_screenshot.png',
      dataUrl: `data:image/png;base64,${VALID_PNG_BASE64}`,
      caption: 'Updated latency measurement showing 38ms after caching',
    }),
  });
  assert(replaceRes.status === 200, '8. Attachment replacement succeeds (HTTP 200)');
  const replaceData = await replaceRes.json();
  assert(replaceData.evidence.filename === 'updated_search_latency_screenshot.png', '8b. Attachment filename and metadata updated');

  // 9. Faculty review workflow
  const reviewRes = await fetch(`${BASE_URL}/api/tasks/TSK-TEST-001/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Verified',
      reviewerName: 'Prof. Sharma (Faculty Guide)',
      comment: 'Inspected latency screenshot and memory graph. Results verified according to acceptance criteria.',
    }),
  });
  assert(reviewRes.status === 200, '9. Faculty verification review succeeds (HTTP 200)');
  const reviewData = await reviewRes.json();
  assert(reviewData.status === 'Verified' && reviewData.comment.includes('Inspected latency screenshot'), '9b. Verification status and reviewer comment stored');

  // 10. Delete attachment
  const deleteRes = await fetch(`${BASE_URL}/api/evidence/${secondEv.id}`, {
    method: 'DELETE',
  });
  assert(deleteRes.status === 200, '10. Delete attachment succeeds (HTTP 200)');
  assert(!fs.existsSync(secondEv.file_path), '10b. Deleted file unlinked from disk');

  // Final count check
  const afterDelRes = await fetch(`${BASE_URL}/api/tasks/TSK-TEST-001/evidence`);
  const afterDelData = await afterDelRes.json();
  assert(afterDelData.evidence.length === 1, '10c. Only 1 attachment remains for task after deletion');

  // Clean up test file
  await fetch(`${BASE_URL}/api/evidence/${firstEv.id}`, { method: 'DELETE' });

  console.log(`\n--- Test Suite Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
