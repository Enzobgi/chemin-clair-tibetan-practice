const DAY_MS = 86400000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export const TIBETAN_CALENDAR_SOURCES = {
  traditions: {
    name: "Nitartha - calendriers Phukpa et Tsurluk",
    url: "https://nitartha.org/about-the-tibetan-calendar/"
  },
  mathematics: {
    name: "Svante Janson - Tibetan Calendar Mathematics",
    url: "https://arxiv.org/abs/1401.6285"
  },
  losar: {
    name: "Losar - date tibetaine 2026",
    url: "https://en.wikipedia.org/wiki/Losar"
  }
};

const CONFIRMED_LOSAR = {
  2025: "2025-02-28",
  2026: "2026-02-18"
};

function dateKey(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function addDays(value, days) {
  return dateKey(Date.parse(`${value}T12:00:00Z`) + days * DAY_MS);
}

function lunarPhaseDates(year, phase) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const firstCycle = Math.floor((start - REFERENCE_NEW_MOON) / (SYNODIC_MONTH_DAYS * DAY_MS)) - 1;
  const dates = [];
  for (let cycle = firstCycle; cycle < firstCycle + 16; cycle += 1) {
    const milliseconds = REFERENCE_NEW_MOON + (cycle + phase) * SYNODIC_MONTH_DAYS * DAY_MS;
    if (milliseconds >= start && milliseconds < end) dates.push(dateKey(milliseconds));
  }
  return dates;
}

function calendarEvent(id, date, name, type, explanation, suggestedPractice, options = {}) {
  const source = TIBETAN_CALENDAR_SOURCES[options.source || "traditions"];
  return {
    id: `tibetan:${id}:${date}`,
    date,
    name,
    type,
    tradition: options.tradition || "Phukpa - general",
    explanation,
    suggestedPractice,
    source: source.url,
    sourceName: source.name,
    builtIn: true,
    calculated: Boolean(options.calculated),
    lunarDay: options.lunarDay || null,
    lunarMonth: options.lunarMonth || null
  };
}

function practiceDays(year) {
  return lunarPhaseDates(year, 0).flatMap((newMoon, index) => {
    const month = index + 1;
    return [
      calendarEvent("tara", addDays(newMoon, 7), "Jour de Tara", "Tara", "Huitieme jour du cycle lunaire, traditionnellement associe a Tara.", "Recitation ou pratique de Tara selon vos instructions.", { calculated: true, lunarDay: 8, lunarMonth: month }),
      calendarEvent("guru-rinpoche", addDays(newMoon, 9), "Jour de Guru Rinpoché", "Guru Rinpoche", "Dixieme jour du cycle lunaire, traditionnellement associe a Guru Rinpoché.", "Guru yoga ou priere selon votre lignee.", { calculated: true, lunarDay: 10, lunarMonth: month }),
      calendarEvent("dakini", addDays(newMoon, 24), "Jour des dakinis", "Dakini", "Vingt-cinquieme jour du cycle lunaire dans de nombreuses traditions.", "Pratique de dakini ou tsok selon les transmissions recues.", { calculated: true, lunarDay: 25, lunarMonth: month }),
      calendarEvent("protectors", addDays(newMoon, 28), "Jour des protecteurs", "Protecteurs", "Vingt-neuvieme jour du cycle lunaire dans plusieurs lignees.", "Pratique des protecteurs selon votre lignee.", { calculated: true, lunarDay: 29, lunarMonth: month })
    ];
  });
}

function majorFestivals(year) {
  const losar = CONFIRMED_LOSAR[year];
  if (!losar) return [];
  const monthStart = (month) => addDays(losar, Math.round((month - 1) * SYNODIC_MONTH_DAYS));
  return [
    calendarEvent("losar", losar, `Losar ${year + 127}`, "Fete", "Premier jour de la nouvelle annee tibetaine.", "Souhaits auspicieux et pratique avec votre communaute.", { source: "losar", lunarDay: 1, lunarMonth: 1 }),
    calendarEvent("chotrul-duchen", addDays(monthStart(1), 14), "Chötrul Düchen", "Fete", "Quinzieme jour du premier mois tibetain.", "Pratique vertueuse et dedication.", { calculated: true, lunarDay: 15, lunarMonth: 1 }),
    calendarEvent("saga-dawa", addDays(monthStart(4), 14), "Saga Dawa Düchen", "Fete", "Quinzieme jour du quatrieme mois tibetain.", "Generosite, pratique vertueuse et dedication.", { calculated: true, lunarDay: 15, lunarMonth: 4 }),
    calendarEvent("chokhor-duchen", addDays(monthStart(6), 3), "Chökhor Düchen", "Fete", "Quatrieme jour du sixieme mois tibetain.", "Etude, pratique et dedication.", { calculated: true, lunarDay: 4, lunarMonth: 6 }),
    calendarEvent("lhabab-duchen", addDays(monthStart(9), 21), "Lhabab Düchen", "Fete", "Vingt-deuxieme jour du neuvieme mois tibetain.", "Pratique vertueuse et dedication.", { calculated: true, lunarDay: 22, lunarMonth: 9 }),
    calendarEvent("ganden-ngamchoe", addDays(monthStart(10), 24), "Ganden Ngamchö", "Fete", "Vingt-cinquieme jour du dixieme mois tibetain, observe dans la tradition Gelug.", "Offrandes de lumiere et prieres.", { tradition: "Gelug", calculated: true, lunarDay: 25, lunarMonth: 10 })
  ];
}

export function buildTibetanCalendar(year) {
  const phases = [
    ...lunarPhaseDates(year, 0).map((date) => calendarEvent("new-moon", date, "Nouvelle lune", "Phase lunaire", "Repere astronomique de nouvelle lune.", "Pratique selon votre tradition.", { source: "mathematics", calculated: true, lunarDay: 30 })),
    ...lunarPhaseDates(year, 0.5).map((date) => calendarEvent("full-moon", date, "Pleine lune", "Phase lunaire", "Repere astronomique de pleine lune.", "Pratique vertueuse et dedication.", { source: "mathematics", calculated: true, lunarDay: 15 }))
  ];
  return [...majorFestivals(year), ...practiceDays(year), ...phases]
    .filter((item) => item.date.startsWith(String(year)))
    .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
}
