import {
  CURRENT_SCHEMA_VERSION,
  buildCalendarDays,
  calculateStreak,
  elapsedTimerSeconds,
  localDateKey,
  makeStableId,
  mergeImportedState,
  migrateState,
  removeWithUndo,
  remainingTimerSeconds,
  restoreLastDeleted,
  sessionDurationSeconds,
  sumSessionSeconds,
  validateBackup
} from "./core.js";

const STORAGE_KEY = "chemin-clair-state-v1";
const TIMER_STORAGE_SUFFIX = "active-timer";

function makeId() {
  return makeStableId();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const navItems = [
  ["dashboard", "Tableau", "⌂"],
  ["timer", "Meditation", "◷"],
  ["mantras", "Mantras", "108"],
  ["rituals", "Rituels", "☼"],
  ["journal", "Journal", "✎"],
  ["calendar", "Calendrier", "▦"],
  ["library", "Bibliotheque", "☷"],
  ["settings", "Reglages", "⚙"]
];

const defaultPractices = [
  {
    id: makeId(),
    title: "Refuge et bodhicitta",
    category: "Fondation",
    minutes: 8,
    steps: ["Preparer l'espace", "Stabiliser le corps", "Prendre refuge", "Eveiller la bodhicitta", "Reposer l'esprit", "Dedier le merite"],
    notes: "Rituel d'ouverture pour orienter la pratique vers l'eveil et le bien de tous les etres.",
    purpose: "Transformer une activite ordinaire en chemin spirituel en etablissant une direction claire: confiance dans les Trois Joyaux et motivation altruiste.",
    preparation: "Choisissez un lieu calme. Placez-vous assis, le dos droit sans raideur. Une image, une lumiere ou une offrande simple peuvent soutenir le recueillement sans etre indispensables.",
    detailedSteps: [
      { title: "Preparer l'espace", duration: "1 min", instruction: "Rangez sommairement le lieu, coupez les distractions et reconnaissez que ce temps est consacre a la pratique. Formulez interieurement le souhait d'etre present." },
      { title: "Stabiliser le corps et le souffle", duration: "1 min", instruction: "Sentez les points d'appui. Laissez le souffle devenir naturel. A chaque expiration, relachez le visage, les epaules et le ventre." },
      { title: "Prendre refuge", duration: "2 min", instruction: "Rappelez-vous les qualites du Bouddha comme exemple d'eveil, du Dharma comme voie, et de la Sangha comme communaute de soutien. Recitez la formule transmise par votre lignee, ou exprimez simplement votre confiance avec vos propres mots." },
      { title: "Eveiller la bodhicitta", duration: "2 min", instruction: "Pensez que tous les etres cherchent le bonheur et rencontrent la souffrance. Formez le souhait que cette pratique developpe les qualites necessaires pour leur etre reellement utile." },
      { title: "Reposer l'esprit", duration: "1 min", instruction: "Cessez les formulations. Demeurez quelques instants dans l'ouverture produite par cette intention, sans fabriquer une experience particuliere." },
      { title: "Dedier le merite", duration: "1 min", instruction: "Dediez toute qualite issue de la session au soulagement de la souffrance et a l'eveil de tous. Terminez par une action concrete de bienveillance pour la journee." }
    ],
    closing: "Restez immobile quelques respirations, puis levez-vous sans rompre brusquement l'attention.",
    caution: "Utilisez les prieres propres a votre lignee seulement si vous les avez recues ou si elles sont publiques."
  },
  {
    id: makeId(),
    title: "Calme mental",
    category: "Meditation",
    minutes: 15,
    steps: ["Poser l'intention", "Ajuster la posture", "Observer le souffle", "Revenir sans jugement", "Elargir l'attention", "Conclure"],
    notes: "Meditation de stabilisation fondee sur le souffle et le retour bienveillant de l'attention.",
    purpose: "Cultiver une attention stable, claire et souple. Le but n'est pas de supprimer les pensees, mais de reconnaitre la distraction et de revenir sans tension.",
    preparation: "Utilisez un coussin ou une chaise. Reglez le minuteur avant de commencer. Gardez les yeux legerement ouverts si cela correspond a votre instruction.",
    detailedSteps: [
      { title: "Poser l'intention", duration: "1 min", instruction: "Reconnaissez votre etat actuel sans le corriger. Formulez une intention simple: rester present et revenir avec douceur chaque fois que l'esprit s'egare." },
      { title: "Ajuster la posture", duration: "2 min", instruction: "Stabilisez le bassin, etirez doucement la colonne, relachez les epaules et les mains. Le menton est legerement rentre; le regard repose sans fixer." },
      { title: "Rencontrer le souffle", duration: "2 min", instruction: "Observez trois respirations completes. Choisissez ensuite une zone precise: narines, poitrine ou abdomen. Ne modifiez pas le rythme." },
      { title: "Stabiliser l'attention", duration: "7 min", instruction: "Restez avec les sensations du souffle. Quand une pensee, une emotion ou un son emporte l'attention, reconnaissez simplement 'pensee', 'emotion' ou 'son', puis revenez au prochain souffle." },
      { title: "Elargir l'attention", duration: "2 min", instruction: "Laissez le champ s'ouvrir aux sons, sensations et pensees sans choisir. Remarquez que les phenomenes apparaissent, changent et disparaissent." },
      { title: "Conclure", duration: "1 min", instruction: "Evaluez la session par la qualite du retour, non par le nombre de distractions. Dediez la stabilite cultivee a une conduite plus consciente." }
    ],
    closing: "Bougez lentement les mains et les epaules. Gardez un souffle conscient avant de reprendre vos activites.",
    caution: "En cas de vertige, d'angoisse ou de dissociation, ouvrez les yeux, sentez les pieds et revenez a l'environnement."
  },
  {
    id: makeId(),
    title: "Tonglen",
    category: "Compassion",
    minutes: 12,
    steps: ["S'ancrer", "Contacter la tendresse", "Commencer par soi", "Pratiquer pour un proche", "Elargir aux etres", "Reposer et dedier"],
    notes: "Pratique de compassion utilisant le souffle pour accueillir la souffrance et offrir le soulagement.",
    purpose: "Reduire l'evitement et renforcer le courage compatissant. Les images sont symboliques: il ne s'agit pas d'absorber litteralement la souffrance.",
    preparation: "Commencez avec une difficulte supportable. Si vous traversez une crise ou un traumatisme actif, choisissez plutot le calme mental et demandez conseil a un enseignant ou un professionnel qualifie.",
    detailedSteps: [
      { title: "S'ancrer", duration: "2 min", instruction: "Sentez le poids du corps, les pieds et le contact du siege. Suivez le souffle sans visualisation jusqu'a retrouver assez de stabilite." },
      { title: "Contacter la tendresse", duration: "1 min", instruction: "Rappelez-vous un moment de bienveillance recue ou offerte. Laissez cette qualite devenir le point de depart de la pratique." },
      { title: "Commencer par soi", duration: "2 min", instruction: "A l'inspiration, reconnaissez votre propre difficulte comme une fumee sombre qui se dissout dans un espace de compassion. A l'expiration, imaginez clarte, securite et soulagement." },
      { title: "Pratiquer pour une personne", duration: "3 min", instruction: "Choisissez une personne dont la souffrance vous touche sans vous submerger. Inspirez en reconnaissant sa difficulte; expirez en lui offrant symboliquement les conditions du soulagement." },
      { title: "Elargir graduellement", duration: "2 min", instruction: "Incluez les personnes vivant une situation similaire, puis tous les etres. Gardez un rythme naturel et revenez a l'ancrage si l'emotion devient trop forte." },
      { title: "Reposer et dedier", duration: "2 min", instruction: "Abandonnez les images et reposez l'esprit. Dediez la pratique a des gestes concrets de soutien, de patience ou d'ecoute." }
    ],
    closing: "Terminez par plusieurs expirations longues et regardez autour de vous pour retrouver pleinement le lieu.",
    caution: "Arretez la visualisation si elle intensifie fortement la detresse. La compassion n'exige pas de se submerger."
  },
  {
    id: makeId(),
    title: "Dedication",
    category: "Cloture",
    minutes: 4,
    steps: ["Reconnaitre l'experience", "Rassembler le merite", "Elargir le souhait", "Choisir une action"],
    notes: "Rituel de cloture pour relier la pratique formelle a la vie quotidienne.",
    purpose: "Eviter de refermer la pratique sur soi. La dedication oriente toute qualite cultivee vers le bien d'autrui et aide a integrer la session.",
    preparation: "Restez dans la posture de meditation. Ne cherchez pas a produire une emotion particuliere.",
    detailedSteps: [
      { title: "Reconnaitre l'experience", duration: "1 min", instruction: "Accueillez la session telle qu'elle a ete: stable ou agitee, profonde ou ordinaire. Reconnaissez la valeur d'avoir pratique sans vous attribuer un resultat." },
      { title: "Rassembler le merite", duration: "1 min", instruction: "Considerez toute patience, clarte ou compassion apparue comme une ressource a partager plutot qu'une possession personnelle." },
      { title: "Elargir le souhait", duration: "1 min", instruction: "Souhaitez que les bienfaits contribuent au soulagement de tous les etres. Utilisez la priere de dedication de votre tradition si vous la connaissez." },
      { title: "Choisir une action", duration: "1 min", instruction: "Identifiez un comportement concret qui prolongera la pratique: ecouter sans interrompre, parler avec mesure, aider quelqu'un ou renoncer a une reaction impulsive." }
    ],
    closing: "Inclinez legerement la tete ou joignez les mains si ce geste a du sens pour vous, puis reprenez vos activites avec attention.",
    caution: "La dedication ne remplace pas l'action: elle doit inspirer une conduite ethique et utile."
  }
];

const libraryItems = [
  {
    id: "structure-session",
    title: "Structure d'une session",
    type: "Guide",
    body: "Construire une pratique equilibree, de la preparation a la dedication.",
    intro: "Une structure stable reduit les decisions inutiles et aide l'esprit a reconnaitre rapidement le passage de l'activite ordinaire a la pratique.",
    sections: [
      { title: "1. Preparation", text: "Choisissez une duree realiste et un lieu simple. Reglez le minuteur, adoptez une posture stable et laissez trois respirations marquer le debut. Une courte verification du corps evite de confondre immobilite et tension." },
      { title: "2. Refuge et motivation", text: "Rappelez la direction de la voie et formulez une motivation altruiste. Cette etape peut durer une minute. Elle transforme l'objectif de 'reussir une meditation' en intention de developper des qualites utiles a tous." },
      { title: "3. Pratique principale", text: "Consacrez environ deux tiers du temps a une seule methode: calme mental, contemplation, compassion ou recitation. Evitez de changer de technique a chaque difficulte. Ajustez seulement si l'exercice devient destabilisant." },
      { title: "4. Repos et integration", text: "Avant de conclure, cessez l'effort technique pendant quelques instants. Observez l'etat de l'esprit et du corps. Ce repos permet d'integrer la pratique sans chercher a retenir une experience." },
      { title: "5. Dedication", text: "Terminez en dediant les bienfaits et en choisissant une action concrete. Notez ensuite une phrase dans le journal: obstacle principal, qualite presente et intention pour la journee." }
    ],
    practice: "Format de 20 minutes: 2 min de preparation, 2 min de refuge et motivation, 13 min de pratique principale, 1 min de repos, 2 min de dedication.",
    caution: "Les sadhanas et liturgies de lignee peuvent suivre une structure precise: dans ce cas, suivez les instructions recues."
  },
  {
    id: "quatre-pensees",
    title: "Les quatre pensees",
    type: "Contemplation",
    body: "Approfondir les quatre contemplations qui orientent l'esprit vers le Dharma.",
    intro: "Ces contemplations ne servent pas a produire de la peur ou du pessimisme. Elles donnent du poids au temps present et clarifient ce qui merite notre energie.",
    sections: [
      { title: "La precieuse existence humaine", text: "Reconnaissez les libertes, ressources, rencontres et capacites qui rendent la pratique possible. Contemplez leur rarete sans comparaison avec autrui. Demandez-vous comment utiliser concretement ces conditions aujourd'hui." },
      { title: "L'impermanence", text: "Tout ce qui est compose change. Observez le corps, les relations, les saisons et les etats mentaux. L'objectif n'est pas la tristesse, mais la lucidite: puisque le temps est limite, remettre indefiniment la pratique n'est pas neutre." },
      { title: "Le karma", text: "Les actions intentionnelles faconnent les habitudes et leurs consequences. Examinez comment une parole, une pensee entretenue ou un geste repete renforce une direction. Concentrez-vous sur la responsabilite presente plutot que sur la culpabilite." },
      { title: "Les limites du samsara", text: "Les satisfactions conditionnees sont instables et ne peuvent offrir une securite definitive. Voyez comment la recherche compulsive, l'aversion et l'indifference entretiennent l'insatisfaction. Cette reconnaissance soutient le renoncement, compris comme liberte interieure." }
    ],
    practice: "Consacrez une semaine a chaque pensee. Lisez la section, meditez dix minutes, puis notez une consequence pratique en une phrase.",
    caution: "Si une contemplation augmente fortement l'anxiete ou le desespoir, revenez au souffle, a la gratitude et a l'accompagnement d'un enseignant qualifie."
  },
  {
    id: "posture-sept-points",
    title: "Posture en sept points",
    type: "Meditation",
    body: "Installer une posture stable, detendue et propice a la clarte.",
    intro: "La posture soutient l'esprit sans devenir une performance physique. Adaptez-la a votre corps; la stabilite et l'aisance comptent davantage qu'une forme parfaite.",
    sections: [
      { title: "1. Jambes et bassin", text: "Asseyez-vous en tailleur, demi-lotus ou sur une chaise. Les genoux et le bassin doivent etre soutenus. Sur une chaise, posez les pieds au sol. Inclinez legerement le bassin vers l'avant pour soutenir la colonne." },
      { title: "2. Mains", text: "Posez les mains sur les cuisses ou l'une dans l'autre sous le nombril. Les bras restent naturels; les coudes ne sont ni colles au corps ni forces vers l'exterieur." },
      { title: "3. Colonne", text: "Etirez le sommet du crane vers le haut sans cambrer. Imaginez les vertebres empilees avec souplesse. Une posture vivante permet de respirer librement." },
      { title: "4. Epaules", text: "Ouvrez legerement la poitrine puis relachez les epaules vers le bas. Verifiez regulierement qu'elles ne remontent pas avec l'effort de concentration." },
      { title: "5. Tete et menton", text: "Rentrez legerement le menton afin que la nuque reste longue. La tete ne tombe pas en avant et ne part pas vers l'arriere." },
      { title: "6. Bouche et langue", text: "Relachez la machoire. La langue peut toucher doucement le palais derriere les dents superieures. Respirez naturellement par le nez si cela est confortable." },
      { title: "7. Regard", text: "Gardez les yeux legerement ouverts, le regard pose a environ un metre devant vous, ou fermez-les si c'est l'instruction recue. Ne fixez aucun objet." }
    ],
    practice: "Faites un balayage de 30 secondes au debut, au milieu et a la fin: bassin, colonne, epaules, machoire, regard.",
    caution: "La douleur n'est pas un signe de progression. Utilisez une chaise, changez de posture ou consultez un professionnel de sante si necessaire."
  },
  {
    id: "mala-comptage",
    title: "Mala et comptage",
    type: "Mantra",
    body: "Utiliser un mala et compter les repetitions avec attention.",
    intro: "Le mala aide a maintenir la continuite, a mesurer un engagement et a ramener l'attention au son. Le nombre ne remplace jamais la qualite de presence.",
    sections: [
      { title: "Anatomie du mala", text: "Un mala tibetain comporte habituellement 108 perles et une perle principale. Certaines traditions utilisent des compteurs lateraux. Traitez le mala comme un support de pratique plutot que comme un simple accessoire." },
      { title: "Tenue et progression", text: "Tenez le mala de la maniere enseignee dans votre tradition. Avancez d'une perle apres chaque recitation complete. Arrive a la perle principale, ne la franchissez pas: retournez le mala et repartez dans l'autre sens." },
      { title: "Voix, souffle et attention", text: "Recitez a voix audible, basse ou mentalement selon l'instruction. Gardez un rythme qui permet d'entendre chaque syllabe. Si le souffle se crispe, ralentissez. Revenez au sens ou a la qualite associee au mantra." },
      { title: "Comptage et objectifs", text: "Commencez par un objectif soutenable, par exemple 21 ou 108 repetitions. En cas d'engagement formel, suivez les instructions exactes. L'app peut enregistrer les cycles, mais ne valide pas une retraite ou un accomplissement traditionnel." },
      { title: "Cloture", text: "Apres le dernier cycle, restez silencieux quelques instants. Dediez la recitation et notez la qualite de l'attention plutot que le seul total." }
    ],
    practice: "Pour debuter: 3 respirations, 21 repetitions lentes, 1 minute de silence, puis dedication. Augmentez progressivement jusqu'a un mala complet.",
    caution: "Certains mantras et pratiques requierent transmission, initiation ou instruction. Respectez les indications de votre lignee."
  },
  {
    id: "journal-pratique",
    title: "Journal de pratique",
    type: "Integration",
    body: "Observer les tendances sans transformer la pratique en evaluation permanente.",
    intro: "Un journal utile est bref, honnete et oriente vers l'apprentissage. Il revele les tendances sur plusieurs semaines sans figer chaque session en succes ou echec.",
    sections: [
      { title: "Donnees essentielles", text: "Notez la date, la pratique, la duree et les conditions generales: sommeil, agitation, douleur ou clarte. Ces informations aident a distinguer les tendances des impressions du moment." },
      { title: "Qualite de presence", text: "Decrivez un fait observable: 'je suis revenu dix fois au souffle avec moins de tension', plutot que 'mauvaise meditation'. Cherchez ce qui a facilite ou entrave la presence." },
      { title: "Obstacles", text: "Identifiez l'obstacle dominant: torpeur, agitation, doute, aversion ou desir. Notez la reponse essayee et son effet. Cette precision rend les conseils d'un enseignant plus utiles." },
      { title: "Integration", text: "Choisissez une qualite a porter dans la journee et une situation ou l'appliquer. Le journal relie alors le coussin a la parole, aux relations et aux decisions." },
      { title: "Revue hebdomadaire", text: "Une fois par semaine, relisez sans juger. Relevez une progression, une difficulte recurrente et un ajustement modeste. Ne multipliez pas les objectifs." }
    ],
    practice: "Utilisez quatre lignes apres chaque session: ce que j'ai pratique; ce que j'ai remarque; ce qui m'a aide; ce que j'emporte dans la journee.",
    caution: "Ne consignez pas d'informations sensibles sur d'autres personnes. Si l'ecriture nourrit l'obsession ou l'autocritique, reduisez-la a une phrase factuelle."
  },
  {
    id: "ethique-application",
    title: "Ethique de l'app",
    type: "Respect",
    body: "Utiliser un outil numerique sans banaliser les transmissions ni la relation d'enseignement.",
    intro: "Une application peut soutenir la regularite, mais elle ne remplace ni la relation vivante avec un enseignant qualifie, ni la communaute, ni l'etude approfondie.",
    sections: [
      { title: "Contenus publics et contenus transmis", text: "Les enseignements generaux, le calme mental et les contemplations introductives sont souvent publics. Certaines sadhanas, visualisations et recitations sont reservees aux personnes ayant recu une transmission ou une initiation." },
      { title: "Respect des textes", text: "N'ajoutez dans l'app que les textes que vous etes autorise a conserver sous forme numerique. Evitez de diffuser des documents de retraite, commentaires internes ou enregistrements sans permission." },
      { title: "Role de l'enseignant", text: "Un minuteur peut mesurer une duree, pas la justesse d'une vue ni l'integration d'une pratique. En cas de doute doctrinal, de difficulte persistante ou d'engagement formel, demandez conseil a une personne qualifiee." },
      { title: "Donnees et comparaison", text: "Les series, minutes et nombres de mantras servent de repere personnel. Ils ne mesurent pas la realisation et ne devraient pas nourrir la competition, la culpabilite ou la comparaison." },
      { title: "Equilibre numerique", text: "Utilisez l'app avant et apres la session, puis posez l'appareil. Desactivez les notifications inutiles. La technologie doit proteger l'espace de pratique, pas l'occuper." }
    ],
    practice: "Avant d'ajouter un contenu, posez trois questions: est-il public ou autorise; est-il utile ici; puis-je le stocker sans manquer de respect a sa source?",
    caution: "Les traditions et lignees ont des usages differents. En cas d'incertitude, demandez directement a votre enseignant ou centre."
  }
];

const seedState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  settings: {
    dailyGoal: 30,
    defaultTimer: 15,
    bell: true,
    themeDensity: "comfortable"
  },
  intentions: [
    "Que cette pratique nourrisse la clarte, la patience et une compassion concrete.",
    "Aujourd'hui, revenir simplement au souffle avant de reagir.",
    "Dedier les efforts aux personnes qui traversent une difficulte."
  ],
  practices: defaultPractices,
  sessions: [],
  journals: [],
  deletedItems: [],
  routines: [],
  accumulations: [],
  calendarEvents: [],
  mantra: {
    selected: "Om Mani Padme Hum",
    count: 0,
    target: 108,
    history: []
  }
};

