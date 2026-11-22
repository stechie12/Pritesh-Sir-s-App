import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  sanitizeStudentProfilePayload,
  type AttemptEntry,
  type GradeLevel,
  type CurriculumBoard,
} from './utils/adaptiveEngine';

setLogLevel('silent');

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

let isCloudAvailable = true;
let connectionTested = false;

function isOfflineOrInvalidKeyError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('client is offline') ||
    msg.includes('api-key-not-valid') ||
    msg.includes('fetching auth token failed') ||
    msg.includes('network-request-failed') ||
    msg.includes('unavailable')
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isOfflineOrInvalidKeyError(error)) {
    isCloudAvailable = false;
    signOut(auth).catch(() => {});
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function ensureConnectionTested() {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isCloudAvailable = true;
  } catch (error) {
    if (isOfflineOrInvalidKeyError(error)) {
      isCloudAvailable = false;
      signOut(auth).catch(() => {});
    }
  }
}

export function subscribeAuthStateCore(callback: (user: User | null) => void): () => void {
  void ensureConnectionTested();
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogleCore(): Promise<User | null> {
  await ensureConnectionTested();
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutCore(): Promise<void> {
  await signOut(auth);
}

export async function syncStudentProfileToCloudCore(profileInput: {
  uid: string;
  displayName: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  adaptiveRating: number;
  solvedCount: number;
  accuracyPercent: number;
  streakDays: number;
  weakTopics: string[];
}) {
  if (!isCloudAvailable || !auth.currentUser || auth.currentUser.uid !== profileInput.uid) return;
  const clean = sanitizeStudentProfilePayload(profileInput);
  const studentPath = `students/${clean.uid}`;
  const studentRef = doc(db, 'students', clean.uid);

  try {
    const existingSnap = await getDoc(studentRef);
    if (!existingSnap.exists()) {
      await setDoc(studentRef, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(studentRef, {
        grade: clean.grade,
        board: clean.board,
        adaptiveRating: clean.adaptiveRating,
        solvedCount: clean.solvedCount,
        accuracyPercent: clean.accuracyPercent,
        streakDays: clean.streakDays,
        weakTopics: clean.weakTopics,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, studentPath);
  }
}

export async function fetchStudentCloudStateCore(uid: string) {
  if (!isCloudAvailable) return null;
  const studentPath = `students/${uid}`;
  try {
    const studentRef = doc(db, 'students', uid);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return null;

    const attemptsPath = `students/${uid}/attempts`;
    const attemptsQuery = query(
      collection(db, 'students', uid, 'attempts'),
      where('uid', '==', uid)
    );
    let cloudAttempts: AttemptEntry[] = [];
    try {
      const attSnaps = await getDocs(attemptsQuery);
      cloudAttempts = attSnaps.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          problemId: String(data.problemId || ''),
          chapter: String(data.chapter || ''),
          grade: (data.grade || '10') as GradeLevel,
          board: (data.board || 'ICSE') as CurriculumBoard,
          difficulty: (data.difficulty || 'Standard') as AttemptEntry['difficulty'],
          isCorrect: Boolean(data.isCorrect),
          timeSpentSec: Number(data.timeSpentSec || 20),
          ratingDelta: Number(data.ratingDelta || 0),
          timestamp: new Date().toISOString(),
        };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, attemptsPath);
    }

    return {
      profile: snap.data(),
      attempts: cloudAttempts,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, studentPath);
    return null;
  }
}

export async function logAttemptToCloudCore(uid: string, attempt: AttemptEntry) {
  if (!isCloudAvailable || !auth.currentUser || auth.currentUser.uid !== uid) return;
  const safeAttemptId =
    attempt.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || `att_${Date.now()}`;
  const path = `students/${uid}/attempts/${safeAttemptId}`;
  try {
    await setDoc(doc(db, 'students', uid, 'attempts', safeAttemptId), {
      uid,
      problemId: attempt.problemId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64),
      chapter: attempt.chapter.slice(0, 100),
      grade: attempt.grade,
      board: attempt.board,
      difficulty: attempt.difficulty,
      isCorrect: attempt.isCorrect,
      timeSpentSec: Math.max(0, Math.min(7200, Math.round(attempt.timeSpentSec))),
      ratingDelta: Math.max(-200, Math.min(200, Math.round(attempt.ratingDelta))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDoubtToCloudCore(
  uid: string,
  doubt: {
    id: string;
    grade: GradeLevel;
    board: CurriculumBoard;
    topic: string;
    question: string;
    answer: string;
  }
) {
  if (!isCloudAvailable || !auth.currentUser || auth.currentUser.uid !== uid) return;
  const safeDoubtId =
    doubt.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || `dbt_${Date.now()}`;
  const path = `students/${uid}/doubts/${safeDoubtId}`;
  try {
    await setDoc(doc(db, 'students', uid, 'doubts', safeDoubtId), {
      uid,
      grade: doubt.grade,
      board: doubt.board,
      topic: doubt.topic.slice(0, 100) || 'Mathematics',
      question: doubt.question.slice(0, 1000),
      answer: doubt.answer.slice(0, 4000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchCloudDoubtsCore(uid: string): Promise<
  Array<{
    id: string;
    grade: GradeLevel;
    board: CurriculumBoard;
    topic: string;
    question: string;
    answer: string;
    createdAtMs: number;
  }>
> {
  if (!isCloudAvailable || !auth.currentUser || auth.currentUser.uid !== uid) return [];
  const doubtsPath = `students/${uid}/doubts`;
  try {
    const doubtsQuery = query(
      collection(db, 'students', uid, 'doubts'),
      where('uid', '==', uid)
    );
    const snap = await getDocs(doubtsQuery);
    return snap.docs.map((d) => {
      const data = d.data();
      const ts =
        data.createdAt && typeof data.createdAt.toMillis === 'function'
          ? data.createdAt.toMillis()
          : Date.now();
      return {
        id: d.id,
        grade: (['8', '9', '10', '11', '12'].includes(String(data.grade))
          ? String(data.grade)
          : '10') as GradeLevel,
        board: (data.board === 'CBSE' ? 'CBSE' : 'ICSE') as CurriculumBoard,
        topic: String(data.topic || 'Mathematics'),
        question: String(data.question || ''),
        answer: String(data.answer || ''),
        createdAtMs: ts,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, doubtsPath);
    return [];
  }
}
