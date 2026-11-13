import { CustomVoicePersona, GeneratedClip } from "../types/tts";

const DB_NAME = "cadence_studio_db";
const DB_VERSION = 1;
const CLIPS_STORE = "clips";
const PERSONAS_KEY = "cadence_custom_personas_v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CLIPS_STORE)) {
        db.createObjectStore(CLIPS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSavedClips(): Promise<GeneratedClip[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CLIPS_STORE, "readonly");
      const store = tx.objectStore(CLIPS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const clips = (req.result as GeneratedClip[]) || [];
        clips.sort((a, b) => b.createdAt - a.createdAt);
        resolve(clips);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveClip(clip: GeneratedClip): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CLIPS_STORE, "readwrite");
      const store = tx.objectStore(CLIPS_STORE);
      store.put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota issues silently while keeping session playback working
  }
}

export async function deleteClipById(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CLIPS_STORE, "readwrite");
      const store = tx.objectStore(CLIPS_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage errors
  }
}

export function loadCustomPersonas(): CustomVoicePersona[] {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPersonas(personas: CustomVoicePersona[]): void {
  try {
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(personas));
  } catch {
    // Ignore storage errors
  }
}