let currentUser = null;
let syncStatus = "local";
let syncTimer = null;
let authMode = "login";
let state = loadCachedState();
const requestedView = new URLSearchParams(window.location.search).get("view");
let activeView = navItems.some(([id]) => id === requestedView) ? requestedView : "dashboard";
let calendarCursor = new Date();
let timerInterval = null;
let timer = loadTimerState();
let toastTimer = null;
let remoteRevision = 0;

const qs = (selector) => document.querySelector(selector);

function storageKey(userId = currentUser?.id) {
  return userId ? `${STORAGE_KEY}:user:${userId}` : `${STORAGE_KEY}:guest`;
}

function loadCachedState(userId = null) {
  try {
    const accountKey = userId ? storageKey(userId) : storageKey(null);
    const raw = localStorage.getItem(accountKey) || (!userId ? localStorage.getItem(STORAGE_KEY) : null);
    const saved = raw ? JSON.parse(raw) : null;
    return saved ? mergeState(seedState, saved) : migrateState(null, seedState);
  } catch {
    return migrateState(null, seedState);
  }
}

function mergeState(base, saved) {
  const migrated = migrateState(saved, base);
  const savedPractices = Array.isArray(migrated.practices) ? migrated.practices : base.practices;
  const practices = savedPractices.map((practice) => {
    const template = base.practices.find((item) => item.title === practice.title);
    const fallbackSteps = (practice.steps || []).map((step, index) => ({
      title: step,
      duration: `${Math.max(1, Math.round(Number(practice.minutes || 10) / Math.max(1, practice.steps.length)))} min`,
      instruction: `Prenez le temps d'accomplir cette etape avec attention. Notez ce qui apparait, puis passez a l'etape ${index + 2} sans vous presser.`
    }));
    return {
      ...template,
      ...practice,
      purpose: practice.purpose || template?.purpose || "Donner une structure claire a cette pratique personnelle.",
      preparation: practice.preparation || template?.preparation || "Preparez un espace calme et adoptez une posture stable.",
      detailedSteps: practice.detailedSteps || template?.detailedSteps || fallbackSteps,
      closing: practice.closing || template?.closing || "Terminez par quelques respirations et une courte dedication.",
      caution: practice.caution || template?.caution || "Adaptez la pratique a votre situation et suivez les conseils de votre enseignant."
    };
  });
  return {
    ...clone(base),
    ...migrated,
    settings: { ...base.settings, ...(migrated.settings || {}) },
    mantra: { ...base.mantra, ...(migrated.mantra || {}) },
    practices
  };
}

