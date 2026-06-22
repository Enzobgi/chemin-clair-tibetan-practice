import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CURRENT_SCHEMA_VERSION,
  accumulationPace,
  accumulationPeriodTotal,
  accumulationTotal,
  buildCalendarDays,
  calculateStreak,
  elapsedTimerSeconds,
  mergeImportedState,
  migrateState,
  recordNestedDeletions,
  remainingTimerSeconds,
  removeWithUndo,
  restoreLastDeleted,
  routineDurationSeconds,
  sessionsByDay,
  sessionDurationSeconds,
  sumSessionSeconds,
  validateBackup
} from "../core.js";
import { buildTibetanCalendar, TIBETAN_CALENDAR_SOURCES } from "../tibetan-calendar.js";

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

test("une routine de 30 minutes ne compte jamais sa session recapitulatrice", () => {
  const sessions = [
    { id: "step-1", date: "2026-06-20", durationSeconds: 600 },
    { id: "step-2", date: "2026-06-20", durationSeconds: 900 },
    { id: "step-3", date: "2026-06-20", durationSeconds: 300 },
    { id: "summary", date: "2026-06-20", durationSeconds: 1800, minutes: 30, summaryOnly: true }
  ];
  assert.equal(sessionDurationSeconds(sessions[3]), 0);
  assert.equal(sumSessionSeconds(sessions), 1800);
  assert.equal(sessionsByDay(sessions, 1, new Date("2026-06-20T12:00:00"))[0].seconds, 1800);
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

test("la fusion conserve les ajouts imbriques faits sur deux appareils", () => {
  const base = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessions: [],
    journals: [],
    practices: [],
    accumulations: [{
      id: "acc",
      name: "Refuge",
      entries: [{ id: "entry-a", count: 7, createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-20T08:00:00Z", version: 1 }],
      createdAt: "2026-06-20T07:00:00Z",
      updatedAt: "2026-06-20T08:00:00Z",
      version: 2
    }],
    routines: [{
      id: "routine",
      name: "Matin",
      steps: [{ id: "step-a", practiceTitle: "Refuge", minutes: 10, createdAt: "2026-06-20T07:00:00Z", updatedAt: "2026-06-20T07:00:00Z", version: 1 }],
      createdAt: "2026-06-20T07:00:00Z",
      updatedAt: "2026-06-20T08:00:00Z",
      version: 2
    }],
    retreats: [{
      id: "retreat",
      name: "Retraite",
      days: [{ id: "day-a", date: "2026-06-20", completed: [0], createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-20T08:00:00Z", version: 1 }],
      createdAt: "2026-06-20T07:00:00Z",
      updatedAt: "2026-06-20T08:00:00Z",
      version: 2
    }],
    mantra: {
      id: "mantra-state",
      count: 0,
      history: [{ id: "mantra-a", date: "2026-06-20", count: 108, createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-20T08:00:00Z", version: 1 }],
      createdAt: "2026-06-20T07:00:00Z",
      updatedAt: "2026-06-20T08:00:00Z",
      version: 2
    }
  };
  const otherDevice = structuredClone(base);
  otherDevice.accumulations[0].entries = [{ id: "entry-b", count: 21, createdAt: "2026-06-20T09:00:00Z", updatedAt: "2026-06-20T09:00:00Z", version: 1 }];
  otherDevice.routines[0].steps.push({ id: "step-b", practiceTitle: "Dedication", minutes: 5, createdAt: "2026-06-20T09:00:00Z", updatedAt: "2026-06-20T09:00:00Z", version: 1 });
  otherDevice.retreats[0].days = [{ id: "day-b", date: "2026-06-21", completed: [0, 1], createdAt: "2026-06-20T09:00:00Z", updatedAt: "2026-06-20T09:00:00Z", version: 1 }];
  otherDevice.mantra.history = [{ id: "mantra-b", date: "2026-06-21", count: 54, createdAt: "2026-06-20T09:00:00Z", updatedAt: "2026-06-20T09:00:00Z", version: 1 }];

  const merged = mergeImportedState(base, otherDevice, defaults);
  assert.deepEqual(merged.accumulations[0].entries.map((entry) => entry.id).sort(), ["entry-a", "entry-b"]);
  assert.deepEqual(merged.routines[0].steps.map((step) => step.id), ["step-a", "step-b"]);
  assert.deepEqual(merged.retreats[0].days.map((day) => day.id).sort(), ["day-a", "day-b"]);
  assert.deepEqual(merged.mantra.history.map((entry) => entry.id).sort(), ["mantra-a", "mantra-b"]);
});

test("deux appareils peuvent modifier des champs differents d'une meme routine", () => {
  const common = {
    id: "routine",
    name: "Matin",
    description: "Courte",
    steps: [],
    createdAt: "2026-06-20T07:00:00Z",
    updatedAt: "2026-06-20T08:00:00Z",
    version: 2
  };
  const firstDevice = {
    sessions: [],
    journals: [],
    practices: [],
    routines: [{
      ...common,
      name: "Matin calme",
      fieldVersions: { name: 2, description: 1 },
      fieldUpdatedAt: { name: "2026-06-20T08:00:00Z", description: "2026-06-20T07:00:00Z" }
    }]
  };
  const secondDevice = {
    sessions: [],
    journals: [],
    practices: [],
    routines: [{
      ...common,
      description: "Routine avant le travail",
      fieldVersions: { name: 1, description: 2 },
      fieldUpdatedAt: { name: "2026-06-20T07:00:00Z", description: "2026-06-20T08:30:00Z" }
    }]
  };
  const merged = mergeImportedState(firstDevice, secondDevice, defaults);
  assert.equal(merged.routines[0].name, "Matin calme");
  assert.equal(merged.routines[0].description, "Routine avant le travail");
});

test("un tombstone empeche un element supprime de reapparaitre", () => {
  const local = migrateState({
    sessions: [{ id: "session-a", date: "2026-06-20", minutes: 10, createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-20T08:00:00Z", version: 1 }],
    journals: [],
    practices: []
  }, defaults);
  removeWithUndo(local, "sessions", "session-a", "2026-06-20T09:00:00Z");
  const staleRemote = {
    sessions: [{ id: "session-a", date: "2026-06-20", minutes: 10, createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-20T08:00:00Z", version: 1 }],
    journals: [],
    practices: []
  };
  const merged = mergeImportedState(staleRemote, local, defaults);
  assert.equal(merged.sessions.length, 0);
  assert.equal(merged.deletedItems[0].itemId, "session-a");
  assert.equal(merged.deletedItems[0].collection, "sessions");
});

test("la suppression d'une etape imbriquee produit un tombstone synchronisable", () => {
  const state = { deletedItems: [] };
  const previous = [
    { id: "step-a", version: 1 },
    { id: "step-b", version: 3 }
  ];
  const removed = recordNestedDeletions(state, "routines.steps", previous, [previous[0]], "2026-06-20T10:00:00Z");
  assert.deepEqual(removed.map((item) => item.id), ["step-b"]);
  assert.deepEqual(state.deletedItems[0], {
    id: "tombstone:routines.steps:step-b",
    collection: "routines.steps",
    itemId: "step-b",
    item: previous[1],
    deletedAt: "2026-06-20T10:00:00Z",
    createdAt: "2026-06-20T10:00:00Z",
    updatedAt: "2026-06-20T10:00:00Z",
    version: 4
  });
});

test("un tombstone imbrique retire une ancienne etape lors de la fusion", () => {
  const stale = {
    sessions: [],
    journals: [],
    practices: [],
    routines: [{
      id: "routine",
      name: "Matin",
      steps: [
        { id: "step-a", practiceTitle: "Refuge", createdAt: "2026-06-20T07:00:00Z", updatedAt: "2026-06-20T07:00:00Z", version: 1 },
        { id: "step-b", practiceTitle: "Dedication", createdAt: "2026-06-20T07:00:00Z", updatedAt: "2026-06-20T07:00:00Z", version: 1 }
      ],
      createdAt: "2026-06-20T07:00:00Z",
      updatedAt: "2026-06-20T07:00:00Z",
      version: 1
    }]
  };
  const deleted = structuredClone(stale);
  deleted.routines[0].steps = [deleted.routines[0].steps[0]];
  deleted.deletedItems = [{
    id: "tombstone:routines.steps:step-b",
    collection: "routines.steps",
    itemId: "step-b",
    deletedAt: "2026-06-20T09:00:00Z",
    createdAt: "2026-06-20T09:00:00Z",
    updatedAt: "2026-06-20T09:00:00Z",
    version: 2
  }];
  const merged = mergeImportedState(stale, deleted, defaults);
  assert.deepEqual(merged.routines[0].steps.map((step) => step.id), ["step-a"]);
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

test("les accumulations calculent les periodes et une estimation prudente", () => {
  const accumulation = {
    startDate: "2026-06-01",
    target: 1000,
    entries: [
      { date: "2026-06-01", count: 100 },
      { date: "2026-06-15", count: 200 },
      { date: "2026-06-20", count: 100 }
    ]
  };
  assert.equal(accumulationPeriodTotal(accumulation, 7, new Date("2026-06-21T12:00:00")), 300);
  const pace = accumulationPace(accumulation, new Date("2026-06-20T12:00:00"));
  assert.equal(pace.dailyAverage, 20);
  assert.equal(pace.estimatedDaysRemaining, 30);
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
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.retreats[0].days[0].date, "2026-06-20");
  assert.ok(migrated.retreats[0].days[0].id);
  assert.ok(migrated.retreats[0].days[0].updatedAt);
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

test("la migration version 7 rend les etapes de rituel synchronisables", () => {
  const migrated = migrateState({
    sessions: [],
    journals: [],
    practices: [{
      id: "practice",
      title: "Rituel",
      detailedSteps: [{ title: "Refuge", instruction: "Texte" }]
    }]
  }, defaults);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(migrated.practices[0].detailedSteps[0].id);
  assert.ok(migrated.practices[0].detailedSteps[0].updatedAt);
  assert.equal(migrated.practices[0].detailedSteps[0].translation, "");
});

test("le service worker exclut les API du cache", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /caches\.match/);
});

test("la PWA actualise automatiquement les fichiers du calendrier", async () => {
  const [script, worker] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../sw.js", import.meta.url), "utf8")
  ]);
  assert.match(worker, /chemin-clair-v14/);
  assert.match(worker, /"\/tibetan-calendar\.js"/);
  assert.match(worker, /NETWORK_FIRST_ASSETS\.has\(url\.pathname\)/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(script, /await registration\.update\(\)/);
  assert.match(script, /registration\.waiting\.postMessage/);
});

test("un conflit de synchronisation preserve la copie locale jusqu'au choix utilisateur", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(
    script,
    /if \(localStorage\.getItem\(`\$\{storageKey\(\)\}:dirty`\) === "1"\) \{\s*await syncStateNow\(\);\s*if \(syncStatus === "synced"\) \{\s*render\(\);\s*\}\s*return;\s*\}/s
  );
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

test("les fiches de rituel gardent une largeur lisible sur ordinateur", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(script, /class="ritual-actions"/);
  assert.match(script, /class="button-row ritual-management"/);
  assert.match(styles, /\.practice-row-detailed\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(styles, /\.ritual-step-preview\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
});

test("la priorite 2 expose les controles guides et les nouveaux filtres", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(script, /id="focusFullscreen"/);
  assert.match(script, /data-focus-text/);
  assert.match(script, /id="focusSkip"/);
  assert.match(script, /id="journalTagFilter"/);
  assert.match(script, /id="statsCategory"/);
  assert.match(script, /exportStatisticsCsv/);
  assert.match(styles, /\.focus-text-tabs/);
});

test("le calendrier tibetain 2026 contient des dates reelles et sourcees", () => {
  const events = buildTibetanCalendar(2026);
  const losar = events.find((event) => event.name === "Losar 2153");
  assert.equal(losar.date, "2026-02-18");
  assert.equal(losar.calculated, false);
  assert.ok(events.some((event) => event.name === "Saga Dawa Düchen"));
  assert.ok(events.some((event) => event.name === "Jour de Guru Rinpoché"));
  assert.ok(events.some((event) => event.name === "Pleine lune"));
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.match(TIBETAN_CALENDAR_SOURCES.mathematics.url, /^https:/);
});

test("le profil Karma Kagyu contient des commemorations de lignee sourcees", () => {
  const events = buildTibetanCalendar(2026).filter((event) => event.tradition === "Karma Kagyu");
  assert.deepEqual(events.map((event) => event.date), ["2026-08-14", "2026-11-05"]);
  assert.ok(events.every((event) => event.type === "Karma Kagyu"));
  assert.ok(events.every((event) => event.calculated === false));
  assert.match(TIBETAN_CALENDAR_SOURCES.karmaKagyu.url, /^https:\/\/kagyuoffice\.org/);
});

test("l'interface distingue les dates sourcees des evenements personnels", async () => {
  const [script, worker] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../sw.js", import.meta.url), "utf8")
  ]);
  assert.match(script, /buildTibetanCalendar/);
  assert.match(script, /Date calculee/);
  assert.match(script, /event\.builtIn \? ""/);
  assert.match(script, /id="previousTibetanYear"/);
  assert.match(script, /event\.tradition === "Karma Kagyu"/);
  assert.match(script, /approximation lunaire inspiree du calendrier Tsurluk/);
  assert.match(worker, /tibetan-calendar\.js/);
});

test("le calendrier tibetain affiche les dates a venir par defaut et isole les jours passes", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(script, /let tibetanCalendarPeriod = "upcoming"/);
  assert.match(script, /String\(event\.date\) < today : String\(event\.date\) >= today/);
  assert.match(script, /data-calendar-period="past"/);
  assert.match(script, /Jours passes/);
  assert.match(styles, /\.calendar-period-tabs/);
});

test("les pratiques recommandees restent compactes sur le tableau de bord", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(script, /\.map\(\(practice\) => practiceRow\(practice\)\)/);
  assert.match(script, /practice-row-compact/);
  assert.match(styles, /\.dashboard-practice-list \.practice-row-compact/);
});
