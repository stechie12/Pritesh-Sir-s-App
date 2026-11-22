import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveThreadTitle,
  createChatThread,
  upsertMessageInThreads,
  updateMessageInThreads,
  deleteThreadById,
  renameThreadById,
  togglePinThreadById,
  searchAndSortThreads,
  formatRelativeThreadTime,
  sanitizeThreadsForStorage,
  mergeCloudDoubtsIntoThreads,
  type ChatThread,
} from './chatHistory';
import type { TutorMessage } from '../components/DoubtTutorPanel';

function makeMsg(id: string, question: string, reply = 'Sample reply'): TutorMessage {
  return {
    id,
    question,
    responseType: 'chat',
    chatReply: reply,
    conceptTitle: 'Trigonometry',
    prerequisiteRecap: '',
    steps: [],
    finalAnswer: '',
    examTip: '',
    timestamp: '10:00 AM',
  };
}

test('deriveThreadTitle trims markdown and truncates long questions cleanly', () => {
  assert.equal(deriveThreadTitle('  **Solve**   x^2 - 5x + 6 = 0  '), 'Solve x^2 - 5x + 6 = 0');
  const longQ = 'Explain how to derive the standard trigonometric ratios table for 0, 30, 45, 60, and 90 degrees in ICSE Class 9';
  const title = deriveThreadTitle(longQ);
  assert.ok(title.length <= 54);
  assert.ok(title.endsWith('...'));
  assert.equal(deriveThreadTitle('   '), 'Untitled Math Chat');
});

test('upsertMessageInThreads creates a new thread when none is active and appends to active thread', () => {
  const m1 = makeMsg('m1', 'What is sin 30 degrees?');
  const first = upsertMessageInThreads([], null, m1, '9', 'ICSE', 1000);
  assert.equal(first.threads.length, 1);
  assert.equal(first.activeThreadId, first.threads[0].id);
  assert.equal(first.threads[0].title, 'What is sin 30 degrees?');
  assert.equal(first.threads[0].messages.length, 1);

  const m2 = makeMsg('m2', 'And what about cos 60 degrees?');
  const second = upsertMessageInThreads(first.threads, first.activeThreadId, m2, '9', 'ICSE', 2000);
  assert.equal(second.threads.length, 1);
  assert.equal(second.threads[0].messages.length, 2);
  assert.equal(second.threads[0].messages[0].id, 'm2');
  assert.equal(second.threads[0].title, 'What is sin 30 degrees?');
  assert.equal(second.threads[0].updatedAt, 2000);
});

test('updateMessageInThreads updates target message immutably', () => {
  const m1 = makeMsg('m1', 'Prove identity', 'Partial...');
  const { threads, activeThreadId } = upsertMessageInThreads([], null, m1, '10', 'ICSE', 1000);
  const updated = updateMessageInThreads(
    threads,
    activeThreadId,
    'm1',
    (prev) => ({ ...prev, chatReply: 'Complete proof!', isInterrupted: false }),
    2500
  );
  assert.equal(updated[0].messages[0].chatReply, 'Complete proof!');
  assert.equal(updated[0].updatedAt, 2500);
});

test('rename, pin, search, sort, and delete threads work deterministically', () => {
  const t1 = createChatThread('9', 'ICSE', makeMsg('m1', 'Trigonometry ratios table'), 1000);
  const t2 = createChatThread('10', 'CBSE', makeMsg('m2', 'Quadratic formula roots'), 3000);
  const t3 = createChatThread('11', 'CBSE', makeMsg('m3', 'Calculus derivative of x^3'), 2000);

  let list: ChatThread[] = [t1, t2, t3];
  list = renameThreadById(list, t1.id, 'ICSE Trig Table Notes', 1500);
  assert.equal(list.find((t) => t.id === t1.id)?.title, 'ICSE Trig Table Notes');

  list = togglePinThreadById(list, t1.id);
  const sorted = searchAndSortThreads(list, '');
  // Pinned t1 should come first even though t2 has newer updatedAt
  assert.equal(sorted[0].id, t1.id);
  assert.equal(sorted[1].id, t2.id);
  assert.equal(sorted[2].id, t3.id);

  // Search matches message content and title
  const quadHits = searchAndSortThreads(list, 'quadratic');
  assert.equal(quadHits.length, 1);
  assert.equal(quadHits[0].id, t2.id);

  // Deleting active thread clears activeThreadId
  const afterDelete = deleteThreadById(list, t2.id, t2.id);
  assert.equal(afterDelete.threads.length, 2);
  assert.equal(afterDelete.activeThreadId, null);
});

test('formatRelativeThreadTime formats timestamps cleanly', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeThreadTime(now - 15_000, now), 'Just now');
  assert.equal(formatRelativeThreadTime(now - 5 * 60_000, now), '5m ago');
  assert.equal(formatRelativeThreadTime(now - 3 * 3600_000, now), '3h ago');
  assert.equal(formatRelativeThreadTime(now - 30 * 3600_000, now), 'Yesterday');
  assert.equal(formatRelativeThreadTime(now - 4 * 86400_000, now), '4d ago');
});

test('sanitizeThreadsForStorage drops empty threads and bounds payload size', () => {
  const emptyThread = createChatThread('9', 'ICSE', undefined, 1000);
  const hugeMsg = makeMsg('m_big', 'Q'.repeat(3000), 'A'.repeat(20000));
  const populated = createChatThread('10', 'ICSE', hugeMsg, 2000);

  const sanitized = sanitizeThreadsForStorage([emptyThread, populated]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].messages[0].question.length, 2000);
  assert.equal(sanitized[0].messages[0].chatReply?.length, 12000);
});

test('mergeCloudDoubtsIntoThreads deduplicates existing message IDs and adds missing cloud doubts', () => {
  const local = [createChatThread('9', 'ICSE', makeMsg('dbt_1', 'Local question'), 5000)];
  const merged = mergeCloudDoubtsIntoThreads(local, [
    {
      id: 'dbt_1',
      grade: '9',
      board: 'ICSE',
      topic: 'Algebra',
      question: 'Local question',
      answer: 'Duplicate should be skipped',
      createdAtMs: 5000,
    },
    {
      id: 'dbt_2',
      grade: '10',
      board: 'ICSE',
      topic: 'Circles',
      question: 'State alternate segment theorem',
      answer: 'The angle between a tangent and chord equals the angle in the alternate segment.',
      createdAtMs: 4000,
    },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged.some((t) => t.id === 'cloud_dbt_2'), true);
});