function timerStorageKey() {
  return `${storageKey()}:${TIMER_STORAGE_SUFFIX}`;
}

function revisionStorageKey() {
  return `${storageKey()}:revision`;
}

function createTimerState(minutes = state.settings.defaultTimer, label = "Meditation silencieuse") {
  return {
    id: makeId(),
    totalSeconds: Math.max(1, Number(minutes || 1)) * 60,
    elapsedBeforeStart: 0,
    startedAt: null,
    running: false,
    label,
    saved: false,
    bellPlayed: false,
    completedNaturally: false
  };
}

function loadTimerState() {
  try {
    const saved = JSON.parse(localStorage.getItem(`${storageKey()}:${TIMER_STORAGE_SUFFIX}`));
    if (saved && Number(saved.totalSeconds) > 0 && !saved.saved) return saved;
  } catch {
    // Invalid timer state falls back to a fresh timer.
  }
  return createTimerState();
}

function persistTimerState() {
  localStorage.setItem(timerStorageKey(), JSON.stringify(timer));
}

function clearTimerTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function saveState({ remote = true } = {}) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  if (currentUser && remote) localStorage.setItem(`${storageKey()}:dirty`, "1");
  render();
  if (currentUser && remote) scheduleRemoteSync();
}

function scheduleRemoteSync() {
  clearTimeout(syncTimer);
  syncStatus = "syncing";
  renderAccountPanel();
  syncTimer = setTimeout(syncStateNow, 500);
}

async function syncStateNow({ force = false } = {}) {
  if (!currentUser) return;
  try {
    syncStatus = "syncing";
    renderAccountPanel();
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: state, expectedRevision: remoteRevision, force })
    });
    const payload = await response.json();
    if (response.status === 409) {
      syncStatus = "error";
      openSyncConflict(payload);
      renderAccountPanel();
      return;
    }
    if (!response.ok) throw new Error(payload.error || "sync failed");
    remoteRevision = Number(payload.revision || remoteRevision);
    localStorage.setItem(revisionStorageKey(), String(remoteRevision));
    syncStatus = "synced";
    localStorage.removeItem(`${storageKey()}:dirty`);
  } catch {
    syncStatus = "error";
  }
  renderAccountPanel();
}

async function restoreRemoteState({ importLocalWhenEmpty = true } = {}) {
  if (!currentUser) return;
  if (localStorage.getItem(`${storageKey()}:dirty`) === "1") {
    await syncStateNow();
    if (syncStatus === "synced") {
      render();
      return;
    }
  }
  syncStatus = "syncing";
  renderAccountPanel();
  try {
    const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("load failed");
    const payload = await response.json();
    remoteRevision = Number(payload.revision || 0);
    localStorage.setItem(revisionStorageKey(), String(remoteRevision));
    if (payload.data) {
      state = mergeState(seedState, payload.data);
      localStorage.setItem(storageKey(), JSON.stringify(state));
      localStorage.removeItem(`${storageKey()}:dirty`);
    } else if (importLocalWhenEmpty) {
      await syncStateNow();
    }
    syncStatus = "synced";
    render();
  } catch {
    syncStatus = "error";
    renderAccountPanel();
  }
}

async function initializeAccount() {
  try {
    const response = await fetch("/api/auth/session", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("session unavailable");
    const payload = await response.json();
    if (payload.user) {
      currentUser = payload.user;
      const accountCache = localStorage.getItem(storageKey(payload.user.id));
      state = accountCache ? loadCachedState(payload.user.id) : state;
      remoteRevision = Number(localStorage.getItem(revisionStorageKey()) || 0);
      timer = loadTimerState();
      render();
      await restoreRemoteState({ importLocalWhenEmpty: true });
      return;
    }
  } catch {
    syncStatus = "local";
  }
  renderAccountPanel();
}

function todayKey(date = new Date()) {
  return localDateKey(date);
}

function minutesFor(day) {
  return sumSessionSeconds(state.sessions, day) / 60;
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekMinutes() {
  const start = weekStart();
  return state.sessions
    .filter((s) => new Date(s.date) >= start)
    .reduce((sum, s) => sum + Number(s.minutes || 0), 0);
}

function streak() {
  return calculateStreak(state.sessions);
}

function totalMantras() {
  return state.mantra.history.reduce((sum, item) => sum + Number(item.count || 0), 0) + Number(state.mantra.count || 0);
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("is-active", el.id === view));
  document.querySelectorAll(".nav-btn").forEach((el) => el.classList.toggle("is-active", el.dataset.view === view));
  renderView();
}

function renderNav() {
  qs("#navList").innerHTML = navItems
    .map(([id, label, icon]) => `
      <button class="nav-btn ${activeView === id ? "is-active" : ""}" data-view="${id}">
        <span class="nav-icon" aria-hidden="true">${icon}</span>
        <span>${label}</span>
      </button>
    `)
    .join("");

  document.querySelectorAll("[data-view], [data-view-link]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view || btn.dataset.viewLink));
  });
}

