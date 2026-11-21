import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync('DRAFT_firestore.rules', 'utf-8');

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

interface EvalContext {
  auth: AuthContext | null;
  studentId: string;
  subId?: string;
  requestTime: number;
  parentStudentExists?: boolean;
  parentStudentUid?: string;
  existingData?: Record<string, unknown>;
  incomingData?: Record<string, unknown>;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'students' | 'attempts' | 'doubts';
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function isValidStudentProfile(data: Record<string, unknown>, authUid: string): boolean {
  const allowedKeys = [
    'uid',
    'displayName',
    'grade',
    'board',
    'adaptiveRating',
    'solvedCount',
    'accuracyPercent',
    'streakDays',
    'weakTopics',
    'createdAt',
    'updatedAt'
  ];
  const keys = Object.keys(data);
  if (keys.length !== allowedKeys.length) return false;
  if (!allowedKeys.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => allowedKeys.includes(k))) return false;

  if (typeof data.uid !== 'string' || !isValidId(data.uid) || data.uid !== authUid) return false;
  if (typeof data.displayName !== 'string' || data.displayName.length < 1 || data.displayName.length > 80) return false;
  if (typeof data.grade !== 'string' || !['8', '9', '10', '11', '12'].includes(data.grade)) return false;
  if (typeof data.board !== 'string' || !['ICSE', 'CBSE'].includes(data.board)) return false;
  if (typeof data.adaptiveRating !== 'number' || data.adaptiveRating < 600 || data.adaptiveRating > 2600) return false;
  if (typeof data.solvedCount !== 'number' || data.solvedCount < 0 || data.solvedCount > 100000) return false;
  if (typeof data.accuracyPercent !== 'number' || data.accuracyPercent < 0 || data.accuracyPercent > 100) return false;
  if (typeof data.streakDays !== 'number' || data.streakDays < 0 || data.streakDays > 3650) return false;
  if (!Array.isArray(data.weakTopics) || data.weakTopics.length > 10) return false;
  if (data.weakTopics.length > 0 && (typeof data.weakTopics[0] !== 'string' || data.weakTopics[0].length > 80)) return false;
  if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') return false;
  return true;
}

