import type { AttemptEntry, CurriculumBoard, GradeLevel } from './utils/adaptiveEngine';

export interface CloudUserLike {
  uid: string;
  displayName: string | null;
  email: string | null;
}

type FirebaseCoreModule = typeof import('./firebaseCore');
let corePromise: Promise<FirebaseCoreModule> | null = null;

function loadFirebaseCore(): Promise<FirebaseCoreModule> {
  if (!corePromise) {
    corePromise = import('./firebaseCore');
  }
  return corePromise;
}

/**
 * Defers loading Firebase Auth/Firestore until after initial paint so phones
 * never stall on the boot spinner waiting for Firebase SDK + IndexedDB init.
 */
export function subscribeAuthState(callback: (user: CloudUserLike | null) => void): () => void {
  let cancelled = false;
  let unsubscribeCore: (() => void) | null = null;

  const start = () => {
    if (cancelled) return;
    loadFirebaseCore()
      .then((core) => {
        if (cancelled) return;
        unsubscribeCore = core.subscribeAuthStateCore((u) => {
          if (!cancelled) {
            callback(u ? { uid: u.uid, displayName: u.displayName, email: u.email } : null);
          }
        });
      })
      .catch(() => {
        // Offline / blocked storage fallback — local workspace stays fully operational
      });
  };

  const timer = typeof window !== 'undefined' ? window.setTimeout(start, 900) : null;

  return () => {
    cancelled = true;
    if (timer !== null && typeof window !== 'undefined') {
      window.clearTimeout(timer);
    }
    unsubscribeCore?.();
  };
}

export async function signInWithGoogle(): Promise<CloudUserLike | null> {
  const core = await loadFirebaseCore();
  const user = await core.signInWithGoogleCore();
  return user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null;
}

export async function signOutFromCloud(): Promise<void> {
  if (!corePromise) return;
  const core = await loadFirebaseCore();
  await core.signOutCore();
}

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
  const core = await loadFirebaseCore();
  return core.syncStudentProfileToCloudCore(profileInput);
}

export async function fetchStudentCloudState(uid: string) {
  const core = await loadFirebaseCore();
  return core.fetchStudentCloudStateCore(uid);
}

export async function logAttemptToCloud(uid: string, attempt: AttemptEntry) {
  const core = await loadFirebaseCore();
  return core.logAttemptToCloudCore(uid, attempt);
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
  const core = await loadFirebaseCore();
  return core.saveDoubtToCloudCore(uid, doubt);
}

export async function fetchCloudDoubts(uid: string) {
  const core = await loadFirebaseCore();
  return core.fetchCloudDoubtsCore(uid);
}