function renderShellStats() {
  const todayMinutes = minutesFor(todayKey());
  const goal = Math.max(1, Number(state.settings.dailyGoal));
  const percent = Math.min(100, Math.round((todayMinutes / goal) * 100));
  const circumference = 327;
  qs("#sidebarMinutes").textContent = `${todayMinutes} min`;
  qs("#sidebarStreak").textContent = `Serie: ${streak()} jours`;
  qs("#dailyIntention").textContent = state.intentions[new Date().getDate() % state.intentions.length];
  qs("#goalPercent").textContent = `${percent}%`;
  qs("#weekMinutes").textContent = weekMinutes();
  qs("#totalMantras").textContent = totalMantras();
  qs("#goalRing").style.strokeDashoffset = String(circumference - (circumference * percent) / 100);
}

function renderAccountPanel() {
  const panel = qs("#accountPanel");
  if (!panel) return;
  if (!currentUser) {
    panel.innerHTML = `
      <span class="eyebrow">Compte</span>
      <strong>Mode local</strong>
      <span>Connectez-vous pour synchroniser vos appareils.</span>
      <button class="ghost-btn" id="openAuthBtn">Se connecter</button>
    `;
    qs("#openAuthBtn").addEventListener("click", () => openAuthDialog("login"));
    return;
  }
  const statusCopy = {
    synced: "Donnees synchronisees",
    syncing: "Synchronisation...",
    error: "Hors ligne, sauvegarde locale active",
    local: "Sauvegarde locale"
  };
  panel.innerHTML = `
    <span class="eyebrow">Compte</span>
    <strong>${escapeHtml(currentUser.name)}</strong>
    <span>${escapeHtml(currentUser.email)}</span>
    <span class="sync-line">
      <span class="sync-dot is-${syncStatus}"></span>
      ${statusCopy[syncStatus] || statusCopy.local}
    </span>
    <button class="ghost-btn" id="logoutBtn">Se deconnecter</button>
  `;
  qs("#logoutBtn").addEventListener("click", logoutAccount);
}

function renderDashboard() {
  const todayMinutes = minutesFor(todayKey());
  qs("#dashboard").innerHTML = `
    <div class="metrics-grid">
      ${metric("Aujourd'hui", `${todayMinutes} min`, `${Math.max(0, state.settings.dailyGoal - todayMinutes)} min restantes`)}
      ${metric("Serie", `${streak()} jours`, "avec au moins une session")}
      ${metric("Semaine", `${weekMinutes()} min`, `${state.sessions.length} sessions au total`)}
      ${metric("Mantras", totalMantras(), `${state.mantra.selected}`)}
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Plan du jour</span>
            <h2>Pratiques recommandees</h2>
          </div>
          <button class="primary-btn" id="quickSession">Ajouter une session</button>
        </div>
        <div class="practice-list">
          ${state.practices.slice(0, 4).map(practiceRow).join("")}
        </div>
      </section>
      <section class="panel">
        <span class="eyebrow">Dernieres notes</span>
        <h2>Journal recent</h2>
        <div class="journal-list">
          ${state.journals.slice(-4).reverse().map(journalCard).join("") || empty("Aucune note pour le moment.")}
        </div>
      </section>
    </div>
  `;
  qs("#quickSession").addEventListener("click", openSessionDialog);
  bindPracticeButtons();
  bindJournalActions();
}

function metric(label, value, hint) {
  return `<article class="metric-card"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="muted">${hint}</span></article>`;
}

