import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
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
import { sanitizeStudentProfilePayload, AttemptEntry, GradeLevel, CurriculumBoard } from './utils/adaptiveEngine';

// Silence noisy internal @firebase/firestore console.error logs when operating in offline/local mode
setLogLevel('silent');

// Clear any stale IndexedDB Firebase Auth tokens from previous/expired API keys so they never block Firestore on boot
if (typeof window !== 'undefined' && 'indexedDB' in window) {
  try {
    window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
  } catch {
    // Ignore if blocked
  }
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

let isCloudAvailable = true;

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
  // Gracefully switch to local storage mode if the client is offline or has a stale/invalid API key token
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

// Validate connection to Firestore on boot and clear stale cached auth tokens if project key is invalid
async function testConnection() {
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
testConnection();

export { onAuthStateChanged, signInWithPopup, signOut };
export type { User };

export async function syncStudentProfileToCloud(profileInput: {
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

export async function fetchStudentCloudState(uid: string) {
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

export async function logAttemptToCloud(uid: string, attempt: AttemptEntry) {
  if (!isCloudAvailable || !auth.currentUser || auth.currentUser.uid !== uid) return;
  const safeAttemptId = attempt.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || `att_${Date.now()}`;
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

export async function saveDoubtToCloud(
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
  const safeDoubtId = doubt.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || `dbt_${Date.now()}`;
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
