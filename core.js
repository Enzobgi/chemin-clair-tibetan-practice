export const CURRENT_SCHEMA_VERSION = 7;

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
  if (session.summaryOnly) return 0;
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

export function routineDurationSeconds(routine) {
  return (routine.steps || []).reduce((sum, step) => sum + Math.max(0, Number(step.minutes || 0) * 60), 0);
}

export function accumulationTotal(accumulation) {
  return (accumulation.entries || []).reduce((sum, entry) => sum + Number(entry.count || 0), 0);
}

export function accumulationPeriodTotal(accumulation, days = 7, end = new Date()) {
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - Math.max(1, Number(days || 1)) + 1);
  startDate.setHours(0, 0, 0, 0);
  return (accumulation.entries || []).reduce((sum, entry) => {
    const date = new Date(`${entry.date}T12:00:00`);
    return date >= startDate && date <= endDate ? sum + Number(entry.count || 0) : sum;
  }, 0);
}

export function accumulationPace(accumulation, end = new Date()) {
  const positiveEntries = (accumulation.entries || []).filter((entry) => Number(entry.count || 0) > 0);
  const start = accumulation.startDate || positiveEntries.map((entry) => entry.date).sort()[0];
  if (!start) return { dailyAverage: 0, estimatedDaysRemaining: null };
  const elapsedDays = Math.max(1, Math.floor((new Date(end) - new Date(`${start}T00:00:00`)) / 86400000) + 1);
  const dailyAverage = positiveEntries.reduce((sum, entry) => sum + Number(entry.count || 0), 0) / elapsedDays;
  const remaining = Math.max(0, Number(accumulation.target || 0) - accumulationTotal(accumulation));
  return {
    dailyAverage,
    estimatedDaysRemaining: dailyAverage > 0 && remaining > 0 ? Math.ceil(remaining / dailyAverage) : null
  };
}

export function sessionsByDay(sessions, days = 7, end = new Date()) {
  const result = [];
  const cursor = new Date(end);
  cursor.setHours(12, 0, 0, 0);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() - offset);
    result.push({
      date: localDateKey(date),
      seconds: sumSessionSeconds(sessions, localDateKey(date))
    });
  }
  return result;
}

function normalizeRecord(record = {}, prefix, now, fallbackId = "") {
  return {
    ...record,
    id: record.id || fallbackId || makeStableId(prefix),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || record.createdAt || now,
    version: Math.max(1, Number(record.version || 1))
  };
}

function normalizeTombstone(record, now) {
  const itemId = record.itemId || record.item?.id || "";
  const collection = record.collection || "";
  return normalizeRecord({
    ...record,
    id: itemId && collection ? `tombstone:${collection}:${itemId}` : record.id,
    itemId,
    collection,
    deletedAt: record.deletedAt || record.updatedAt || now
  }, "tombstone", now, itemId && collection ? `tombstone:${collection}:${itemId}` : "");
}

