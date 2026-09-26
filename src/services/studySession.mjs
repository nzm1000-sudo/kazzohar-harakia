// Active Study Session Engine — "לימוד תורה" tracking by active time
// Tracks actual engaged study time, not just completion clicks.
// Local-first, no external transmission.

const STORAGE_KEY = 'kz-study-sessions-v1';
const SCHEMA_VERSION = 1;

// Minimum active seconds before a study session becomes a recorded event
export const MIN_ACTIVE_SECONDS = 60;

// Idle timeout: pause counting after this many seconds of no meaningful interaction
export const IDLE_TIMEOUT_SECONDS = 5 * 60; // 5 minutes

// Session gap: if user returns within this time, resume the same logical session
export const SESSION_RESUME_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const defaultStorage = () => {
  try { return globalThis.localStorage || null; } catch { return null; }
};

function read(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], activeSession: null, schemaVersion: SCHEMA_VERSION };
    const parsed = JSON.parse(raw);
    if (!parsed.schemaVersion) {
      return { sessions: parsed.sessions || [], activeSession: parsed.activeSession || null, schemaVersion: SCHEMA_VERSION };
    }
    if (parsed.schemaVersion > SCHEMA_VERSION) {
      return { sessions: parsed.sessions || [], activeSession: parsed.activeSession || null, schemaVersion: parsed.schemaVersion };
    }
    return { sessions: parsed.sessions || [], activeSession: parsed.activeSession || null, schemaVersion: parsed.schemaVersion };
  } catch {
    return { sessions: [], activeSession: null, schemaVersion: SCHEMA_VERSION };
  }
}

function write(data, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or private mode - silently fail
  }
}

// Check if the page/app is visible (not backgrounded)
function isPageVisible() {
  if (typeof document === 'undefined') return true;
  return !document.hidden;
}