function practiceRow(p, detailed = false) {
  const steps = p.detailedSteps || (p.steps || []).map((title) => ({ title, instruction: "" }));
  return `
    <article class="practice-row ${detailed ? "practice-row-detailed" : ""}">
      <div>
        <div class="row-head">
          <h3>${escapeHtml(p.title)}</h3>
          <span class="tag">${escapeHtml(p.category)}</span>
        </div>
        <p>${escapeHtml(p.notes)}</p>
        ${detailed ? `
          <ol class="ritual-step-preview">
            ${steps.map((step) => `
              <li>
                <strong>${escapeHtml(step.title)}</strong>
                <span>${escapeHtml(step.instruction)}</span>
              </li>
            `).join("")}
          </ol>
        ` : `<div class="tag-row">${p.steps.map((step) => `<span class="tag">${escapeHtml(step)}</span>`).join("")}</div>`}
      </div>
      <div class="button-row">
        ${detailed ? `<button class="ghost-btn" data-view-practice="${p.id}">Rituel complet</button>` : ""}
        <button class="ghost-btn" data-start-practice="${p.id}">${p.minutes} min</button>
        <button class="primary-btn" data-log-practice="${p.id}">Valider</button>
        ${detailed ? `
          <button class="icon-btn" data-edit-practice="${p.id}" aria-label="Modifier ${escapeAttr(p.title)}" title="Modifier">✎</button>
          <button class="icon-btn" data-duplicate-practice="${p.id}" aria-label="Dupliquer ${escapeAttr(p.title)}" title="Dupliquer">⧉</button>
          <button class="icon-btn" data-archive-practice="${p.id}" aria-label="${p.archived ? "Restaurer" : "Archiver"} ${escapeAttr(p.title)}" title="${p.archived ? "Restaurer" : "Archiver"}">${p.archived ? "↥" : "⌄"}</button>
          <button class="icon-btn danger-btn" data-delete-practice="${p.id}" aria-label="Supprimer ${escapeAttr(p.title)}" title="Supprimer">×</button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderTimer() {
  const elapsed = elapsedTimerSeconds(timer);
  const remaining = remainingTimerSeconds(timer);
  const locked = elapsed > 0 || timer.running;
  qs("#timer").innerHTML = `
    <section class="timer-face">
      <div>
        <div class="timer-circle" id="timerCircle">
          <div class="timer-inner">
            <div>
              <div class="timer-time" id="timerTime">${formatTime(remaining)}</div>
              <p class="muted">${escapeHtml(timer.label)}</p>
              <p class="timer-elapsed" id="timerElapsed">Temps pratique: ${formatDuration(elapsed)}</p>
            </div>
          </div>
        </div>
        <div class="button-row" style="justify-content:center;margin-top:22px">
          <button class="primary-btn" id="timerStart" ${timer.saved || timer.completedNaturally ? "disabled" : ""}>${timer.running ? "Pause" : "Demarrer"}</button>
          <button class="ghost-btn" id="timerReset">Reinitialiser</button>
          <button class="ghost-btn" id="timerComplete" ${timer.saved ? "disabled" : ""}>Terminer et enregistrer</button>
        </div>
      </div>
    </section>
    <section class="panel">
      <span class="eyebrow">Configuration</span>
      <div class="form-grid">
        <label>Duree en minutes <input id="timerMinutes" type="number" min="1" max="180" value="${Math.round(timer.totalSeconds / 60)}" ${locked ? "disabled" : ""}></label>
        <label>Type de session <select id="timerLabel" ${locked ? "disabled" : ""}>
          <option ${timer.label === "Meditation silencieuse" ? "selected" : ""}>Meditation silencieuse</option>
          <option ${timer.label === "Refuge et bodhicitta" ? "selected" : ""}>Refuge et bodhicitta</option>
          <option ${timer.label === "Tonglen" ? "selected" : ""}>Tonglen</option>
          <option ${timer.label === "Recitation de mantra" ? "selected" : ""}>Recitation de mantra</option>
          <option ${timer.label === "Etude et contemplation" ? "selected" : ""}>Etude et contemplation</option>
        </select></label>
      </div>
    </section>
  `;
  updateTimerFace();
  qs("#timerStart").addEventListener("click", toggleTimer);
  qs("#timerReset").addEventListener("click", resetTimer);
  qs("#timerComplete").addEventListener("click", completeTimer);
  qs("#timerMinutes").addEventListener("change", (event) => {
    timer = createTimerState(Math.max(1, Number(event.target.value)), timer.label);
    persistTimerState();
    renderTimer();
  });
  qs("#timerLabel").addEventListener("change", (event) => {
    timer.label = event.target.value;
    persistTimerState();
    renderTimer();
  });
  if (timer.running) startTimerTicker();
}

function toggleTimer() {
  if (timer.running) {
    timer.elapsedBeforeStart = elapsedTimerSeconds(timer);
    timer.startedAt = null;
    timer.running = false;
    clearTimerTicker();
  } else {
    if (elapsedTimerSeconds(timer) >= timer.totalSeconds) return;
    timer.startedAt = Date.now();
    timer.running = true;
    startTimerTicker();
  }
  persistTimerState();
  renderTimer();
}

function resetTimer() {
  clearTimerTicker();
  timer = createTimerState(timer.totalSeconds / 60, timer.label);
  persistTimerState();
  renderTimer();
}

function completeTimer() {
  if (timer.saved) return;
  const elapsed = Math.floor(elapsedTimerSeconds(timer));
  if (elapsed === 0 && !confirm("Aucune seconde ne s'est ecoulee. Enregistrer tout de meme une session de 0 seconde ?")) {
    return;
  }
  clearTimerTicker();
  timer.running = false;
  timer.startedAt = null;
  timer.elapsedBeforeStart = elapsed;
  timer.saved = true;
  if (!timer.bellPlayed && elapsed > 0) {
    ringBell();
    timer.bellPlayed = true;
  }
  persistTimerState();
  const now = new Date().toISOString();
  state.sessions.push({
    id: makeId(),
    date: todayKey(),
    label: timer.label,
    minutes: Math.round((elapsed / 60) * 100) / 100,
    durationSeconds: elapsed,
    mood: "stable",
    createdAt: now,
    updatedAt: now,
    version: 1
  });
  saveState();
  timer = createTimerState(timer.totalSeconds / 60, timer.label);
  persistTimerState();
  setView("dashboard");
}

function startTimerTicker() {
  clearTimerTicker();
  if (!timer.running) return;
  timerInterval = setInterval(() => {
    updateTimerFace();
    if (remainingTimerSeconds(timer) <= 0) finishTimerNaturally();
  }, 250);
}

function finishTimerNaturally() {
  if (timer.completedNaturally) return;
  clearTimerTicker();
  timer.elapsedBeforeStart = timer.totalSeconds;
  timer.startedAt = null;
  timer.running = false;
  timer.completedNaturally = true;
  if (!timer.bellPlayed) {
    ringBell();
    timer.bellPlayed = true;
  }
  persistTimerState();
  renderTimer();
}

function updateTimerFace() {
  const time = qs("#timerTime");
  const circle = qs("#timerCircle");
  if (!time || !circle) return;
  const remaining = remainingTimerSeconds(timer);
  const elapsed = elapsedTimerSeconds(timer);
  const done = timer.totalSeconds ? (elapsed / timer.totalSeconds) * 100 : 0;
  time.textContent = formatTime(remaining);
  circle.style.setProperty("--timer-progress", `${done}%`);
  const elapsedCopy = qs("#timerElapsed");
  if (elapsedCopy) elapsedCopy.textContent = `Temps pratique: ${formatDuration(elapsed)}`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  if (value < 60) return `${value} s`;
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  return remainingSeconds ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`;
}

function renderMantras() {
  const filled = Math.min(108, state.mantra.count % 108 || (state.mantra.count && 108));
  qs("#mantras").innerHTML = `
    <section class="panel mantra-counter">
      <span class="eyebrow">Compteur de mala</span>
      <label>Mantra ou pratique
        <input id="mantraName" value="${escapeAttr(state.mantra.selected)}">
      </label>
      <div class="count-display">${state.mantra.count}</div>
      <div class="mala-grid" aria-label="Progression sur 108">
        ${Array.from({ length: 108 }, (_, i) => `<span class="bead ${i < filled ? "is-filled" : ""}"></span>`).join("")}
      </div>
      <div class="button-row">
        <button class="primary-btn" id="addMantra">Ajouter 1</button>
        <button class="ghost-btn" id="addMala">Ajouter 108</button>
        <button class="ghost-btn" id="saveMantra">Sauver le cycle</button>
        <button class="ghost-btn" id="resetMantra">Remise a zero</button>
      </div>
    </section>
    <section class="panel">
      <span class="eyebrow">Historique</span>
      <div class="practice-list">${state.mantra.history.slice(-8).reverse().map((h) => `
        <article class="practice-row"><div><h3>${escapeHtml(h.name)}</h3><p>${h.date} - ${h.count} repetitions</p></div></article>
      `).join("") || empty("Aucun cycle sauvegarde.")}</div>
    </section>
  `;
  qs("#mantraName").addEventListener("change", (e) => {
    state.mantra.selected = e.target.value.trim() || "Mantra";
    saveState();
  });
  qs("#addMantra").addEventListener("click", () => {
    state.mantra.count += 1;
    if (state.settings.bell && state.mantra.count % 108 === 0) ringBell();
    saveState();
  });
  qs("#addMala").addEventListener("click", () => {
    state.mantra.count += 108;
    ringBell();
    saveState();
  });
  qs("#saveMantra").addEventListener("click", () => {
    if (state.mantra.count > 0) {
      state.mantra.history.push(newRecord({ date: todayKey(), name: state.mantra.selected, count: state.mantra.count }));
      state.sessions.push(newRecord({
        date: todayKey(),
        label: `Mantra: ${state.mantra.selected}`,
        minutes: Math.max(1, Math.round(state.mantra.count / 18)),
        durationSeconds: Math.max(1, Math.round(state.mantra.count / 18)) * 60,
        mood: "recitation"
      }));
      state.mantra.count = 0;
      saveState();
    }
  });
  qs("#resetMantra").addEventListener("click", () => {
    state.mantra.count = 0;
    saveState();
  });
}

function renderRituals() {
  const activePractices = state.practices.filter((practice) => !practice.archived);
  const archivedPractices = state.practices.filter((practice) => practice.archived);
  qs("#rituals").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Rituels et sequences</span>
          <h2>Vos pratiques pas a pas</h2>
          <p class="muted">Chaque sequence peut etre lue en detail, lancee avec le minuteur ou enregistree une fois terminee.</p>
        </div>
        <button class="primary-btn" id="addPractice">Ajouter</button>
      </div>
      <div class="practice-list">${activePractices.map((practice) => practiceRow(practice, true)).join("") || empty("Aucune pratique active.")}</div>
      ${archivedPractices.length ? `
        <details class="archived-section">
          <summary>Pratiques archivees (${archivedPractices.length})</summary>
          <div class="practice-list">${archivedPractices.map((practice) => practiceRow(practice, true)).join("")}</div>
        </details>
      ` : ""}
    </section>
  `;
  qs("#addPractice").addEventListener("click", openPracticeDialog);
  bindPracticeButtons();
}

function bindPracticeButtons() {
  document.querySelectorAll("[data-log-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = state.practices.find((item) => item.id === btn.dataset.logPractice);
      if (!p) return;
      state.sessions.push(newRecord({
        date: todayKey(),
        label: p.title,
        minutes: p.minutes,
        durationSeconds: p.minutes * 60,
        mood: p.category
      }));
      ringBell();
      saveState();
    });
  });
  document.querySelectorAll("[data-start-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = state.practices.find((item) => item.id === btn.dataset.startPractice);
      if (!p) return;
      clearTimerTicker();
      timer = createTimerState(p.minutes, p.title);
      persistTimerState();
      setView("timer");
    });
  });
  document.querySelectorAll("[data-view-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const practice = state.practices.find((item) => item.id === btn.dataset.viewPractice);
      if (practice) openRitualDetail(practice);
    });
  });
  document.querySelectorAll("[data-edit-practice]").forEach((btn) => {
    btn.addEventListener("click", () => openPracticeDialog(state.practices.find((item) => item.id === btn.dataset.editPractice)));
  });
  document.querySelectorAll("[data-duplicate-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const source = state.practices.find((item) => item.id === btn.dataset.duplicatePractice);
      if (!source) return;
      const now = new Date().toISOString();
      state.practices.push({
        ...clone(source),
        id: makeId(),
        title: `${source.title} - copie`,
        archived: false,
        createdAt: now,
        updatedAt: now,
        version: 1
      });
      saveState();
      showToast("Pratique dupliquee.");
    });
  });
  document.querySelectorAll("[data-archive-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const practice = state.practices.find((item) => item.id === btn.dataset.archivePractice);
      if (!practice) return;
      practice.archived = !practice.archived;
      markUpdated(practice);
      saveState();
      showToast(practice.archived ? "Pratique archivee." : "Pratique restauree.");
    });
  });
  document.querySelectorAll("[data-delete-practice]").forEach((btn) => {
    btn.addEventListener("click", () => softDelete("practices", btn.dataset.deletePractice, "Supprimer cette pratique ?"));
  });
}

function openRitualDetail(practice) {
  const steps = practice.detailedSteps || [];
  openInfoDialog(practice.title, `
    <article class="detail-sheet">
      <div class="detail-meta">
        <span class="tag">${escapeHtml(practice.category)}</span>
        <span class="tag">${practice.minutes} min</span>
        <span class="tag">${steps.length} etapes</span>
      </div>
      <section class="detail-lead">
        <span class="eyebrow">Intention du rituel</span>
        <p>${escapeHtml(practice.purpose)}</p>
      </section>
      <section>
        <h3>Avant de commencer</h3>
        <p>${escapeHtml(practice.preparation)}</p>
      </section>
      <ol class="ritual-steps">
        ${steps.map((step, index) => `
          <li>
            <div class="step-number">${index + 1}</div>
            <div>
              <div class="row-head">
                <h3>${escapeHtml(step.title)}</h3>
                <span class="tag">${escapeHtml(step.duration || "")}</span>
              </div>
              <p>${escapeHtml(step.instruction)}</p>
            </div>
          </li>
        `).join("")}
      </ol>
      <section class="detail-callout">
        <h3>Cloture</h3>
        <p>${escapeHtml(practice.closing)}</p>
      </section>
      <section class="detail-caution">
        <h3>Point d'attention</h3>
        <p>${escapeHtml(practice.caution)}</p>
      </section>
    </article>
  `);
}

