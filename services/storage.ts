
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Riddle, Attempt, UserProfile } from '../types';

interface TebakAIDB extends DBSchema {
  riddles: {
    key: string;
    value: Riddle;
  };
  attempts: {
    key: number;
    value: Attempt;
    indexes: { 'by-riddle': string };
  };
  user_profile: {
    key: string;
    value: UserProfile & { key: string };
  };
}

const DB_NAME = 'TebakAI_DB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TebakAIDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<TebakAIDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store Riddles
        if (!db.objectStoreNames.contains('riddles')) {
          db.createObjectStore('riddles', { keyPath: 'id' });
        }
        // Store User Attempts
        if (!db.objectStoreNames.contains('attempts')) {
          const attemptStore = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
          attemptStore.createIndex('by-riddle', 'riddleId');
        }
        // Store User Analysis/Profile
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
};

// --- Riddle Operations ---

export const saveRiddleToDB = async (riddle: Riddle) => {
  const db = await initDB();
  await db.put('riddles', riddle);
};

export const getRiddleFromDB = async (id: string) => {
  const db = await initDB();
  return db.get('riddles', id);
};

export const updateRiddleSynonyms = async (id: string, newSynonym: string) => {
  const db = await initDB();
  const riddle = await db.get('riddles', id);
  if (riddle) {
    const updatedSynonyms = [...new Set([...riddle.acceptedAnswers, newSynonym])];
    await db.put('riddles', { ...riddle, acceptedAnswers: updatedSynonyms });
  }
};

// --- Attempt Operations ---

export const saveAttemptToDB = async (attempt: Attempt) => {
  const db = await initDB();
  await db.add('attempts', attempt);
};

export const getAttemptCount = async () => {
  const db = await initDB();
  return db.count('attempts');
};

export const getRecentAttempts = async (limit: number = 20) => {
  const db = await initDB();
  // Get all attempts, sort by ID descending (newest first)
  const allAttempts = await db.getAll('attempts');
  return allAttempts.sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, limit);
};

// --- User Profile Operations ---

export const saveUserProfile = async (persona: string) => {
  const db = await initDB();
  await db.put('user_profile', { key: 'main', persona, lastUpdated: Date.now() });
};

export const getUserProfile = async (): Promise<string | null> => {
  const db = await initDB();
  const profile = await db.get('user_profile', 'main');
  return profile ? profile.persona : null;
};
