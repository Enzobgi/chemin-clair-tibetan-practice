import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CURRENT_SCHEMA_VERSION,
  accumulationTotal,
  buildCalendarDays,
  calculateStreak,
  elapsedTimerSeconds,
  mergeImportedState,
  migrateState,
  remainingTimerSeconds,
  removeWithUndo,
  restoreLastDeleted,
  routineDurationSeconds,
  sessionsByDay,
  sessionDurationSeconds,
  sumSessionSeconds,
  validateBackup
} from "../core.js";

const defaults = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  settings: { dailyGoal: 20 },
  mantra: { count: 0, history: [] },
  sessions: [],
  journals: [],
  practices: [],
  deletedItems: [],
  accumulations: [],
  routines: [],
  calendarEvents: []
};

test("le minuteur calcule le temps reel avec des timestamps", () => {
  const timer = {
    totalSeconds: 900,
    elapsedBeforeStart: 12,
    startedAt: 10_000,
    running: true
  };
  assert.equal(elapsedTimerSeconds(timer, 15_500), 17.5);
  assert.equal(remainingTimerSeconds(timer, 15_500), 882.5);
});

test("le minuteur ne depasse jamais la duree programmee", () => {
  const timer = { totalSeconds: 60, elapsedBeforeStart: 55, startedAt: 0, running: false };
  assert.equal(elapsedTimerSeconds(timer), 55);
  assert.equal(sessionDurationSeconds({ minutes: 0.5 }), 30);
});

test("le calendrier utilise cinq ou six semaines selon le mois", () => {
  assert.equal(buildCalendarDays(2026, 1, true).length, 35);
  assert.equal(buildCalendarDays(2026, 2, true).length, 42);
});

test("les minutes et la serie utilisent les secondes enregistrees", () => {
  const sessions = [
    { date: "2026-06-20", durationSeconds: 30 },
    { date: "2026-06-19", minutes: 2 },
    { date: "2026-06-18", durationSeconds: 60 }
  ];
  assert.equal(sumSessionSeconds(sessions), 210);
  assert.equal(calculateStreak(sessions, new Date("2026-06-20T12:00:00")), 3);
});

test("la migration preserve l'ancien format et ajoute les metadonnees", () => {
  const migrated = migrateState({
    settings: { dailyGoal: 45 },
    sessions: [{ date: "2026-01-01", label: "Ancienne", minutes: 3 }],
    journals: [],
    practices: []
  }, defaults);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.sessions[0].durationSeconds, 180);
  assert.ok(migrated.sessions[0].id);
  assert.equal(migrated.settings.dailyGoal, 45);
});

test("la validation refuse une sauvegarde mal formee", () => {
  assert.equal(validateBackup({ sessions: "non" }).valid, false);
  assert.equal(validateBackup({ sessions: [{ date: "2026-06-20", minutes: 2 }] }).valid, true);
});

test("la fusion conserve les objets uniques et la version la plus recente", () => {
  const current = migrateState({
    sessions: [{ id: "a", date: "2026-06-19", minutes: 1, updatedAt: "2026-01-01" }],
    journals: [],
    practices: []
  }, defaults);
  const merged = mergeImportedState(current, {
    sessions: [
      { id: "a", date: "2026-06-19", minutes: 5, updatedAt: "2026-02-01" },
      { id: "b", date: "2026-06-20", minutes: 2 }
    ],
    journals: [],
    practices: []
  }, defaults);
  assert.equal(merged.sessions.length, 2);
  assert.equal(merged.sessions.find((item) => item.id === "a").durationSeconds, 300);
});

test("une suppression peut etre restauree a sa position", () => {
  const state = { sessions: [{ id: "a" }, { id: "b" }], deletedItems: [] };
  removeWithUndo(state, "sessions", "a", "2026-06-20T00:00:00.000Z");
  assert.deepEqual(state.sessions.map((item) => item.id), ["b"]);
  restoreLastDeleted(state);
  assert.deepEqual(state.sessions.map((item) => item.id), ["a", "b"]);
});

test("les routines calculent la duree totale de leurs etapes", () => {
  assert.equal(routineDurationSeconds({ steps: [{ minutes: 5 }, { minutes: 12 }, { minutes: 3 }] }), 1200);
});

test("les accumulations totalisent les corrections et les ajouts", () => {
  assert.equal(accumulationTotal({ entries: [{ count: 108 }, { count: 21 }, { count: -1 }] }), 128);
});

test("les statistiques quotidiennes creent une serie continue de dates", () => {
  const days = sessionsByDay([{ date: "2026-06-20", durationSeconds: 60 }], 3, new Date("2026-06-20T12:00:00"));
  assert.deepEqual(days.map((day) => day.date), ["2026-06-18", "2026-06-19", "2026-06-20"]);
  assert.equal(days[2].seconds, 60);
});

test("la migration version 3 normalise routines, accumulations et journal", () => {
  const migrated = migrateState({
    schemaVersion: 2,
    sessions: [],
    practices: [],
    journals: [{ title: "Note", date: "2026-06-20", body: "Texte" }],
    routines: [],
    accumulations: [{ name: "Refuge", entries: [{ date: "2026-06-20", count: 7 }] }]
  }, {
    ...defaults,
    routines: [{ id: "matin", name: "Matin", steps: [{ practiceTitle: "Calme", minutes: 5 }] }]
  });
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.routines.length, 1);
  assert.ok(migrated.routines[0].steps[0].id);
  assert.ok(migrated.accumulations[0].entries[0].id);
  assert.equal(migrated.journals[0].type, "quick");
});

test("le service worker exclut les API du cache", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /caches\.match/);
});