function renderJournal() {
  qs("#journal").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div><span class="eyebrow">Integration</span><h2>Journal de pratique</h2></div>
        <button class="primary-btn" id="addJournal">Nouvelle note</button>
      </div>
      <div class="journal-list">${state.journals.slice().reverse().map(journalCard).join("") || empty("Aucune note. Ajoutez une observation simple apres une session.")}</div>
    </section>
  `;
  qs("#addJournal").addEventListener("click", openJournalDialog);
  bindJournalActions();
}

function journalCard(entry) {
  return `
    <article class="journal-entry panel">
      <div class="row-head">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="tag">${entry.date}</span>
      </div>
      <p>${escapeHtml(entry.body)}</p>
      <div class="tag-row">
        <span class="tag">${escapeHtml(entry.mood || "presence")}</span>
        <span class="tag">${entry.minutes || 0} min</span>
      </div>
      <div class="button-row">
        <button class="ghost-btn" data-edit-journal="${entry.id}">Modifier</button>
        <button class="ghost-btn danger-btn" data-delete-journal="${entry.id}">Supprimer</button>
      </div>
    </article>
  `;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const days = buildCalendarDays(year, month, state.settings.firstDayOfWeek !== "sunday");
  qs("#calendar").innerHTML = `
    <section class="panel">
      <span class="eyebrow">Calendrier</span>
      <div class="calendar-toolbar">
        <div class="button-row">
          <button class="icon-btn" id="previousMonth" aria-label="Mois precedent">‹</button>
          <button class="ghost-btn" id="currentMonth">Aujourd'hui</button>
          <button class="icon-btn" id="nextMonth" aria-label="Mois suivant">›</button>
        </div>
        <h2>${calendarCursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h2>
      </div>
      <div class="calendar-grid">
        ${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<strong class="muted">${d}</strong>`).join("")}
        ${days.map((day) => {
          const seconds = sumSessionSeconds(state.sessions, day.key);
          const journalCount = state.journals.filter((entry) => entry.date === day.key).length;
          const mantraCount = state.mantra.history.filter((entry) => entry.date === day.key).reduce((sum, entry) => sum + Number(entry.count || 0), 0);
          const summary = [
            seconds ? formatDuration(seconds) : "",
            mantraCount ? `${mantraCount} mantra${mantraCount > 1 ? "s" : ""}` : "",
            journalCount ? `${journalCount} note${journalCount > 1 ? "s" : ""}` : ""
          ].filter(Boolean).join(" · ");
          return `<button class="calendar-day ${day.key === todayKey() ? "is-today" : ""} ${day.inCurrentMonth ? "" : "is-outside"}" data-calendar-day="${day.key}">
            <strong>${day.date.getDate()}</strong>
            <span>${summary}</span>
          </button>`;
        }).join("")}
      </div>
    </section>
  `;
  qs("#previousMonth").addEventListener("click", () => {
    calendarCursor = new Date(year, month - 1, 1);
    renderCalendar();
  });
  qs("#nextMonth").addEventListener("click", () => {
    calendarCursor = new Date(year, month + 1, 1);
    renderCalendar();
  });
  qs("#currentMonth").addEventListener("click", () => {
    calendarCursor = new Date();
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => openDayDetail(button.dataset.calendarDay));
  });
}

function openDayDetail(date) {
  const sessions = state.sessions.filter((session) => session.date === date);
  const journals = state.journals.filter((entry) => entry.date === date);
  const mantras = state.mantra.history.filter((entry) => entry.date === date);
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  openInfoDialog(dateLabel, `
    <article class="detail-sheet">
      <div class="button-row">
        <button class="primary-btn" id="addSessionForDay">Ajouter une session</button>
      </div>
      <section>
        <h3>Sessions</h3>
        <div class="day-detail-list">
          ${sessions.map((session) => `
            <article class="day-detail-item">
              <div>
                <strong>${escapeHtml(session.label)}</strong>
                <p>${formatDuration(sessionDurationSeconds(session))}${session.mood ? ` · ${escapeHtml(session.mood)}` : ""}</p>
              </div>
              <div class="button-row">
                <button class="ghost-btn" data-edit-session="${session.id}">Modifier</button>
                <button class="ghost-btn" data-delete-session="${session.id}">Supprimer</button>
              </div>
            </article>
          `).join("") || empty("Aucune session enregistree.")}
        </div>
      </section>
      <section>
        <h3>Mantras</h3>
        <div class="day-detail-list">
          ${mantras.map((entry) => `<article class="day-detail-item"><div><strong>${escapeHtml(entry.name)}</strong><p>${entry.count} repetitions</p></div></article>`).join("") || empty("Aucune accumulation de mantra.")}
        </div>
      </section>
      <section>
        <h3>Journal</h3>
        <div class="day-detail-list">
          ${journals.map((entry) => `
            <article class="day-detail-item">
              <div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.body)}</p></div>
              <button class="ghost-btn" data-edit-journal="${entry.id}">Modifier</button>
            </article>
          `).join("") || empty("Aucune note.")}
        </div>
      </section>
    </article>
  `);
  qs("#addSessionForDay").addEventListener("click", () => {
    qs("#practiceDialog").close();
    openSessionDialog(date);
  });
  bindSessionActions();
  document.querySelectorAll("[data-edit-journal]").forEach((button) => {
    button.addEventListener("click", () => {
      qs("#practiceDialog").close();
      openJournalDialog(state.journals.find((entry) => entry.id === button.dataset.editJournal));
    });
  });
}

function renderLibrary() {
  qs("#library").innerHTML = `
    <section class="panel">
      <span class="eyebrow">Bibliotheque</span>
      <h2>Guides de pratique</h2>
      <p class="muted">Ouvrez un guide pour consulter ses explications, sa mise en pratique et ses points d'attention.</p>
      <div class="library-grid">
        ${libraryItems.map((item) => `
          <article class="library-card">
            <span class="tag">${escapeHtml(item.type)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
            <a class="library-link" href="#guide-${item.id}" data-guide-id="${item.id}">
              Lire le guide complet <span aria-hidden="true">→</span>
            </a>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  document.querySelectorAll("[data-guide-id]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const guide = libraryItems.find((item) => item.id === link.dataset.guideId);
      if (guide) openGuideDetail(guide);
    });
  });
}

function openGuideDetail(guide) {
  openInfoDialog(guide.title, `
    <article class="detail-sheet guide-sheet">
      <div class="detail-meta">
        <span class="tag">${escapeHtml(guide.type)}</span>
        <span class="tag">${guide.sections.length} sections</span>
      </div>
      <p class="guide-intro">${escapeHtml(guide.intro)}</p>
      <div class="guide-sections">
        ${guide.sections.map((section) => `
          <section>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.text)}</p>
          </section>
        `).join("")}
      </div>
      <section class="detail-callout">
        <span class="eyebrow">Mise en pratique</span>
        <p>${escapeHtml(guide.practice)}</p>
      </section>
      <section class="detail-caution">
        <span class="eyebrow">Point d'attention</span>
        <p>${escapeHtml(guide.caution)}</p>
      </section>
    </article>
  `);
}

function renderSettings() {
  qs("#settings").innerHTML = `
    <section class="panel">
      <span class="eyebrow">Reglages</span>
      <h2>Personnalisation</h2>
      <div class="settings-grid">
        <div class="form-grid">
          <label>Objectif quotidien en minutes <input id="dailyGoal" type="number" min="1" max="360" value="${state.settings.dailyGoal}"></label>
          <label>Duree par defaut <input id="defaultTimer" type="number" min="1" max="180" value="${state.settings.defaultTimer}"></label>
          <label>Cloche sonore <select id="bellSetting"><option value="true" ${state.settings.bell ? "selected" : ""}>Activee</option><option value="false" ${!state.settings.bell ? "selected" : ""}>Desactivee</option></select></label>
          <label>Sauvegarde complete <button class="ghost-btn" id="exportData" type="button">Telecharger JSON</button></label>
          <label>Restaurer une sauvegarde
            <button class="ghost-btn" id="importData" type="button">Importer JSON</button>
            <input id="importFile" type="file" accept="application/json,.json" hidden>
          </label>
          <label>Historique des sessions <button class="ghost-btn" id="exportSessionsCsv" type="button">Exporter CSV</button></label>
          <label>Accumulations et mantras <button class="ghost-btn" id="exportAccumulationsCsv" type="button">Exporter CSV</button></label>
          <label>Journal et statistiques <button class="ghost-btn" id="printReport" type="button">Imprimer / PDF</button></label>
        </div>
        <div class="button-row">
          <button class="primary-btn" id="saveSettings">Enregistrer</button>
          <button class="ghost-btn" id="resetData">Reinitialiser l'app</button>
        </div>
      </div>
    </section>
  `;
  qs("#saveSettings").addEventListener("click", () => {
    state.settings.dailyGoal = Number(qs("#dailyGoal").value);
    state.settings.defaultTimer = Number(qs("#defaultTimer").value);
    state.settings.bell = qs("#bellSetting").value === "true";
    clearTimerTicker();
    timer = createTimerState(state.settings.defaultTimer, timer.label);
    persistTimerState();
    saveState();
  });
  qs("#resetData").addEventListener("click", () => {
    if (confirm("Reinitialiser toutes les donnees de ce compte ?")) {
      state = clone(seedState);
      localStorage.removeItem(storageKey());
      saveState();
      setView("dashboard");
    }
  });
  qs("#exportData").addEventListener("click", () => {
    downloadFile(`chemin-clair-${todayKey()}.json`, JSON.stringify(state, null, 2), "application/json");
  });
  qs("#importData").addEventListener("click", () => qs("#importFile").click());
  qs("#importFile").addEventListener("change", importBackupFile);
  qs("#exportSessionsCsv").addEventListener("click", exportSessionsCsv);
  qs("#exportAccumulationsCsv").addEventListener("click", exportAccumulationsCsv);
  qs("#printReport").addEventListener("click", printJournalReport);
}

