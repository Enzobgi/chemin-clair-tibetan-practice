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
  journalTags: [],
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

test("la migration intermediaire normalise routines, accumulations et journal", () => {
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
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.routines.length, 1);
  assert.ok(migrated.routines[0].steps[0].id);
  assert.ok(migrated.accumulations[0].entries[0].id);
  assert.equal(migrated.journals[0].type, "quick");
});

test("la migration version 5 preserve les espaces personnels", () => {
  const migrated = migrateState({
    schemaVersion: 3,
    sessions: [],
    practices: [],
    journals: [],
    routines: [],
    accumulations: [],
    retreats: [{ name: "Retraite", days: [{ date: "2026-06-20", completed: [0] }] }],
    libraryItems: [{ title: "Texte recu", status: "transmission recue" }],
    audioItems: [{ title: "Recitation locale" }],
    reminders: [{ title: "Matin", days: [1], enabled: true }],
    calendarEvents: [{ name: "Evenement source", date: "2026-06-20" }]
  }, {
    ...defaults,
    retreats: [],
    libraryItems: [],
    audioItems: [],
    reminders: []
  });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.retreats[0].days[0].date, "2026-06-20");
  assert.equal(migrated.libraryItems[0].private, true);
  assert.equal(migrated.audioItems[0].title, "Recitation locale");
  assert.equal(migrated.reminders[0].enabled, true);
  assert.ok(migrated.calendarEvents[0].id);
});

test("la migration version 5 enrichit le journal sans perdre les anciennes notes", () => {
  const migrated = migrateState({
    schemaVersion: 4,
    sessions: [],
    practices: [],
    journals: [{ title: "Ancienne note", date: "2026-06-21", body: "Observation", tags: ["calme"] }],
    journalTags: [{ label: "calme" }]
  }, defaults);
  assert.equal(migrated.journals[0].agitation, "non precisee");
  assert.equal(migrated.journals[0].torpor, "non precisee");
  assert.equal(migrated.journals[0].clarity, "non precisee");
  assert.equal(migrated.journalTags[0].label, "calme");
});

test("le service worker exclut les API du cache", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /caches\.match/);
});

test("la suppression de compte reverifie le mot de passe cote serveur", async () => {
  const endpoint = await readFile(new URL("../api/account.js", import.meta.url), "utf8");
  assert.match(endpoint, /verifyPassword/);
  assert.match(endpoint, /DELETE FROM cc_users/);
  assert.match(endpoint, /clearSession/);
});

test("la navigation responsive utilise un tiroir lateral accessible", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /aria-controls="mainSidebar"/);
  assert.match(script, /setSidebarOpen/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(styles, /\.menu-tab/);
  assert.match(styles, /body\.sidebar-open \.sidebar/);
});