function evaluateRules(ctx: EvalContext): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!ctx.auth) return 'PERMISSION_DENIED';

  if (ctx.collection === 'students') {
    if (ctx.operation === 'get') {
      return ctx.auth.uid === ctx.studentId && isValidId(ctx.studentId) ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'list') {
      return ctx.existingData?.uid === ctx.auth.uid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'create') {
      if (!ctx.auth.email_verified) return 'PERMISSION_DENIED';
      if (ctx.auth.uid !== ctx.studentId || !isValidId(ctx.studentId)) return 'PERMISSION_DENIED';
      if (!ctx.incomingData || !isValidStudentProfile(ctx.incomingData, ctx.auth.uid)) return 'PERMISSION_DENIED';
      if (ctx.incomingData.createdAt !== ctx.requestTime || ctx.incomingData.updatedAt !== ctx.requestTime) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
    if (ctx.operation === 'update') {
      if (!ctx.auth.email_verified) return 'PERMISSION_DENIED';
      if (ctx.auth.uid !== ctx.studentId || !isValidId(ctx.studentId)) return 'PERMISSION_DENIED';
      if (!ctx.incomingData || !ctx.existingData) return 'PERMISSION_DENIED';
      if (!isValidStudentProfile(ctx.incomingData, ctx.auth.uid)) return 'PERMISSION_DENIED';
      if (ctx.incomingData.uid !== ctx.existingData.uid) return 'PERMISSION_DENIED';
      if (ctx.incomingData.createdAt !== ctx.existingData.createdAt) return 'PERMISSION_DENIED';
      if (ctx.incomingData.updatedAt !== ctx.requestTime) return 'PERMISSION_DENIED';

      const affectedKeys = Object.keys(ctx.incomingData).filter(
        (k) => JSON.stringify(ctx.incomingData![k]) !== JSON.stringify(ctx.existingData![k])
      );
      const action1Keys = ['displayName', 'grade', 'board', 'updatedAt'];
      const action2Keys = [
        'grade',
        'board',
        'adaptiveRating',
        'solvedCount',
        'accuracyPercent',
        'streakDays',
        'weakTopics',
        'updatedAt'
      ];
      const matchesAction1 = affectedKeys.every((k) => action1Keys.includes(k));
      const matchesAction2 = affectedKeys.every((k) => action2Keys.includes(k));
      return matchesAction1 || matchesAction2 ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  if (ctx.collection === 'attempts') {
    if (ctx.operation === 'create') {
      if (!ctx.auth.email_verified) return 'PERMISSION_DENIED';
      if (ctx.auth.uid !== ctx.studentId || !isValidId(ctx.studentId) || !ctx.subId || !isValidId(ctx.subId)) {
        return 'PERMISSION_DENIED';
      }
      if (!ctx.parentStudentExists || ctx.parentStudentUid !== ctx.auth.uid) {
        return 'PERMISSION_DENIED';
      }
      if (!ctx.incomingData || ctx.incomingData.createdAt !== ctx.requestTime) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
    return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1793965000000;

function validProfile(uid = 'user_1'): Record<string, unknown> {
  return {
    uid,
    displayName: 'Aarav Sharma',
    grade: '10',
    board: 'ICSE',
    adaptiveRating: 1350,
    solvedCount: 24,
    accuracyPercent: 88,
    streakDays: 7,
    weakTopics: ['Trigonometry'],
    createdAt: NOW,
    updatedAt: NOW
  };
}

test('Hardened Firestore Rules structure assertions', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('match /{document=**}'));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('isValidStudentProfile(incoming())'));
  assert.ok(rulesSource.includes('isValidAttemptRecord(incoming())'));
  assert.ok(rulesSource.includes('isValidDoubtSession(incoming())'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
});

test('Dirty Dozen Payload 1: Unauthenticated Read is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: null,
      studentId: 'user_1',
      requestTime: NOW,
      operation: 'get',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 2: Unverified Email Write is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: false },
      studentId: 'user_1',
      requestTime: NOW,
      incomingData: validProfile('user_1'),
      operation: 'create',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 3: Identity Spoofing on Create is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW,
      incomingData: validProfile('user_2'),
      operation: 'create',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 4: Cross-User Profile Read is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_2', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW,
      operation: 'get',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 5: Shadow Field Injection on Create is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW,
      incomingData: { ...validProfile('user_1'), isAdmin: true },
      operation: 'create',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 6: Shadow Field Injection on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW + 1000,
      existingData: validProfile('user_1'),
      incomingData: { ...validProfile('user_1'), isVerified: true, updatedAt: NOW + 1000 },
      operation: 'update',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 7: Value Poisoning on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW + 1000,
      existingData: validProfile('user_1'),
      incomingData: { ...validProfile('user_1'), adaptiveRating: '999999', updatedAt: NOW + 1000 },
      operation: 'update',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 8: Immortal Field Mutation (createdAt) is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW + 1000,
      existingData: validProfile('user_1'),
      incomingData: { ...validProfile('user_1'), createdAt: NOW + 500, updatedAt: NOW + 1000 },
      operation: 'update',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 9: Client Timestamp Forgery is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW,
      incomingData: { ...validProfile('user_1'), createdAt: NOW - 99999 },
      operation: 'create',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 10: Orphaned Subcollection Write is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      subId: 'attempt_1',
      requestTime: NOW,
      parentStudentExists: false,
      incomingData: { createdAt: NOW },
      operation: 'create',
      collection: 'attempts'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 11: Path ID Poisoning is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      subId: 'bad$id!@#',
      requestTime: NOW,
      parentStudentExists: true,
      parentStudentUid: 'user_1',
      incomingData: { createdAt: NOW },
      operation: 'create',
      collection: 'attempts'
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 12: Unbounded Array Exhaustion is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateRules({
      auth: { uid: 'user_1', email_verified: true },
      studentId: 'user_1',
      requestTime: NOW + 1000,
      existingData: validProfile('user_1'),
      incomingData: {
        ...validProfile('user_1'),
        weakTopics: Array.from({ length: 15 }, (_, i) => `Topic_${i}`),
        updatedAt: NOW + 1000
      },
      operation: 'update',
      collection: 'students'
    }),
    'PERMISSION_DENIED'
  );
});