function openSessionDialog(date = todayKey(), session = null) {
  const editing = Boolean(session);
  const duration = session ? sessionDurationSeconds(session) : 15 * 60;
  openDialog(editing ? "Modifier la session" : "Ajouter une session", `
    <div class="form-grid">
      <label>Nom <input id="sessionLabel" value="${escapeAttr(session?.label || "Pratique libre")}" required></label>
      <label>Minutes <input id="sessionMinutes" type="number" min="0" value="${Math.floor(duration / 60)}"></label>
      <label>Secondes <input id="sessionSeconds" type="number" min="0" max="59" value="${Math.round(duration % 60)}"></label>
      <label>Qualite <select id="sessionMood">${["stable", "agite", "clair", "fatigue", "profond"].map((mood) => `<option ${session?.mood === mood ? "selected" : ""}>${mood}</option>`).join("")}</select></label>
      <label>Date <input id="sessionDate" type="date" value="${escapeAttr(session?.date || date)}" required></label>
    </div>
  `, () => {
    const durationSeconds = Number(qs("#sessionMinutes").value || 0) * 60 + Number(qs("#sessionSeconds").value || 0);
    const values = {
      date: qs("#sessionDate").value,
      label: qs("#sessionLabel").value.trim() || "Pratique libre",
      durationSeconds,
      minutes: durationSeconds / 60,
      mood: qs("#sessionMood").value
    };
    if (session) {
      Object.assign(session, values);
      markUpdated(session);
    } else {
      const now = new Date().toISOString();
      state.sessions.push({ id: makeId(), ...values, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function openPracticeDialog(practice = null) {
  const stepsText = practice
    ? (practice.detailedSteps || []).map((step) => `${step.title} | ${step.instruction || ""}`).join("\n")
    : `Preparation | Stabiliser le corps et poser l'intention.
Pratique principale | Suivre les instructions personnelles autorisees avec attention.
Dedication | Reposer l'esprit et dedier les bienfaits.`;
  openDialog(practice ? "Modifier la pratique" : "Nouvelle pratique", `
    <label>Titre <input id="practiceTitle" value="${escapeAttr(practice?.title || "Nouvelle pratique")}" required></label>
    <div class="form-grid">
      <label>Categorie <input id="practiceCategory" value="${escapeAttr(practice?.category || "Personnel")}"></label>
      <label>Duree <input id="practiceMinutes" type="number" min="1" value="${practice?.minutes || 10}"></label>
    </div>
    <label>But de la pratique <textarea id="practicePurpose">${escapeHtml(practice?.purpose || "Clarifier l'intention de cette pratique personnelle.")}</textarea></label>
    <label>Preparation <textarea id="practicePreparation">${escapeHtml(practice?.preparation || "Preparer un espace calme, regler le minuteur et adopter une posture stable.")}</textarea></label>
    <label>Etapes detaillees, une par ligne au format Titre | Instructions
      <textarea id="practiceSteps">${escapeHtml(stepsText)}</textarea>
    </label>
    <label>Cloture <textarea id="practiceClosing">${escapeHtml(practice?.closing || "Terminer par quelques respirations calmes avant de se lever.")}</textarea></label>
    <label>Point d'attention <textarea id="practiceCaution">${escapeHtml(practice?.caution || "Adapter la pratique a sa situation et aux instructions de son enseignant.")}</textarea></label>
    <label>Resume <textarea id="practiceNotes">${escapeHtml(practice?.notes || "Sequence personnelle a utiliser dans le respect des transmissions recues.")}</textarea></label>
  `, () => {
    const detailedSteps = qs("#practiceSteps").value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, ...instructionParts] = line.split("|");
        return {
          title: title.trim(),
          duration: "",
          instruction: instructionParts.join("|").trim() || "Accomplir cette etape avec attention."
        };
      });
    const values = {
      title: qs("#practiceTitle").value,
      category: qs("#practiceCategory").value,
      minutes: Number(qs("#practiceMinutes").value),
      steps: detailedSteps.map((step) => step.title),
      detailedSteps,
      purpose: qs("#practicePurpose").value,
      preparation: qs("#practicePreparation").value,
      closing: qs("#practiceClosing").value,
      caution: qs("#practiceCaution").value,
      notes: qs("#practiceNotes").value
    };
    if (practice) {
      Object.assign(practice, values);
      markUpdated(practice);
    } else {
      const now = new Date().toISOString();
      state.practices.push({ id: makeId(), ...values, archived: false, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function openJournalDialog(entry = null) {
  openDialog(entry ? "Modifier la note" : "Nouvelle note", `
    <label>Titre <input id="journalTitle" value="${escapeAttr(entry?.title || "Apres la pratique")}" required></label>
    <div class="form-grid">
      <label>Date <input id="journalDate" type="date" value="${escapeAttr(entry?.date || todayKey())}"></label>
      <label>Minutes <input id="journalMinutes" type="number" min="0" value="${entry?.minutes ?? minutesFor(todayKey())}"></label>
      <label>Etat <input id="journalMood" value="${escapeAttr(entry?.mood || "presence")}"></label>
    </div>
    <label>Note <textarea id="journalBody">${escapeHtml(entry?.body || "Ce que je remarque aujourd'hui...")}</textarea></label>
  `, () => {
    const values = {
      title: qs("#journalTitle").value,
      date: qs("#journalDate").value,
      minutes: Number(qs("#journalMinutes").value),
      mood: qs("#journalMood").value,
      body: qs("#journalBody").value
    };
    if (entry) {
      Object.assign(entry, values);
      markUpdated(entry);
    } else {
      const now = new Date().toISOString();
      state.journals.push({ id: makeId(), ...values, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function markUpdated(record) {
  record.updatedAt = new Date().toISOString();
  record.version = Number(record.version || 1) + 1;
}

function newRecord(values) {
  const now = new Date().toISOString();
  return { id: makeId(), ...values, createdAt: now, updatedAt: now, version: 1 };
}

function softDelete(collection, id, question = "Supprimer cet element ?") {
  if (!confirm(question) || !removeWithUndo(state, collection, id)) return;
  saveState();
  showToast("Element place dans la corbeille.", true);
}

function undoLastDelete() {
  if (!restoreLastDeleted(state)) return;
  saveState();
  showToast("Suppression annulee.");
}

function showToast(message, canUndo = false, actionLabel = "Annuler", action = null) {
  clearTimeout(toastTimer);
  const toast = qs("#undoToast");
  qs("#undoToastMessage").textContent = message;
  const button = qs("#undoDeleteBtn");
  button.hidden = !canUndo && !action;
  button.textContent = actionLabel;
  button.onclick = action || undoLastDelete;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

function bindSessionActions() {
  document.querySelectorAll("[data-edit-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const session = state.sessions.find((item) => item.id === button.dataset.editSession);
      if (!session) return;
      qs("#practiceDialog").close();
      openSessionDialog(session.date, session);
    });
  });
  document.querySelectorAll("[data-delete-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const session = state.sessions.find((item) => item.id === button.dataset.deleteSession);
      if (!session) return;
      qs("#practiceDialog").close();
      softDelete("sessions", session.id, "Supprimer cette session ? Elle pourra etre restauree immediatement.");
    });
  });
}

function bindJournalActions() {
  document.querySelectorAll("[data-edit-journal]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.journals.find((item) => item.id === button.dataset.editJournal);
      if (entry) openJournalDialog(entry);
    });
  });
  document.querySelectorAll("[data-delete-journal]").forEach((button) => {
    button.addEventListener("click", () => softDelete("journals", button.dataset.deleteJournal, "Supprimer cette note ?"));
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportSessionsCsv() {
  const rows = [
    ["id", "date", "pratique", "duree_secondes", "duree_minutes", "qualite"],
    ...state.sessions.map((session) => [
      session.id,
      session.date,
      session.label,
      sessionDurationSeconds(session),
      (sessionDurationSeconds(session) / 60).toFixed(2),
      session.mood || ""
    ])
  ];
  downloadFile(`chemin-clair-sessions-${todayKey()}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function exportAccumulationsCsv() {
  const rows = [["type", "id", "date", "nom", "nombre", "objectif"]];
  state.mantra.history.forEach((entry) => rows.push(["mantra", entry.id, entry.date, entry.name, entry.count, ""]));
  state.accumulations.forEach((entry) => rows.push([
    "accumulation",
    entry.id,
    entry.date || entry.startDate || "",
    entry.name || entry.title || "",
    entry.count || entry.current || 0,
    entry.target || entry.goal || ""
  ]));
  downloadFile(`chemin-clair-accumulations-${todayKey()}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

async function importBackupFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const validation = validateBackup(imported);
    if (!validation.valid) throw new Error(validation.errors.join("\n"));
    const counts = {
      sessions: imported.sessions?.length || 0,
      journals: imported.journals?.length || 0,
      practices: imported.practices?.length || 0,
      accumulations: imported.accumulations?.length || 0
    };
    openImportPreview(imported, counts);
  } catch (error) {
    openInfoDialog("Sauvegarde invalide", `
      <p>Le fichier ne peut pas etre importe.</p>
      <pre class="import-error">${escapeHtml(error.message || "Format JSON invalide.")}</pre>
    `);
  }
}

function openImportPreview(imported, counts) {
  openInfoDialog("Apercu de la sauvegarde", `
    <p>Le fichier est valide. Verifiez son contenu avant de poursuivre.</p>
    <div class="metrics-grid import-preview">
      ${metric("Sessions", counts.sessions, "enregistrements")}
      ${metric("Journal", counts.journals, "notes")}
      ${metric("Pratiques", counts.practices, "sequences")}
      ${metric("Accumulations", counts.accumulations, "engagements")}
    </div>
    <div class="detail-caution">
      <strong>Remplacer</strong> efface l'etat actuel de ce compte avant d'importer. Une sauvegarde automatique sera telechargee d'abord.
    </div>
    <div class="button-row">
      <button class="primary-btn" id="mergeImport" type="button">Fusionner</button>
      <button class="ghost-btn danger-btn" id="replaceImport" type="button">Remplacer</button>
    </div>
  `);
  qs("#mergeImport").addEventListener("click", () => {
    state = mergeImportedState(state, imported, seedState);
    qs("#practiceDialog").close();
    saveState();
    showToast("Sauvegarde fusionnee.");
  });
  qs("#replaceImport").addEventListener("click", () => {
    if (!confirm("Remplacer toutes les donnees actuelles par cette sauvegarde ?")) return;
    downloadFile(`chemin-clair-avant-import-${todayKey()}.json`, JSON.stringify(state, null, 2), "application/json");
    state = mergeState(seedState, imported);
    qs("#practiceDialog").close();
    saveState();
    showToast("Sauvegarde restauree.");
  });
}

function openSyncConflict(payload) {
  const cloudState = payload.data ? mergeState(seedState, payload.data) : migrateState(null, seedState);
  const cloudRevision = Number(payload.revision || 0);
  openInfoDialog("Modifications sur plusieurs appareils", `
    <p>Des changements plus recents existent deja dans le nuage. Choisissez comment les reunir.</p>
    <div class="button-stack">
      <button class="primary-btn" id="mergeConflict" type="button">Fusionner les deux versions</button>
      <button class="ghost-btn" id="keepCloudConflict" type="button">Utiliser la version du nuage</button>
      <button class="ghost-btn danger-btn" id="keepLocalConflict" type="button">Garder uniquement cet appareil</button>
    </div>
  `);
  qs("#mergeConflict").addEventListener("click", async () => {
    state = mergeImportedState(cloudState, state, seedState);
    remoteRevision = cloudRevision;
    qs("#practiceDialog").close();
    localStorage.setItem(storageKey(), JSON.stringify(state));
    await syncStateNow();
    render();
  });
  qs("#keepCloudConflict").addEventListener("click", () => {
    state = cloudState;
    remoteRevision = cloudRevision;
    localStorage.setItem(storageKey(), JSON.stringify(state));
    localStorage.setItem(revisionStorageKey(), String(remoteRevision));
    localStorage.removeItem(`${storageKey()}:dirty`);
    syncStatus = "synced";
    qs("#practiceDialog").close();
    render();
  });
  qs("#keepLocalConflict").addEventListener("click", async () => {
    if (!confirm("Remplacer la version du nuage par les donnees de cet appareil ?")) return;
    remoteRevision = cloudRevision;
    qs("#practiceDialog").close();
    await syncStateNow({ force: true });
    render();
  });
}

function printJournalReport() {
  const windowRef = window.open("", "_blank", "noopener,noreferrer");
  if (!windowRef) {
    showToast("Autorisez les fenetres contextuelles pour imprimer.");
    return;
  }
  const totalSeconds = sumSessionSeconds(state.sessions);
  windowRef.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Chemin Clair - Rapport</title>
    <style>body{font:16px/1.55 Georgia,serif;max-width:820px;margin:40px auto;padding:0 24px;color:#2c2622}h1,h2{color:#6f263d}article{border-top:1px solid #d8c9bb;padding:14px 0}.muted{color:#6d625b}@media print{button{display:none}}</style>
    </head><body><h1>Chemin Clair</h1><p class="muted">Rapport du ${new Date().toLocaleDateString("fr-FR")}</p>
    <h2>Statistiques</h2><p>${state.sessions.length} sessions · ${formatDuration(totalSeconds)} de pratique · ${state.mantra.history.reduce((sum, item) => sum + Number(item.count || 0), 0)} mantras</p>
    <h2>Journal</h2>${state.journals.slice().reverse().map((entry) => `<article><strong>${escapeHtml(entry.title)}</strong><div class="muted">${escapeHtml(entry.date)} · ${Number(entry.minutes || 0)} min</div><p>${escapeHtml(entry.body)}</p></article>`).join("") || "<p>Aucune note.</p>"}
    <button onclick="window.print()">Imprimer ou enregistrer en PDF</button></body></html>`);
  windowRef.document.close();
}

function openDialog(title, body, onSave) {
  qs("#dialogTitle").textContent = title;
  qs("#dialogBody").innerHTML = body;
  const dialog = qs("#practiceDialog");
  const save = qs("#dialogSave");
  const cancel = qs("#practiceDialog menu .ghost-btn");
  save.hidden = false;
  cancel.textContent = "Annuler";
  save.onclick = (event) => {
    event.preventDefault();
    onSave();
    dialog.close();
  };
  dialog.showModal();
}

function openInfoDialog(title, body) {
  qs("#dialogTitle").textContent = title;
  qs("#dialogBody").innerHTML = body;
  const dialog = qs("#practiceDialog");
  qs("#dialogSave").hidden = true;
  qs("#practiceDialog menu .ghost-btn").textContent = "Fermer";
  dialog.showModal();
}

function ringBell() {
  if (!state.settings.bell) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(432, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(216, ctx.currentTime + 1.4);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.7);
  } catch {
    // Audio can be blocked by the browser until the first user interaction.
  }
}

function empty(text) {
  return `<p class="muted">${escapeHtml(text)}</p>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function renderView() {
  const renderers = {
    dashboard: renderDashboard,
    timer: renderTimer,
    mantras: renderMantras,
    rituals: renderRituals,
    journal: renderJournal,
    calendar: renderCalendar,
    library: renderLibrary,
    settings: renderSettings
  };
  renderers[activeView]();
}

function render() {
  renderShellStats();
  renderAccountPanel();
  renderView();
}

function openAuthDialog(mode = "login") {
  authMode = mode;
  const registering = authMode === "register";
  qs("#authTitle").textContent = registering ? "Creer un compte" : "Connexion";
  qs("#authIntro").textContent = registering
    ? "Creez un compte pour conserver et synchroniser vos pratiques."
    : "Retrouvez vos pratiques et votre progression sur tous vos appareils.";
  qs("#authNameLabel").hidden = !registering;
  qs("#authName").required = registering;
  qs("#authPassword").autocomplete = registering ? "new-password" : "current-password";
  qs("#authSubmit").textContent = registering ? "Creer mon compte" : "Se connecter";
  qs("#authModeBtn").textContent = registering ? "J'ai deja un compte" : "Creer un compte";
  qs("#authMessage").textContent = "";
  qs("#authMessage").classList.remove("is-success");
  qs("#authDialog").showModal();
}

async function submitAuth(event) {
  event.preventDefault();
  const submit = qs("#authSubmit");
  const message = qs("#authMessage");
  submit.disabled = true;
  message.textContent = authMode === "register" ? "Creation du compte..." : "Connexion...";
  try {
    const response = await fetch(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: qs("#authName").value,
        email: qs("#authEmail").value,
        password: qs("#authPassword").value
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Operation impossible.");

    const guestState = state;
    currentUser = payload.user;
    const accountCache = localStorage.getItem(storageKey());
    state = accountCache ? loadCachedState(currentUser.id) : guestState;
    remoteRevision = Number(localStorage.getItem(revisionStorageKey()) || 0);
    timer = loadTimerState();
    localStorage.setItem(storageKey(), JSON.stringify(state));
    if (!accountCache) localStorage.setItem(`${storageKey()}:dirty`, "1");
    message.textContent = "Compte connecte. Synchronisation en cours...";
    message.classList.add("is-success");
    await restoreRemoteState({ importLocalWhenEmpty: true });
    qs("#authDialog").close();
    qs("#authForm").reset();
  } catch (error) {
    message.textContent = error.message || "Operation impossible.";
  } finally {
    submit.disabled = false;
  }
}

async function logoutAccount() {
  clearTimeout(syncTimer);
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // The local account switch still succeeds if the network is unavailable.
  }
  currentUser = null;
  remoteRevision = 0;
  syncStatus = "local";
  state = loadCachedState();
  clearTimerTicker();
  timer = loadTimerState();
  render();
  setView("dashboard");
}

qs("#newIntentionBtn").addEventListener("click", () => {
  openDialog("Nouvelle intention", `
    <label>Intention <textarea id="intentionText">Que cette journee devienne une occasion de clarte et de bienveillance.</textarea></label>
  `, () => {
    state.intentions.push(qs("#intentionText").value.trim());
    saveState();
  });
});

renderNav();
setView(activeView);
renderShellStats();
renderAccountPanel();

qs("#closeAuthBtn").addEventListener("click", () => qs("#authDialog").close());
qs("#authModeBtn").addEventListener("click", () => openAuthDialog(authMode === "login" ? "register" : "login"));
qs("#authForm").addEventListener("submit", submitAuth);

window.addEventListener("focus", () => {
  if (currentUser) restoreRemoteState({ importLocalWhenEmpty: false });
});

window.addEventListener("online", () => {
  if (currentUser) syncStateNow();
});

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showToast("Une nouvelle version est disponible.", false, "Mettre a jour", () => {
            worker.postMessage({ type: "SKIP_WAITING" });
          });
        }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  } catch {
    // L'application reste utilisable en ligne si l'installation PWA est indisponible.
  }
}

initializeAccount();
registerServiceWorker();
