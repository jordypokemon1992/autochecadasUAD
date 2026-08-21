// Firebase Web SDK configuration and connection manager
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  Firestore,
  writeBatch
} from 'firebase/firestore';
import { UserCredential, AutomationJob, ExecutionRecord } from '../types';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreCollectionPrefix?: string;
}

const STORAGE_KEY = 'cloudflow_firebase_config';

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

// Get saved config from localStorage or fallback
export function getSavedFirebaseConfig(): FirebaseConfigOptions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading firebase config from localStorage', e);
  }
  return null;
}

// Save config
export function saveFirebaseConfig(config: FirebaseConfigOptions | null) {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error saving firebase config', e);
  }
}

// Initialize or return Firebase instance
export function initFirebase(config: FirebaseConfigOptions): { app: FirebaseApp; db: Firestore } {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0 && appInstance) {
      firestoreInstance = getFirestore(appInstance);
      return { app: appInstance, db: firestoreInstance };
    }

    appInstance = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
      projectId: config.projectId,
      storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });

    firestoreInstance = getFirestore(appInstance);
    return { app: appInstance, db: firestoreInstance };
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
    throw error;
  }
}

export function getFirestoreDB(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  const saved = getSavedFirebaseConfig();
  if (saved && saved.apiKey && saved.projectId) {
    try {
      const { db } = initFirebase(saved);
      return db;
    } catch {
      return null;
    }
  }
  return null;
}

// Collections helper
export const FB_COLLECTIONS = {
  USERS: 'uad_users',
  JOBS: 'uad_jobs',
  EXECUTIONS: 'uad_executions',
  SETTINGS: 'uad_settings'
};

// Sync helpers to Firestore
export async function syncUsersToFirestore(db: Firestore, users: UserCredential[]) {
  const batch = writeBatch(db);
  for (const user of users) {
    const ref = doc(db, FB_COLLECTIONS.USERS, user.id);
    batch.set(ref, user, { merge: true });
  }
  await batch.commit();
}

export async function syncJobsToFirestore(db: Firestore, jobs: AutomationJob[]) {
  const batch = writeBatch(db);
  for (const job of jobs) {
    const ref = doc(db, FB_COLLECTIONS.JOBS, job.id);
    batch.set(ref, job, { merge: true });
  }
  await batch.commit();
}

export async function fetchUsersFromFirestore(db: Firestore): Promise<UserCredential[]> {
  const snap = await getDocs(collection(db, FB_COLLECTIONS.USERS));
  return snap.docs.map(d => d.data() as UserCredential);
}

export async function fetchJobsFromFirestore(db: Firestore): Promise<AutomationJob[]> {
  const snap = await getDocs(collection(db, FB_COLLECTIONS.JOBS));
  return snap.docs.map(d => d.data() as AutomationJob);
}

export async function saveUserToFirestore(db: Firestore, user: UserCredential) {
  const ref = doc(db, FB_COLLECTIONS.USERS, user.id);
  await setDoc(ref, user, { merge: true });
}

export async function deleteUserFromFirestore(db: Firestore, userId: string) {
  const ref = doc(db, FB_COLLECTIONS.USERS, userId);
  await deleteDoc(ref);
}

export async function saveJobToFirestore(db: Firestore, job: AutomationJob) {
  const ref = doc(db, FB_COLLECTIONS.JOBS, job.id);
  await setDoc(ref, job, { merge: true });
}
