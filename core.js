export const CURRENT_SCHEMA_VERSION = 2;

export function makeStableId(prefix = "item") {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function elapsedTimerSeconds(timer, now = Date.now()) {
  const previous = Number(timer.elapsedBeforeStart || 0);
  const current = timer.running && timer.startedAt
    ? Math.max(0, (now - Number(timer.startedAt)) / 1000)
    : 0;
  return Math.min(Number(timer.totalSeconds || 0), Math.max(0, previous + current));
}

export function remainingTimerSeconds(timer, now = Date.now()) {
  return Math.max(0, Number(timer.totalSeconds || 0) - elapsedTimerSeconds(timer, now));
}

export function buildCalendarDays(year, month, mondayFirst = true) {
  const first = new Date(year, month, 1);
  const firstOffset = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
  const monthDays = new Date(year, month + 1, 0).getDate();
  const cellCount = firstOffset + monthDays > 35 ? 42 : 35;
  const start = new Date(year, month, 1 - firstOffset);
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: localDateKey(date),
      inCurrentMonth: date.getMonth() === month
    };
  });
}

export function sessionDurationSeconds(session) {
  if (Number.isFinite(Number(session.durationSeconds))) {
    return Math.max(0, Number(session.durationSeconds));
  }
  return Math.max(0, Number(session.minutes || 0) * 60);
}

export function sumSessionSeconds(sessions, dateKey = null) {
  return sessions
    .filter((session) => !dateKey || session.date === dateKey)
    .reduce((sum, session) => sum + sessionDurationSeconds(session), 0);
}

export function calculateStreak(sessions, today = new Date()) {
  let count = 0;
  const cursor = new Date(today);
  while (sumSessionSeconds(sessions, localDateKey(cursor)) > 0) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function normalizeRecord(record, prefix, now) {
  return {
    ...record,
    id: record.id || makeStableId(prefix),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || record.createdAt || now,
    version: Number(record.version || 1)
  };
}

export function migrateState(input, defaults) {
  const now = new Date().toISOString();
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  const migrated = {
    ...structuredClone(defaults),
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...defaults.settings, ...(source.settings || {}) },
    mantra: { ...defaults.mantra, ...(source.mantra || {}) },
    sessions: Array.isArray(source.sessions)
      ? source.sessions.map((session) => normalizeRecord({
          ...session,
          durationSeconds: sessionDurationSeconds(session)
        }, "session", now))
      : [],
    journals: Array.isArray(source.journals)
      ? source.journals.map((entry) => normalizeRecord(entry, "journal", now))
      : [],
    practices: (Array.isArray(source.practices) ? source.practices : defaults.practices)
      .map((practice) => normalizeRecord({
          ...practice,
          archived: Boolean(practice.archived)
        }, "practice", now)),
    deletedItems: Array.isArray(source.deletedItems) ? source.deletedItems : [],
    accumulations: Array.isArray(source.accumulations) ? source.accumulations : [],
    routines: Array.isArray(source.routines) ? source.routines : [],
    calendarEvents: Array.isArray(source.calendarEvents) ? source.calendarEvents : []
  };
  migrated.mantra.history = Array.isArray(migrated.mantra.history)
    ? migrated.mantra.history.map((entry) => normalizeRecord(entry, "mantra", now))
    : [];
  return migrated;
}

export function validateBackup(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["La racine doit etre un objet JSON."] };
  }
  const arrayFields = ["sessions", "journals", "practices"];
  for (const field of arrayFields) {
    if (value[field] !== undefined && !Array.isArray(value[field])) {
      errors.push(`Le champ ${field} doit etre une liste.`);
    }
  }
  if (value.settings !== undefined && (!value.settings || typeof value.settings !== "object" || Array.isArray(value.settings))) {
    errors.push("Le champ settings doit etre un objet.");
  }
  if (Array.isArray(value.sessions)) {
    value.sessions.forEach((session, index) => {
      if (!session || typeof session !== "object" || typeof session.date !== "string") {
        errors.push(`Session ${index + 1}: date manquante ou invalide.`);
      }
      if (!Number.isFinite(Number(session.durationSeconds ?? Number(session.minutes || 0) * 60))) {
        errors.push(`Session ${index + 1}: duree invalide.`);
      }
    });
  }
  if (Array.isArray(value.journals)) {
    value.journals.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || typeof entry.date !== "string" || typeof entry.title !== "string") {
        errors.push(`Note ${index + 1}: titre ou date manquant.`);
      }
    });
  }
  if (Array.isArray(value.practices)) {
    value.practices.forEach((practice, index) => {
      if (!practice || typeof practice !== "object" || typeof practice.title !== "string") {
        errors.push(`Pratique ${index + 1}: titre manquant.`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

export function mergeById(existing = [], incoming = []) {
  const merged = new Map();
  [...existing, ...incoming].forEach((item) => {
    const id = item.id || makeStableId("import");
    const previous = merged.get(id);
    if (!previous || String(item.updatedAt || "") >= String(previous.updatedAt || "")) {
      merged.set(id, { ...item, id });
    }
  });
  return [...merged.values()];
}

export function mergeImportedState(current, imported, defaults) {
  const normalized = migrateState(imported, defaults);
  return migrateState({
    ...current,
    ...normalized,
    settings: { ...current.settings, ...normalized.settings },
    sessions: mergeById(current.sessions, normalized.sessions),
    journals: mergeById(current.journals, normalized.journals),
    practices: mergeById(current.practices, normalized.practices),
    deletedItems: mergeById(current.deletedItems, normalized.deletedItems),
    accumulations: mergeById(current.accumulations, normalized.accumulations),
    routines: mergeById(current.routines, normalized.routines),
    calendarEvents: mergeById(current.calendarEvents, normalized.calendarEvents)
  }, defaults);
}

export function removeWithUndo(state, collection, id, now = new Date().toISOString()) {
  const items = state[collection];
  if (!Array.isArray(items)) return null;
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [item] = items.splice(index, 1);
  const deleted = {
    id: makeStableId("deleted"),
    collection,
    index,
    item,
    deletedAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  state.deletedItems = Array.isArray(state.deletedItems) ? state.deletedItems : [];
  state.deletedItems.push(deleted);
  return deleted;
}

export function restoreLastDeleted(state) {
  const deleted = state.deletedItems?.pop();
  if (!deleted || !Array.isArray(state[deleted.collection])) return null;
  const target = state[deleted.collection];
  target.splice(Math.min(Number(deleted.index || 0), target.length), 0, deleted.item);
  return deleted.item;
}