export function migrateState(input, defaults) {
  const now = new Date().toISOString();
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  const migrated = {
    ...structuredClone(defaults),
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...defaults.settings, ...(source.settings || {}) },
    mantra: normalizeRecord({
      ...defaults.mantra,
      ...(source.mantra || {})
    }, "mantra-state", now, "mantra-state"),
    sessions: Array.isArray(source.sessions)
      ? source.sessions.map((session) => normalizeRecord({
          ...session,
          durationSeconds: sessionDurationSeconds(session)
        }, "session", now))
      : [],
    journals: Array.isArray(source.journals)
      ? source.journals.map((entry) => normalizeRecord({
          type: entry.type || "quick",
          tags: Array.isArray(entry.tags) ? entry.tags : [],
          favorite: Boolean(entry.favorite),
          agitation: entry.agitation || "non precisee",
          torpor: entry.torpor || "non precisee",
          clarity: entry.clarity || "non precisee",
          emotion: entry.emotion || "",
          sessionId: entry.sessionId || "",
          image: entry.image && typeof entry.image === "object" ? entry.image : null,
          ...entry
        }, "journal", now))
      : [],
    journalTags: Array.isArray(source.journalTags)
      ? source.journalTags.map((tag) => normalizeRecord(tag, "journal-tag", now))
      : [],
    practices: (Array.isArray(source.practices) ? source.practices : defaults.practices)
      .map((practice) => normalizeRecord({
          mantraName: "",
          mantraCount: 0,
          ...practice,
          mantraCount: Math.max(0, Math.round(Number(practice.mantraCount || 0))),
          archived: Boolean(practice.archived),
          detailedSteps: Array.isArray(practice.detailedSteps)
            ? practice.detailedSteps.map((step) => normalizeRecord({
                original: "",
                transliteration: "",
                phonetic: "",
                translation: "",
                commentary: "",
                ...step
              }, "practice-step", now))
            : []
        }, "practice", now)),
    deletedItems: Array.isArray(source.deletedItems)
      ? source.deletedItems.map((item) => normalizeTombstone(item, now))
      : [],
    accumulations: Array.isArray(source.accumulations)
      ? source.accumulations.map((item) => normalizeRecord({
          ...item,
          archived: Boolean(item.archived),
          entries: Array.isArray(item.entries)
            ? item.entries.map((entry) => normalizeRecord(entry, "accumulation-entry", now))
            : []
        }, "accumulation", now))
      : [],
    routines: (Array.isArray(source.routines) && (source.routines.length || Number(source.schemaVersion || 0) >= 3)
      ? source.routines
      : defaults.routines || [])
      .map((routine) => normalizeRecord({
          ...routine,
          archived: Boolean(routine.archived),
          days: Array.isArray(routine.days) ? routine.days : [],
          steps: Array.isArray(routine.steps)
            ? routine.steps.map((step) => normalizeRecord(step, "routine-step", now))
            : []
        }, "routine", now)),
    retreats: Array.isArray(source.retreats)
      ? source.retreats.map((retreat) => normalizeRecord({
          ...retreat,
          archived: Boolean(retreat.archived),
          days: Array.isArray(retreat.days)
            ? retreat.days.map((day) => normalizeRecord(day, "retreat-day", now))
            : []
        }, "retreat", now))
      : [],
    libraryItems: Array.isArray(source.libraryItems)
      ? source.libraryItems.map((item) => normalizeRecord({
          ...item,
          favorite: Boolean(item.favorite),
          private: item.private !== false,
          tags: Array.isArray(item.tags) ? item.tags : []
        }, "library", now))
      : [],
    audioItems: Array.isArray(source.audioItems)
      ? source.audioItems.map((item) => normalizeRecord(item, "audio", now))
      : [],
    reminders: Array.isArray(source.reminders)
      ? source.reminders.map((item) => normalizeRecord({
          ...item,
          enabled: Boolean(item.enabled),
          days: Array.isArray(item.days) ? item.days : []
        }, "reminder", now))
      : [],
    calendarEvents: Array.isArray(source.calendarEvents)
      ? source.calendarEvents.map((item) => normalizeRecord(item, "calendar-event", now))
      : []
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
  const arrayFields = ["sessions", "journals", "journalTags", "practices", "routines", "accumulations", "retreats", "libraryItems", "audioItems", "reminders", "calendarEvents"];
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

function canonicalValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareRecords(left = {}, right = {}) {
  const versionDifference = Number(left.version || 0) - Number(right.version || 0);
  if (versionDifference) return versionDifference;
  const updatedDifference = String(left.updatedAt || "").localeCompare(String(right.updatedAt || ""));
  if (updatedDifference) return updatedDifference;
  return canonicalValue(left).localeCompare(canonicalValue(right));
}

function compareRecordFields(left, right, field) {
  const leftVersion = Number(left.fieldVersions?.[field] ?? left.version ?? 0);
  const rightVersion = Number(right.fieldVersions?.[field] ?? right.version ?? 0);
  if (leftVersion !== rightVersion) return leftVersion - rightVersion;
  const leftUpdatedAt = String(left.fieldUpdatedAt?.[field] || left.updatedAt || "");
  const rightUpdatedAt = String(right.fieldUpdatedAt?.[field] || right.updatedAt || "");
  const updatedDifference = leftUpdatedAt.localeCompare(rightUpdatedAt);
  if (updatedDifference) return updatedDifference;
  return canonicalValue(left[field]).localeCompare(canonicalValue(right[field]));
}

function mergeRecordFields(existing, incoming, excludedFields = []) {
  const incomingWins = compareRecords(incoming, existing) >= 0;
  const newer = incomingWins ? incoming : existing;
  const older = incomingWins ? existing : incoming;
  const excluded = new Set(["id", "createdAt", "updatedAt", "version", "fieldVersions", "fieldUpdatedAt", ...excludedFields]);
  const merged = { ...older, ...newer };
  const fields = new Set([...Object.keys(existing || {}), ...Object.keys(incoming || {})]);
  fields.forEach((field) => {
    if (excluded.has(field)) return;
    if (!Object.hasOwn(incoming, field)) {
      merged[field] = existing[field];
      return;
    }
    if (!Object.hasOwn(existing, field)) {
      merged[field] = incoming[field];
      return;
    }
    merged[field] = compareRecordFields(incoming, existing, field) >= 0 ? incoming[field] : existing[field];
  });
  merged.fieldVersions = { ...(older.fieldVersions || {}), ...(newer.fieldVersions || {}) };
  merged.fieldUpdatedAt = { ...(older.fieldUpdatedAt || {}), ...(newer.fieldUpdatedAt || {}) };
  fields.forEach((field) => {
    if (excluded.has(field)) return;
    const source = !Object.hasOwn(incoming, field)
      ? existing
      : (!Object.hasOwn(existing, field) || compareRecordFields(incoming, existing, field) >= 0 ? incoming : existing);
    if (source.fieldVersions?.[field] !== undefined) merged.fieldVersions[field] = source.fieldVersions[field];
    if (source.fieldUpdatedAt?.[field]) merged.fieldUpdatedAt[field] = source.fieldUpdatedAt[field];
  });
  return merged;
}

function mergeNestedRecords(existing, incoming, nestedFields = []) {
  const incomingWins = compareRecords(incoming, existing) >= 0;
  const newer = incomingWins ? incoming : existing;
  const older = incomingWins ? existing : incoming;
  const merged = mergeRecordFields(existing, incoming, nestedFields);
  nestedFields.forEach((field) => {
    const combined = mergeById(existing?.[field], incoming?.[field]);
    const records = new Map(combined.map((item) => [item.id, item]));
    const preferredOrder = [...(newer?.[field] || []), ...(older?.[field] || [])]
      .map((item) => item.id)
      .filter((id, index, ids) => id && ids.indexOf(id) === index);
    merged[field] = preferredOrder.map((id) => records.get(id)).filter(Boolean);
  });
  return merged;
}

function stableRecordOrder(left, right) {
  return String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
    || String(left.id || "").localeCompare(String(right.id || ""));
}

export function mergeById(existing = [], incoming = [], mergeItems = null) {
  const merged = new Map();
  [...existing, ...incoming].forEach((item) => {
    if (!item || typeof item !== "object") return;
    const id = item.id || makeStableId("import");
    const previous = merged.get(id);
    if (!previous) merged.set(id, { ...item, id });
    else merged.set(id, mergeItems
      ? mergeItems(previous, { ...item, id })
      : mergeRecordFields(previous, { ...item, id }));
  });
  return [...merged.values()].sort(stableRecordOrder);
}

function tombstoneWins(tombstone, item) {
  return compareRecords(tombstone, item) >= 0;
}

function applyTombstones(items, collection, tombstones) {
  const deleted = new Map(
    tombstones
      .filter((item) => item.collection === collection && item.itemId)
      .map((item) => [item.itemId, item])
  );
  return items.filter((item) => {
    const tombstone = deleted.get(item.id);
    return !tombstone || !tombstoneWins(tombstone, item);
  });
}

function applyNestedTombstones(items, parentCollection, childField, tombstones) {
  const collection = `${parentCollection}.${childField}`;
  return items.map((item) => ({
    ...item,
    [childField]: applyTombstones(item[childField] || [], collection, tombstones)
  }));
}

export function mergeImportedState(current, imported, defaults) {
  const currentNormalized = migrateState(current, defaults);
  const normalized = migrateState(imported, defaults);
  const deletedItems = mergeById(currentNormalized.deletedItems, normalized.deletedItems);
  const merged = {
    ...currentNormalized,
    ...normalized,
    settings: { ...currentNormalized.settings, ...normalized.settings },
    mantra: mergeNestedRecords(currentNormalized.mantra, normalized.mantra, ["history"]),
    deletedItems,
    sessions: applyTombstones(mergeById(currentNormalized.sessions, normalized.sessions), "sessions", deletedItems),
    journals: applyTombstones(mergeById(currentNormalized.journals, normalized.journals), "journals", deletedItems),
    journalTags: applyTombstones(mergeById(currentNormalized.journalTags, normalized.journalTags), "journalTags", deletedItems),
    practices: applyNestedTombstones(
      applyTombstones(
        mergeById(currentNormalized.practices, normalized.practices, (left, right) => mergeNestedRecords(left, right, ["detailedSteps"])),
        "practices",
        deletedItems
      ),
      "practices",
      "detailedSteps",
      deletedItems
    ),
    accumulations: applyNestedTombstones(
      applyTombstones(
        mergeById(currentNormalized.accumulations, normalized.accumulations, (left, right) => mergeNestedRecords(left, right, ["entries"])),
        "accumulations",
        deletedItems
      ),
      "accumulations",
      "entries",
      deletedItems
    ),
    routines: applyNestedTombstones(
      applyTombstones(
        mergeById(currentNormalized.routines, normalized.routines, (left, right) => mergeNestedRecords(left, right, ["steps"])),
        "routines",
        deletedItems
      ),
      "routines",
      "steps",
      deletedItems
    ),
    retreats: applyNestedTombstones(
      applyTombstones(
        mergeById(currentNormalized.retreats, normalized.retreats, (left, right) => mergeNestedRecords(left, right, ["days"])),
        "retreats",
        deletedItems
      ),
      "retreats",
      "days",
      deletedItems
    ),
    libraryItems: applyTombstones(mergeById(currentNormalized.libraryItems, normalized.libraryItems), "libraryItems", deletedItems),
    audioItems: applyTombstones(mergeById(currentNormalized.audioItems, normalized.audioItems), "audioItems", deletedItems),
    reminders: applyTombstones(mergeById(currentNormalized.reminders, normalized.reminders), "reminders", deletedItems),
    calendarEvents: applyTombstones(mergeById(currentNormalized.calendarEvents, normalized.calendarEvents), "calendarEvents", deletedItems)
  };
  merged.mantra.history = applyTombstones(merged.mantra.history, "mantra.history", deletedItems);
  return migrateState(merged, defaults);
}

export function removeWithUndo(state, collection, id, now = new Date().toISOString()) {
  const items = state[collection];
  if (!Array.isArray(items)) return null;
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [item] = items.splice(index, 1);
  const deleted = {
    id: `tombstone:${collection}:${item.id}`,
    collection,
    itemId: item.id,
    index,
    item,
    deletedAt: now,
    createdAt: now,
    updatedAt: now,
    version: Number(item.version || 1) + 1
  };
  state.deletedItems = Array.isArray(state.deletedItems) ? state.deletedItems : [];
  const existingIndex = state.deletedItems.findIndex((entry) => entry.collection === collection && entry.itemId === item.id);
  if (existingIndex >= 0) state.deletedItems.splice(existingIndex, 1, deleted);
  else state.deletedItems.push(deleted);
  return deleted;
}

export function recordNestedDeletions(state, collection, previous = [], next = [], now = new Date().toISOString()) {
  const retained = new Set(next.map((item) => item.id).filter(Boolean));
  const removed = previous.filter((item) => item.id && !retained.has(item.id));
  state.deletedItems = Array.isArray(state.deletedItems) ? state.deletedItems : [];
  removed.forEach((item) => {
    const tombstone = {
      id: `tombstone:${collection}:${item.id}`,
      collection,
      itemId: item.id,
      item,
      deletedAt: now,
      createdAt: now,
      updatedAt: now,
      version: Number(item.version || 1) + 1
    };
    const index = state.deletedItems.findIndex((entry) => entry.collection === collection && entry.itemId === item.id);
    if (index >= 0) state.deletedItems.splice(index, 1, tombstone);
    else state.deletedItems.push(tombstone);
  });
  return removed;
}

export function restoreLastDeleted(state) {
  const deleted = state.deletedItems?.pop();
  if (!deleted || !Array.isArray(state[deleted.collection])) return null;
  const target = state[deleted.collection];
  const now = new Date().toISOString();
  const restored = {
    ...deleted.item,
    updatedAt: now,
    version: Math.max(Number(deleted.version || 1), Number(deleted.item?.version || 1)) + 1
  };
  target.splice(Math.min(Number(deleted.index || 0), target.length), 0, restored);
  return restored;
}