// Generate a deterministic session key for duplicate protection
function generateSessionKey(session) {
  const base = `${session.workId}|${session.unitId || ''}|${session.jewishDate}|${session.source}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Get current Jewish date string
import { civilDateKey } from '../civilDate.mjs';

export function getJewishDateKey(now = new Date(), tzid = 'Asia/Jerusalem') {
  return civilDateKey(now, tzid);
}

// Create a new pending study session
export function createPendingSession({
  workId,
  workTitle,
  unitId = null,
  unitLabel = null,
  category = 'torah_study',
  source = 'reader',
  tzid = 'Asia/Jerusalem',
}) {
  const now = new Date();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workId,
    workTitle,
    unitId,
    unitLabel,
    category,
    source,
    startedAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    activeSeconds: 0,
    jewishDate: getJewishDateKey(now, tzid),
    tzid,
    status: 'pending', // 'pending' | 'active' | 'paused' | 'completed'
    sessionKey: null, // Will be set when becomes active
  };
}

// Start or resume a study session
export function startStudySession(sessionData, storage = defaultStorage()) {
  const data = read(storage);
  const session = { ...sessionData, sessionKey: generateSessionKey(sessionData) };
  
  // Check if there's a recent paused session for the same work/unit that can be resumed
  if (data.activeSession && data.activeSession.sessionKey === session.sessionKey) {
    const lastActive = new Date(data.activeSession.lastActiveAt);
    const gap = Date.now() - lastActive.getTime();
    if (gap < SESSION_RESUME_WINDOW_MS) {
      // Resume existing session
      session.activeSeconds = data.activeSession.activeSeconds;
      session.startedAt = data.activeSession.startedAt;
      session.id = data.activeSession.id;
    }
  }
  
  data.activeSession = { ...session, status: 'active' };
  write(data, storage);
  return data.activeSession;
}

// Record meaningful user interaction (scroll, navigation, etc.)
export function recordInteraction(storage = defaultStorage()) {
  const data = read(storage);
  if (!data.activeSession || data.activeSession.status !== 'active') return null;
  
  const now = new Date();
  const lastActive = new Date(data.activeSession.lastActiveAt);
  const deltaSeconds = Math.floor((now - lastActive) / 1000);
  
  // Only count time if the gap is reasonable (not idle timeout)
  if (deltaSeconds <= IDLE_TIMEOUT_SECONDS) {
    data.activeSession.activeSeconds += deltaSeconds;
  }
  // If gap > IDLE_TIMEOUT_SECONDS, we don't add the idle time
  
  data.activeSession.lastActiveAt = now.toISOString();
  
  // Auto-promote from pending to active after MIN_ACTIVE_SECONDS
  if (data.activeSession.status === 'pending' && data.activeSession.activeSeconds >= MIN_ACTIVE_SECONDS) {
    data.activeSession.status = 'active';
  }
  
  write(data, storage);
  return data.activeSession;
}

// Pause the current study session
export function pauseStudySession(storage = defaultStorage()) {
  const data = read(storage);
  if (!data.activeSession) return null;
  
  recordInteraction(storage); // Finalize current active time
  
  data.activeSession.status = 'paused';
  write(data, storage);
  return data.activeSession;
}

// Complete and save the study session as a learning event
export function completeStudySession(storage = defaultStorage()) {
  const data = read(storage);
  if (!data.activeSession) return { saved: false };
  
  recordInteraction(storage); // Finalize current active time
  
  const session = data.activeSession;
  
  // Only save if it reached the minimum active time
  if (session.activeSeconds < MIN_ACTIVE_SECONDS) {
    // Discard sessions under the threshold
    data.activeSession = null;
    write(data, storage);
    return { saved: false, reason: 'below_threshold', activeSeconds: session.activeSeconds };
  }
  
  // Create the learning event
  const event = {
    id: session.id,
    category: session.category,
    workId: session.workId,
    workTitle: session.workTitle,
    unitId: session.unitId,
    unitLabel: session.unitLabel,
    source: session.source,
    startedAt: session.startedAt,
    endedAt: new Date().toISOString(),
    activeSeconds: session.activeSeconds,
    jewishDate: session.jewishDate,
    tzid: session.tzid,
    schemaVersion: SCHEMA_VERSION,
  };
  
  data.sessions.push(event);
  data.activeSession = null;
  write(data, storage);
  
  return { 
    saved: true, 
    event,
    minutes: Math.round(session.activeSeconds / 60),
  };
}

// Get all completed study sessions
export function getStudySessions({ fromDate, toDate, category } = {}, storage = defaultStorage()) {
  const data = read(storage);
  let sessions = [...data.sessions].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
  
  if (category) sessions = sessions.filter(s => s.category === category);
  if (fromDate) sessions = sessions.filter(s => s.jewishDate >= fromDate);
  if (toDate) sessions = sessions.filter(s => s.jewishDate <= toDate);
  
  return sessions;
}

// Aggregate study time by category/work for a date range
export function aggregateStudyTime(sessions) {
  const byCategory = {};
  let totalMinutes = 0;
  
  for (const session of sessions) {
    const minutes = Math.round(session.activeSeconds / 60);
    totalMinutes += minutes;
    
    const catKey = session.category;
    if (!byCategory[catKey]) {
      byCategory[catKey] = { totalMinutes: 0, byWork: {} };
    }
    byCategory[catKey].totalMinutes += minutes;
    
    const workKey = session.workId;
    if (!byCategory[catKey].byWork[workKey]) {
      byCategory[catKey].byWork[workKey] = {
        title: session.workTitle,
        totalMinutes: 0,
        sessions: 0,
      };
    }
    byCategory[catKey].byWork[workKey].totalMinutes += minutes;
    byCategory[catKey].byWork[workKey].sessions += 1;
  }
  
  return { totalMinutes, byCategory };
}

// Clear all sessions (for testing only)
export function _clearAllSessions(storage = defaultStorage()) {
  write({ sessions: [], activeSession: null, schemaVersion: SCHEMA_VERSION }, storage);
}

export const STORAGE_KEY_EXPORT = STORAGE_KEY;