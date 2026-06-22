import {
  CURRENT_SCHEMA_VERSION,
  accumulationPace,
  accumulationPeriodTotal,
  buildCalendarDays,
  accumulationTotal,
  calculateStreak,
  elapsedTimerSeconds,
  localDateKey,
  makeStableId,
  mergeImportedState,
  migrateState,
  recordNestedDeletions,
  removeWithUndo,
  remainingTimerSeconds,
  routineDurationSeconds,
  sessionsByDay,
  restoreLastDeleted,
  sessionDurationSeconds,
  sumSessionSeconds,
  validateBackup
} from "./core.js";
import { buildTibetanCalendar, TIBETAN_CALENDAR_SOURCES } from "./tibetan-calendar.js";

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
  ["routines", "Routines", "▶"],
  ["mantras", "Mantras", "108"],
  ["accumulations", "Accumulations", "＋"],
  ["rituals", "Rituels", "☼"],
  ["journal", "Journal", "✎"],
  ["calendar", "Calendrier", "▦"],
  ["tibetanCalendar", "Calendrier tibetain", "◑"],
  ["retreats", "Retraite", "◇"],
  ["library", "Bibliotheque", "☷"],
  ["audio", "Audio", "♪"],
  ["reminders", "Rappels", "◉"],
  ["stats", "Statistiques", "▥"],
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
    statsVisible: true,
    streaksVisible: true,
    tibetanCalendarProfile: "personnalise",
    remindersPaused: false,
    language: "fr",
    theme: "auto",
    textSize: "normal",
    highContrast: false,
    reducedMotion: false,
    vibration: false,
    dateFormat: "long",
    firstDayOfWeek: "monday",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cloudSyncEnabled: true
  },
  intentions: [
    "Que cette pratique nourrisse la clarte, la patience et une compassion concrete.",
    "Aujourd'hui, revenir simplement au souffle avant de reagir.",
    "Dedier les efforts aux personnes qui traversent une difficulte."
  ],
  practices: defaultPractices,
  sessions: [],
  journals: [],
  journalTags: [],
  deletedItems: [],
  routines: [
    {
      id: "routine-matin",
      name: "Routine du matin",
      description: "Ouvrir la journee avec une intention claire et une attention stable.",
      days: [1, 2, 3, 4, 5, 6, 0],
      time: "07:30",
      archived: false,
      steps: [
        { id: "routine-matin-1", practiceTitle: "Refuge et bodhicitta", minutes: 5, optional: false },
        { id: "routine-matin-2", practiceTitle: "Calme mental", minutes: 15, optional: false },
        { id: "routine-matin-3", practiceTitle: "Dedication", minutes: 3, optional: false }
      ]
    },
    {
      id: "routine-soir",
      name: "Routine du soir",
      description: "Revenir sur la journee avec douceur et conclure sans precipitation.",
      days: [1, 2, 3, 4, 5, 6, 0],
      time: "21:00",
      archived: false,
      steps: [
        { id: "routine-soir-1", practiceTitle: "Calme mental", minutes: 10, optional: false },
        { id: "routine-soir-2", practiceTitle: "Tonglen", minutes: 8, optional: true },
        { id: "routine-soir-3", practiceTitle: "Dedication", minutes: 4, optional: false }
      ]
    }
  ],
  accumulations: [],
  retreats: [],
  libraryItems: [],
  audioItems: [],
  reminders: [],
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
let focusSession = null;
let focusInterval = null;
let journalFilters = { query: "", type: "all", practice: "all", tag: "all", dateFrom: "", dateTo: "", favorite: false, sort: "newest" };
let statsPeriod = 30;
let statsPractice = "all";
let statsCategory = "all";
let tibetanCalendarYear = new Date().getFullYear();
let tibetanCalendarType = "all";
let tibetanCalendarPeriod = "upcoming";
let activeAudioUrl = null;
let reminderInterval = null;

const qs = (selector) => document.querySelector(selector);
const drawerMedia = window.matchMedia("(max-width: 1120px)");

function setSidebarOpen(open, { restoreFocus = false } = {}) {
  const sidebar = qs("#mainSidebar");
  const tab = qs("#menuTab");
  const backdrop = qs("#sidebarBackdrop");
  if (!sidebar || !tab || !backdrop) return;
  const drawerMode = drawerMedia.matches;
  const shouldOpen = drawerMode && open;
  document.body.classList.toggle("sidebar-open", shouldOpen);
  tab.setAttribute("aria-expanded", String(shouldOpen));
  tab.setAttribute("aria-label", shouldOpen ? "Fermer le menu" : "Ouvrir le menu");
  backdrop.hidden = !shouldOpen;
  sidebar.inert = drawerMode && !shouldOpen;
  if (shouldOpen) {
    requestAnimationFrame(() => sidebar.querySelector(".nav-btn.is-active, .nav-btn")?.focus());
  } else if (restoreFocus && drawerMode) {
    tab.focus();
  }
}

function syncSidebarMode() {
  if (drawerMedia.matches) {
    setSidebarOpen(false);
  } else {
    document.body.classList.remove("sidebar-open");
    qs("#mainSidebar").inert = false;
    qs("#sidebarBackdrop").hidden = true;
    qs("#menuTab").setAttribute("aria-expanded", "false");
  }
}

function applyPreferences() {
  const settings = state.settings || {};
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = settings.theme === "auto" ? (prefersDark ? "dark" : "light") : settings.theme;
  document.documentElement.dataset.theme = resolvedTheme || "light";
  document.documentElement.dataset.textSize = settings.textSize || "normal";
  document.documentElement.classList.toggle("high-contrast", Boolean(settings.highContrast));
  document.documentElement.classList.toggle("reduce-motion", Boolean(settings.reducedMotion));
  document.documentElement.lang = settings.language || "fr";
}

function formatDisplayDate(value, options = {}) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const formats = {
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
    iso: { year: "numeric", month: "2-digit", day: "2-digit" },
    long: { day: "numeric", month: "long", year: "numeric" }
  };
  if (state.settings.dateFormat === "iso" && !options.weekday) return localDateKey(date);
  try {
    return date.toLocaleDateString(state.settings.language === "fr" ? "fr-FR" : "en-GB", {
      ...(formats[state.settings.dateFormat] || formats.long),
      ...options,
      timeZone: state.settings.timezone || undefined
    });
  } catch {
    return date.toLocaleDateString("fr-FR", { ...(formats.long), ...options });
  }
}

function isValidTimeZone(value) {
  try {
    Intl.DateTimeFormat("fr-FR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

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

function stateForRemoteSync() {
  const remoteState = clone(state);
  remoteState.journals = remoteState.journals.map((entry) => ({
    ...entry,
    image: entry.image ? { ...entry.image, dataUrl: undefined, localOnly: true } : null
  }));
  return remoteState;
}

function preserveLocalJournalImages(remoteState) {
  const localImages = new Map(
    state.journals
      .filter((entry) => entry.image?.dataUrl)
      .map((entry) => [entry.id, entry.image])
  );
  remoteState.journals.forEach((entry) => {
    if (localImages.has(entry.id)) entry.image = localImages.get(entry.id);
  });
  return remoteState;
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
  applyPreferences();
  if (currentUser && remote && state.settings.cloudSyncEnabled !== false) localStorage.setItem(`${storageKey()}:dirty`, "1");
  render();
  if (currentUser && remote && state.settings.cloudSyncEnabled !== false) scheduleRemoteSync();
}

function scheduleRemoteSync() {
  clearTimeout(syncTimer);
  syncStatus = "syncing";
  renderAccountPanel();
  syncTimer = setTimeout(syncStateNow, 500);
}

async function syncStateNow({ force = false, bypassPreference = false } = {}) {
  if (!currentUser || (!bypassPreference && state.settings.cloudSyncEnabled === false)) return;
  try {
    syncStatus = "syncing";
    renderAccountPanel();
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: stateForRemoteSync(), expectedRevision: remoteRevision, force })
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
  if (!currentUser || state.settings.cloudSyncEnabled === false) {
    syncStatus = currentUser ? "local" : syncStatus;
    renderAccountPanel();
    return;
  }
  if (localStorage.getItem(`${storageKey()}:dirty`) === "1") {
    await syncStateNow();
    if (syncStatus === "synced") {
      render();
    }
    return;
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
      state = preserveLocalJournalImages(mergeState(seedState, payload.data));
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
  const sessions = state.sessions.filter((session) => new Date(`${session.date}T12:00:00`) >= start);
  return sumSessionSeconds(sessions) / 60;
}

function countedSessions(sessions = state.sessions) {
  return sessions.filter((session) => sessionDurationSeconds(session) > 0);
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
  if (drawerMedia.matches) setSidebarOpen(false);
}

function renderNav() {
  qs("#navList").innerHTML = navItems
    .filter(([id]) => id !== "stats" || state.settings.statsVisible !== false)
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
  qs("#sidebarStreak").hidden = state.settings.streaksVisible === false;
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
    local: state.settings.cloudSyncEnabled === false ? "Synchronisation suspendue" : "Sauvegarde locale"
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
  const todayDay = new Date().getDay();
  const todayRoutine = state.routines.find((routine) => !routine.archived && (!routine.days?.length || routine.days.includes(todayDay)));
  const activeAccumulation = state.accumulations.find((item) => !item.archived);
  const todayEvent = [...state.calendarEvents, ...buildTibetanCalendar(new Date().getFullYear())]
    .find((event) => event.date === todayKey());
  const activeRetreat = state.retreats.find((retreat) => !retreat.archived && retreat.startDate <= todayKey() && retreat.endDate >= todayKey());
  qs("#dashboard").innerHTML = `
    <div class="metrics-grid">
      ${metric("Aujourd'hui", `${todayMinutes} min`, `${Math.max(0, state.settings.dailyGoal - todayMinutes)} min restantes`)}
      ${state.settings.streaksVisible === false ? "" : metric("Serie", `${streak()} jours`, "avec au moins une session")}
      ${metric("Semaine", `${weekMinutes()} min`, `${countedSessions().length} sessions au total`)}
      ${metric("Mantras", totalMantras(), `${state.mantra.selected}`)}
    </div>
    <div class="dashboard-actions">
      <section class="panel">
        <span class="eyebrow">Routine du jour</span>
        <h2>${escapeHtml(todayRoutine?.name || "Aucune routine planifiee")}</h2>
        <p>${todayRoutine ? `${formatDuration(routineDurationSeconds(todayRoutine))} · ${todayRoutine.steps.length} etapes` : "Choisissez librement une pratique ou creez une routine."}</p>
        <button class="primary-btn" id="startTodayRoutine" ${todayRoutine ? "" : "disabled"}>Commencer ma routine</button>
      </section>
      <section class="panel">
        <span class="eyebrow">Accumulation active</span>
        <h2>${escapeHtml(activeAccumulation?.name || "Aucune accumulation")}</h2>
        <p>${activeAccumulation ? `${accumulationTotal(activeAccumulation).toLocaleString("fr-FR")} sur ${Number(activeAccumulation.target || 0).toLocaleString("fr-FR")}` : "Vous pouvez creer un engagement personnel sans pression."}</p>
        <button class="ghost-btn" data-view-link="accumulations">Ouvrir les accumulations</button>
      </section>
      <section class="panel">
        <span class="eyebrow">Calendrier tibetain</span>
        <h2>${escapeHtml(todayEvent?.name || "Aucun evenement ajoute")}</h2>
        <p>${escapeHtml(todayEvent?.explanation || "Les dates affichees proviennent uniquement de vos sources.")}</p>
        <button class="ghost-btn" data-view-link="tibetanCalendar">Ouvrir le calendrier</button>
      </section>
      <section class="panel">
        <span class="eyebrow">Retraite</span>
        <h2>${escapeHtml(activeRetreat?.name || "Aucune retraite en cours")}</h2>
        <p>${escapeHtml(activeRetreat?.intention || "Vous pouvez preparer un programme de retraite personnel.")}</p>
        <button class="ghost-btn" data-view-link="retreats">Ouvrir le mode retraite</button>
      </section>
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
        <div class="practice-list dashboard-practice-list">
          ${state.practices.filter((practice) => !practice.archived).slice(0, 4).map((practice) => practiceRow(practice)).join("")}
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
  qs("#startTodayRoutine").addEventListener("click", () => todayRoutine && startRoutine(todayRoutine));
  qs('[data-view-link="accumulations"]').addEventListener("click", () => setView("accumulations"));
  qs('[data-view-link="tibetanCalendar"]').addEventListener("click", () => setView("tibetanCalendar"));
  qs('[data-view-link="retreats"]').addEventListener("click", () => setView("retreats"));
  bindPracticeButtons();
  bindJournalActions();
}

function metric(label, value, hint) {
  return `<article class="metric-card"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="muted">${hint}</span></article>`;
}

function practiceRow(p, detailed = false) {
  const steps = p.detailedSteps || (p.steps || []).map((title) => ({ title, instruction: "" }));
  const practiceActions = `
    ${detailed ? `<button class="ghost-btn" data-view-practice="${p.id}">Rituel complet</button>` : ""}
    ${detailed ? `<button class="primary-btn" data-guide-practice="${p.id}">Mode guide</button>` : ""}
    <button class="ghost-btn" data-start-practice="${p.id}">${p.minutes} min</button>
    <button class="primary-btn" data-log-practice="${p.id}">Valider</button>
  `;
  return `
    <article class="practice-row ${detailed ? "practice-row-detailed" : "practice-row-compact"}">
      <div class="${detailed ? "ritual-card-content" : ""}">
        <div class="row-head">
          <h3>${escapeHtml(p.title)}</h3>
          <div class="tag-row ritual-card-meta">
            <span class="tag">${escapeHtml(p.category)}</span>
            ${detailed ? `<span class="tag">${p.minutes} min</span><span class="tag">${steps.length} etapes</span>` : ""}
          </div>
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
      ${detailed ? `
        <div class="ritual-actions">
          <div class="button-row">${practiceActions}</div>
          <div class="button-row ritual-management" aria-label="Gestion de ${escapeAttr(p.title)}">
            <button class="icon-btn" data-edit-practice="${p.id}" aria-label="Modifier ${escapeAttr(p.title)}" title="Modifier">✎</button>
            <button class="icon-btn" data-duplicate-practice="${p.id}" aria-label="Dupliquer ${escapeAttr(p.title)}" title="Dupliquer">⧉</button>
            <button class="icon-btn" data-archive-practice="${p.id}" aria-label="${p.archived ? "Restaurer" : "Archiver"} ${escapeAttr(p.title)}" title="${p.archived ? "Restaurer" : "Archiver"}">${p.archived ? "↥" : "⌄"}</button>
            <button class="icon-btn danger-btn" data-delete-practice="${p.id}" aria-label="Supprimer ${escapeAttr(p.title)}" title="Supprimer">×</button>
          </div>
        </div>
      ` : `<div class="button-row">${practiceActions}</div>`}
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
        <article class="practice-row"><div><h3>${escapeHtml(h.name)}</h3><p>${formatDisplayDate(h.date)} · ${h.count} repetitions</p></div></article>
      `).join("") || empty("Aucun cycle sauvegarde.")}</div>
    </section>
  `;
  qs("#mantraName").addEventListener("change", (e) => {
    state.mantra.selected = e.target.value.trim() || "Mantra";
    markUpdated(state.mantra, ["selected"]);
    saveState();
  });
  qs("#addMantra").addEventListener("click", () => {
    state.mantra.count += 1;
    markUpdated(state.mantra, ["count"]);
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate(18);
    if (state.settings.bell && state.mantra.count % 108 === 0) ringBell();
    saveState();
  });
  qs("#addMala").addEventListener("click", () => {
    state.mantra.count += 108;
    markUpdated(state.mantra, ["count"]);
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate([25, 30, 25]);
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
      markUpdated(state.mantra, ["count", "history"]);
      saveState();
    }
  });
  qs("#resetMantra").addEventListener("click", () => {
    state.mantra.count = 0;
    markUpdated(state.mantra, ["count"]);
    saveState();
  });
}

function renderRoutines() {
  const active = state.routines.filter((routine) => !routine.archived);
  const archived = state.routines.filter((routine) => routine.archived);
  qs("#routines").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Sequences personnelles</span>
          <h2>Routines de pratique</h2>
          <p class="muted">Assemblez plusieurs pratiques, ajustez leurs durees et lancez-les dans un espace calme.</p>
        </div>
        <button class="primary-btn" id="addRoutine">Nouvelle routine</button>
      </div>
      <div class="routine-grid">
        ${active.map(routineCard).join("") || empty("Aucune routine active.")}
      </div>
      ${archived.length ? `
        <details class="archived-section">
          <summary>Routines archivees (${archived.length})</summary>
          <div class="routine-grid">${archived.map(routineCard).join("")}</div>
        </details>
      ` : ""}
    </section>
  `;
  qs("#addRoutine").addEventListener("click", () => openRoutineDialog());
  bindRoutineActions();
}

function routineCard(routine) {
  const total = routineDurationSeconds(routine);
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return `
    <article class="routine-card">
      <div class="row-head">
        <div><h3>${escapeHtml(routine.name)}</h3><p>${escapeHtml(routine.description || "")}</p></div>
        <span class="tag">${formatDuration(total)}</span>
      </div>
      <ol class="routine-steps">
        ${(routine.steps || []).map((step, index) => `
          <li>
            <span>${index + 1}</span>
            <div><strong>${escapeHtml(step.practiceTitle)}</strong><small>${step.minutes} min${step.optional ? " · facultative" : ""}</small></div>
            <div class="step-actions">
              <button class="icon-btn" data-routine-up="${routine.id}:${index}" aria-label="Monter l'etape" ${index === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-btn" data-routine-down="${routine.id}:${index}" aria-label="Descendre l'etape" ${index === routine.steps.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </li>
        `).join("")}
      </ol>
      <p class="muted">${(routine.days || []).map((day) => dayNames[day]).join(" · ") || "Jours libres"}${routine.time ? ` · ${routine.time}` : ""}</p>
      <div class="button-row">
        <button class="primary-btn" data-start-routine="${routine.id}" ${routine.archived ? "disabled" : ""}>Commencer</button>
        <button class="ghost-btn" data-edit-routine="${routine.id}">Modifier</button>
        <button class="icon-btn" data-copy-routine="${routine.id}" aria-label="Dupliquer" title="Dupliquer">⧉</button>
        <button class="icon-btn" data-archive-routine="${routine.id}" aria-label="${routine.archived ? "Restaurer" : "Archiver"}" title="${routine.archived ? "Restaurer" : "Archiver"}">${routine.archived ? "↥" : "⌄"}</button>
        <button class="icon-btn danger-btn" data-delete-routine="${routine.id}" aria-label="Supprimer" title="Supprimer">×</button>
      </div>
    </article>
  `;
}

function bindRoutineActions() {
  document.querySelectorAll("[data-start-routine]").forEach((button) => {
    button.addEventListener("click", () => {
      const routine = state.routines.find((item) => item.id === button.dataset.startRoutine);
      if (routine) startRoutine(routine);
    });
  });
  document.querySelectorAll("[data-edit-routine]").forEach((button) => {
    button.addEventListener("click", () => openRoutineDialog(state.routines.find((item) => item.id === button.dataset.editRoutine)));
  });
  document.querySelectorAll("[data-copy-routine]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = state.routines.find((item) => item.id === button.dataset.copyRoutine);
      if (!source) return;
      state.routines.push(newRecord({
        ...clone(source),
        id: makeId(),
        name: `${source.name} - copie`,
        steps: source.steps.map((step) => newRecord({ ...step, id: makeId() })),
        archived: false
      }));
      saveState();
    });
  });
  document.querySelectorAll("[data-archive-routine]").forEach((button) => {
    button.addEventListener("click", () => {
      const routine = state.routines.find((item) => item.id === button.dataset.archiveRoutine);
      if (!routine) return;
      routine.archived = !routine.archived;
      markUpdated(routine, ["archived"]);
      saveState();
    });
  });
  document.querySelectorAll("[data-delete-routine]").forEach((button) => {
    button.addEventListener("click", () => softDelete("routines", button.dataset.deleteRoutine, "Supprimer cette routine ?"));
  });
  document.querySelectorAll("[data-routine-up], [data-routine-down]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.routineUp || button.dataset.routineDown;
      const [routineId, indexText] = value.split(":");
      const routine = state.routines.find((item) => item.id === routineId);
      const index = Number(indexText);
      const target = button.dataset.routineUp ? index - 1 : index + 1;
      if (!routine || target < 0 || target >= routine.steps.length) return;
      [routine.steps[index], routine.steps[target]] = [routine.steps[target], routine.steps[index]];
      markUpdated(routine, ["steps"]);
      saveState();
    });
  });
}

function openRoutineDialog(routine = null) {
  const lines = routine
    ? routine.steps.map((step) => `${step.practiceTitle} | ${step.minutes} | ${step.optional ? "oui" : "non"}`).join("\n")
    : "Refuge et bodhicitta | 5 | non\nCalme mental | 15 | non\nDedication | 3 | non";
  const days = routine?.days || [1, 2, 3, 4, 5, 6, 0];
  openDialog(routine ? "Modifier la routine" : "Nouvelle routine", `
    <label>Nom <input id="routineName" value="${escapeAttr(routine?.name || "Ma routine")}" required></label>
    <label>Description <textarea id="routineDescription">${escapeHtml(routine?.description || "Une sequence adaptee a mon rythme.")}</textarea></label>
    <div class="form-grid">
      <label>Heure indicative <input id="routineTime" type="time" value="${escapeAttr(routine?.time || "07:30")}"></label>
      <label>Historique <select id="routineSaveMode">
        <option value="steps" ${routine?.saveEachStep !== false ? "selected" : ""}>Chaque etape et resume</option>
        <option value="summary" ${routine?.saveEachStep === false ? "selected" : ""}>Resume uniquement</option>
      </select></label>
      <fieldset class="day-picker">
        <legend>Jours</legend>
        ${[["L", 1], ["M", 2], ["M", 3], ["J", 4], ["V", 5], ["S", 6], ["D", 0]].map(([label, value]) => `
          <label><input type="checkbox" name="routineDay" value="${value}" ${days.includes(value) ? "checked" : ""}>${label}</label>
        `).join("")}
      </fieldset>
    </div>
    <label>Etapes, une par ligne au format Pratique | minutes | facultative (oui/non)
      <textarea id="routineSteps">${escapeHtml(lines)}</textarea>
    </label>
    <p class="muted">Les boutons haut et bas sur la fiche permettent ensuite de reorganiser rapidement les etapes.</p>
  `, () => {
    const previousSteps = routine?.steps || [];
    const usedStepIds = new Set();
    const steps = qs("#routineSteps").value.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
      const [practiceTitle, minutes, optional] = line.split("|").map((part) => part.trim());
      const values = {
        practiceTitle: practiceTitle || "Pratique libre",
        minutes: Math.max(1, Number(minutes || 5)),
        optional: /^(oui|yes|true|1)$/i.test(optional || "")
      };
      const existing = previousSteps[index]?.practiceTitle === values.practiceTitle
        ? previousSteps[index]
        : previousSteps.find((step) => step.practiceTitle === values.practiceTitle && !usedStepIds.has(step.id));
      if (!existing) return newRecord(values);
      usedStepIds.add(existing.id);
      const changed = existing.minutes !== values.minutes || existing.optional !== values.optional;
      const next = { ...existing, ...values };
      if (changed) markUpdated(next, ["minutes", "optional"]);
      return next;
    });
    const values = {
      name: qs("#routineName").value.trim() || "Ma routine",
      description: qs("#routineDescription").value.trim(),
      time: qs("#routineTime").value,
      days: [...document.querySelectorAll('input[name="routineDay"]:checked')].map((input) => Number(input.value)),
      steps,
      saveEachStep: qs("#routineSaveMode").value === "steps",
      archived: routine?.archived || false
    };
    if (routine) {
      recordNestedDeletions(state, "routines.steps", routine.steps, steps);
      Object.assign(routine, values);
      markUpdated(routine, Object.keys(values));
    } else {
      state.routines.push(newRecord(values));
    }
    saveState();
  });
}

function startRoutine(routine) {
  if (!routine.steps?.length) {
    showToast("Ajoutez au moins une etape avant de lancer cette routine.");
    return;
  }
  const steps = routine.steps.map((step) => ({
    ...step,
    title: step.practiceTitle,
    instruction: state.practices.find((practice) => practice.title === step.practiceTitle)?.notes || "Pratiquez avec attention, selon les instructions que vous avez recues.",
    durationSeconds: Number(step.minutes || 1) * 60
  }));
  startFocusSession({
    type: "routine",
    sourceId: routine.id,
    title: routine.name,
    steps,
    saveEachStep: routine.saveEachStep !== false
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
  document.querySelectorAll("[data-guide-practice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const practice = state.practices.find((item) => item.id === btn.dataset.guidePractice);
      if (practice) startGuidedRitual(practice);
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
      markUpdated(practice, ["archived"]);
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
      <button class="primary-btn" id="startGuidedRitual" type="button">Lancer le rituel guide</button>
    </article>
  `);
  qs("#startGuidedRitual").addEventListener("click", () => {
    qs("#practiceDialog").close();
    startGuidedRitual(practice);
  });
}

function startGuidedRitual(practice) {
  const rawSteps = practice.detailedSteps || [];
  if (!rawSteps.length) {
    showToast("Ajoutez des etapes detaillees avant de lancer le mode guide.");
    return;
  }
  const fallbackMinutes = Math.max(1, Number(practice.minutes || 1) / Math.max(1, rawSteps.length));
  const steps = rawSteps.map((step) => ({
    ...step,
    title: step.title,
    instruction: step.instruction,
    durationSeconds: parseDurationSeconds(step.duration) || Math.round(fallbackMinutes * 60)
  }));
  startFocusSession({
    type: "ritual",
    sourceId: practice.id,
    title: practice.title,
    warning: practice.caution,
    steps,
    saveEachStep: false
  });
}

function parseDurationSeconds(value) {
  const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*(min|s)?/i);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  return match[2]?.toLowerCase() === "s" ? amount : amount * 60;
}

async function startFocusSession(config) {
  clearInterval(focusInterval);
  focusSession = {
    ...config,
    index: 0,
    running: true,
    startedAt: Date.now(),
    elapsedBeforeStart: 0,
    completed: [],
    fontScale: 1,
    dim: false,
    instructionsVisible: true,
    textView: "instruction"
  };
  renderFocusMode();
  startFocusTicker();
  try {
    focusSession.wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    // Le verrouillage d'ecran reste facultatif selon le navigateur.
  }
}

function focusElapsedSeconds() {
  if (!focusSession) return 0;
  const running = focusSession.running && focusSession.startedAt
    ? (Date.now() - focusSession.startedAt) / 1000
    : 0;
  return Math.max(0, Number(focusSession.elapsedBeforeStart || 0) + running);
}

function startFocusTicker() {
  clearInterval(focusInterval);
  if (!focusSession?.running) return;
  focusInterval = setInterval(() => {
    const step = focusSession.steps[focusSession.index];
    if (focusElapsedSeconds() >= Number(step.durationSeconds || 0)) {
      moveFocusStep(1, true);
    } else {
      updateFocusClock();
    }
  }, 500);
}

function renderFocusMode() {
  if (!focusSession) return;
  const host = qs("#focusMode");
  const step = focusSession.steps[focusSession.index];
  const progress = Math.round(((focusSession.index + Math.min(1, focusElapsedSeconds() / Math.max(1, step.durationSeconds))) / focusSession.steps.length) * 100);
  const textViews = [
    ["instruction", "Instructions"],
    ["original", "Original"],
    ["transliteration", "Transliteration"],
    ["phonetic", "Phonetique"],
    ["translation", "Traduction"],
    ["commentary", "Commentaire"]
  ].filter(([key]) => step[key]);
  const activeTextView = textViews.some(([key]) => key === focusSession.textView) ? focusSession.textView : textViews[0]?.[0];
  const activeText = activeTextView ? step[activeTextView] : "";
  host.hidden = false;
  host.className = `focus-mode ${focusSession.dim ? "is-dim" : ""}`;
  host.style.setProperty("--focus-font-scale", focusSession.fontScale);
  host.innerHTML = `
    <div class="focus-toolbar">
      <button class="icon-btn focus-close" id="closeFocus" aria-label="Quitter">×</button>
      <div class="focus-title"><span>${escapeHtml(focusSession.title)}</span><strong>Etape ${focusSession.index + 1} / ${focusSession.steps.length}</strong></div>
      <div class="button-row">
        <button class="icon-btn" id="focusTextSmaller" aria-label="Reduire le texte">A−</button>
        <button class="icon-btn" id="focusTextLarger" aria-label="Agrandir le texte">A+</button>
        <button class="icon-btn" id="focusDim" aria-label="Faible luminosite">◐</button>
        <button class="icon-btn" id="focusInstructions" aria-label="Afficher ou masquer les instructions">☷</button>
        <button class="icon-btn" id="focusFullscreen" aria-label="Plein ecran">⛶</button>
      </div>
    </div>
    <div class="focus-progress"><span style="width:${progress}%"></span></div>
    <main class="focus-content">
      <span class="eyebrow">${focusSession.type === "routine" ? "Routine" : "Rituel guide"}</span>
      <h1>${escapeHtml(step.title)}</h1>
      ${focusSession.instructionsVisible && textViews.length > 1 ? `
        <div class="focus-text-tabs" role="tablist" aria-label="Versions du texte">
          ${textViews.map(([key, label]) => `<button class="${activeTextView === key ? "is-active" : ""}" data-focus-text="${key}" role="tab" aria-selected="${activeTextView === key}">${label}</button>`).join("")}
        </div>
      ` : ""}
      ${focusSession.instructionsVisible && activeText ? `<p class="focus-instruction">${escapeHtml(activeText)}</p>` : ""}
      ${step.optional ? `<span class="tag">Etape facultative</span>` : ""}
      ${focusSession.warning ? `<p class="focus-warning">${escapeHtml(focusSession.warning)}</p>` : ""}
      <div class="focus-clock" id="focusClock">${formatTime(Math.max(0, step.durationSeconds - focusElapsedSeconds()))}</div>
    </main>
    <div class="focus-controls">
      <button class="ghost-btn" id="focusPrevious" ${focusSession.index === 0 ? "disabled" : ""}>Precedent</button>
      <button class="primary-btn" id="focusPause">${focusSession.running ? "Pause" : "Reprendre"}</button>
      ${step.optional ? `<button class="ghost-btn" id="focusSkip">Sauter</button>` : ""}
      <button class="ghost-btn" id="focusNext">${focusSession.index === focusSession.steps.length - 1 ? "Terminer" : "Suivant"}</button>
    </div>
  `;
  qs("#closeFocus").addEventListener("click", () => finishFocusSession(false));
  qs("#focusPrevious").addEventListener("click", () => moveFocusStep(-1));
  qs("#focusNext").addEventListener("click", () => moveFocusStep(1));
  qs("#focusPause").addEventListener("click", toggleFocusPause);
  qs("#focusSkip")?.addEventListener("click", () => moveFocusStep(1));
  qs("#focusFullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else host.requestFullscreen?.();
  });
  document.querySelectorAll("[data-focus-text]").forEach((button) => button.addEventListener("click", () => {
    focusSession.textView = button.dataset.focusText;
    renderFocusMode();
  }));
  qs("#focusTextSmaller").addEventListener("click", () => {
    focusSession.fontScale = Math.max(0.85, focusSession.fontScale - 0.1);
    renderFocusMode();
  });
  qs("#focusTextLarger").addEventListener("click", () => {
    focusSession.fontScale = Math.min(1.5, focusSession.fontScale + 0.1);
    renderFocusMode();
  });
  qs("#focusDim").addEventListener("click", () => {
    focusSession.dim = !focusSession.dim;
    renderFocusMode();
  });
  qs("#focusInstructions").addEventListener("click", () => {
    focusSession.instructionsVisible = !focusSession.instructionsVisible;
    renderFocusMode();
  });
}

function updateFocusClock() {
  const clock = qs("#focusClock");
  if (!clock || !focusSession) return;
  const step = focusSession.steps[focusSession.index];
  clock.textContent = formatTime(Math.max(0, step.durationSeconds - focusElapsedSeconds()));
}

function toggleFocusPause() {
  if (!focusSession) return;
  if (focusSession.running) {
    focusSession.elapsedBeforeStart = focusElapsedSeconds();
    focusSession.startedAt = null;
    focusSession.running = false;
    clearInterval(focusInterval);
  } else {
    focusSession.startedAt = Date.now();
    focusSession.running = true;
    startFocusTicker();
  }
  renderFocusMode();
}

function moveFocusStep(direction, automatic = false) {
  if (!focusSession) return;
  const elapsed = Math.min(focusElapsedSeconds(), focusSession.steps[focusSession.index].durationSeconds);
  focusSession.completed[focusSession.index] = Math.max(focusSession.completed[focusSession.index] || 0, elapsed);
  const next = focusSession.index + direction;
  if (next >= focusSession.steps.length) {
    finishFocusSession(true);
    return;
  }
  if (next < 0) return;
  focusSession.index = next;
  focusSession.elapsedBeforeStart = 0;
  focusSession.startedAt = focusSession.running ? Date.now() : null;
  if (automatic) ringBell();
  renderFocusMode();
}

function finishFocusSession(save) {
  clearInterval(focusInterval);
  if (!focusSession) return;
  const session = focusSession;
  session.wakeLock?.release?.();
  if (save) {
    const currentElapsed = Math.min(focusElapsedSeconds(), session.steps[session.index]?.durationSeconds || 0);
    session.completed[session.index] = Math.max(session.completed[session.index] || 0, currentElapsed);
    const totalSeconds = session.completed.reduce((sum, seconds) => sum + Number(seconds || 0), 0);
    if (session.saveEachStep) {
      session.steps.forEach((step, index) => {
        const durationSeconds = Math.round(session.completed[index] || 0);
        if (!durationSeconds) return;
        state.sessions.push(newRecord({
          date: todayKey(),
          label: step.title,
          durationSeconds,
          minutes: durationSeconds / 60,
          mood: "routine",
          routineId: session.sourceId
        }));
      });
    }
    state.sessions.push(newRecord({
      date: todayKey(),
      label: session.title,
      durationSeconds: Math.round(totalSeconds),
      minutes: totalSeconds / 60,
      mood: session.type,
      routineId: session.type === "routine" ? session.sourceId : null,
      practiceId: session.type === "ritual" ? session.sourceId : null,
      summaryOnly: session.saveEachStep
    }));
    saveState();
    ringBell();
  }
  focusSession = null;
  qs("#focusMode").hidden = true;
  showToast(save ? "Pratique enregistree." : "Mode guide ferme.");
}

function renderAccumulations() {
  const active = state.accumulations.filter((item) => !item.archived);
  const archived = state.accumulations.filter((item) => item.archived);
  qs("#accumulations").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Engagements personnels</span>
          <h2>Accumulations</h2>
          <p class="muted">Chaque ajout contribue a la continuite de votre pratique. Vous pouvez reprendre lorsque vous le souhaitez.</p>
        </div>
        <button class="primary-btn" id="addAccumulation">Nouvelle accumulation</button>
      </div>
      <div class="accumulation-grid">${active.map(accumulationCard).join("") || empty("Aucune accumulation active.")}</div>
      ${archived.length ? `
        <details class="archived-section">
          <summary>Accumulations archivees (${archived.length})</summary>
          <div class="accumulation-grid">${archived.map(accumulationCard).join("")}</div>
        </details>
      ` : ""}
    </section>
  `;
  qs("#addAccumulation").addEventListener("click", () => openAccumulationDialog());
  bindAccumulationActions();
}

function accumulationCard(item) {
  const current = accumulationTotal(item);
  const target = Math.max(0, Number(item.target || 0));
  const remaining = Math.max(0, target - current);
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const recent = sessionsByDay((item.entries || []).map((entry) => ({
    date: entry.date,
    durationSeconds: Number(entry.count || 0)
  })), 7);
  const weekTotal = recent.reduce((sum, day) => sum + day.seconds, 0);
  const monthTotal = accumulationPeriodTotal(item, 30);
  const pace = accumulationPace(item);
  const paceText = pace.dailyAverage > 0
    ? `${Math.round(pace.dailyAverage).toLocaleString("fr-FR")} par jour en moyenne${pace.estimatedDaysRemaining ? ` · environ ${pace.estimatedDaysRemaining} jours au rythme actuel` : ""}`
    : "Le rythme apparaitra apres quelques ajouts.";
  return `
    <article class="accumulation-card">
      <div class="row-head">
        <div><span class="tag">${escapeHtml(item.category || "Personnel")}</span><h3>${escapeHtml(item.name)}</h3></div>
        <strong class="accumulation-total">${current.toLocaleString("fr-FR")}</strong>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${target || current || 1}" aria-valuenow="${current}">
        <span style="width:${percent}%"></span>
      </div>
      <div class="accumulation-stats">
        <span><strong>${remaining.toLocaleString("fr-FR")}</strong> restantes</span>
        <span><strong>${percent}%</strong> de l'objectif</span>
        <span><strong>${weekTotal.toLocaleString("fr-FR")}</strong> cette semaine</span>
        <span><strong>${monthTotal.toLocaleString("fr-FR")}</strong> sur 30 jours</span>
      </div>
      <p class="muted accumulation-pace">${escapeHtml(paceText)}</p>
      ${item.dailyGoal ? `<p class="muted">Repere quotidien facultatif : ${item.dailyGoal.toLocaleString("fr-FR")}</p>` : ""}
      <div class="quick-adds">
        ${[1, 7, 21, 27, 54, 108].map((count) => `<button class="chip" data-add-accumulation="${item.id}:${count}">+${count}</button>`).join("")}
        <button class="ghost-btn" data-custom-accumulation="${item.id}">Autre</button>
      </div>
      <div class="button-row">
        <button class="ghost-btn" data-history-accumulation="${item.id}">Historique</button>
        <button class="ghost-btn" data-edit-accumulation="${item.id}">Modifier</button>
        <button class="icon-btn" data-archive-accumulation="${item.id}" aria-label="${item.archived ? "Restaurer" : "Archiver"}">${item.archived ? "↥" : "⌄"}</button>
        <button class="icon-btn danger-btn" data-delete-accumulation="${item.id}" aria-label="Supprimer">×</button>
      </div>
    </article>
  `;
}

function bindAccumulationActions() {
  document.querySelectorAll("[data-add-accumulation]").forEach((button) => {
    button.addEventListener("click", () => {
      const [id, count] = button.dataset.addAccumulation.split(":");
      addAccumulationEntry(id, Number(count));
    });
  });
  document.querySelectorAll("[data-custom-accumulation]").forEach((button) => {
    button.addEventListener("click", () => openAccumulationEntryDialog(button.dataset.customAccumulation));
  });
  document.querySelectorAll("[data-history-accumulation]").forEach((button) => {
    button.addEventListener("click", () => openAccumulationHistory(state.accumulations.find((item) => item.id === button.dataset.historyAccumulation)));
  });
  document.querySelectorAll("[data-edit-accumulation]").forEach((button) => {
    button.addEventListener("click", () => openAccumulationDialog(state.accumulations.find((item) => item.id === button.dataset.editAccumulation)));
  });
  document.querySelectorAll("[data-archive-accumulation]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.accumulations.find((entry) => entry.id === button.dataset.archiveAccumulation);
      if (!item) return;
      item.archived = !item.archived;
      markUpdated(item, ["archived"]);
      saveState();
    });
  });
  document.querySelectorAll("[data-delete-accumulation]").forEach((button) => {
    button.addEventListener("click", () => softDelete("accumulations", button.dataset.deleteAccumulation, "Supprimer cette accumulation et son historique ?"));
  });
}

function addAccumulationEntry(id, count, date = todayKey(), note = "") {
  const item = state.accumulations.find((entry) => entry.id === id);
  if (!item || !Number.isFinite(count) || count === 0) return;
  item.entries.push(newRecord({ date, count, note }));
  markUpdated(item, ["entries"]);
  saveState();
  showToast("Progression enregistree.");
}

function openAccumulationEntryDialog(id) {
  openDialog("Ajouter une valeur", `
    <div class="form-grid">
      <label>Nombre <input id="accumulationCount" type="number" value="108"></label>
      <label>Date <input id="accumulationDate" type="date" value="${todayKey()}"></label>
    </div>
    <label>Note facultative <textarea id="accumulationEntryNote"></textarea></label>
    <p class="muted">Une valeur negative permet de corriger une erreur de comptage.</p>
  `, () => addAccumulationEntry(
    id,
    Number(qs("#accumulationCount").value),
    qs("#accumulationDate").value,
    qs("#accumulationEntryNote").value.trim()
  ));
}

function openAccumulationDialog(item = null) {
  openDialog(item ? "Modifier l'accumulation" : "Nouvelle accumulation", `
    <label>Nom <input id="accumulationName" value="${escapeAttr(item?.name || "Mantra de Tchenrezig")}" required></label>
    <div class="form-grid">
      <label>Categorie <select id="accumulationCategory">
        ${["Prosternations", "Refuge", "Vajrasattva", "Mandala", "Guru Yoga", "Mantra", "Personnel"].map((category) => `<option ${item?.category === category ? "selected" : ""}>${category}</option>`).join("")}
      </select></label>
      <label>Objectif total <input id="accumulationTarget" type="number" min="0" value="${item?.target || 100000}"></label>
      <label>Repere quotidien facultatif <input id="accumulationDaily" type="number" min="0" value="${item?.dailyGoal || 108}"></label>
      <label>Repetitions par cycle <input id="accumulationCycle" type="number" min="1" value="${item?.cycleSize || 108}"></label>
      <label>Date de debut <input id="accumulationStart" type="date" value="${item?.startDate || todayKey()}"></label>
      <label>Date cible facultative <input id="accumulationTargetDate" type="date" value="${item?.targetDate || ""}"></label>
    </div>
    <label>Notes <textarea id="accumulationNotes">${escapeHtml(item?.notes || "")}</textarea></label>
  `, () => {
    const values = {
      name: qs("#accumulationName").value.trim() || "Accumulation",
      category: qs("#accumulationCategory").value,
      target: Math.max(0, Number(qs("#accumulationTarget").value)),
      dailyGoal: Math.max(0, Number(qs("#accumulationDaily").value)),
      cycleSize: Math.max(1, Number(qs("#accumulationCycle").value)),
      startDate: qs("#accumulationStart").value,
      targetDate: qs("#accumulationTargetDate").value,
      notes: qs("#accumulationNotes").value.trim()
    };
    if (item) {
      Object.assign(item, values);
      markUpdated(item, Object.keys(values));
    } else {
      state.accumulations.push(newRecord({ ...values, archived: false, entries: [] }));
    }
    saveState();
  });
}

function openAccumulationHistory(item) {
  if (!item) return;
  const monthly = new Map();
  (item.entries || []).forEach((entry) => {
    const month = String(entry.date || "").slice(0, 7);
    monthly.set(month, (monthly.get(month) || 0) + Number(entry.count || 0));
  });
  openInfoDialog(`Historique · ${item.name}`, `
    <div class="compact-list accumulation-months">
      ${[...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, count]) => `<div><span>${escapeHtml(month)}</span><strong>${count.toLocaleString("fr-FR")}</strong></div>`).join("") || empty("Aucun mois enregistre.")}
    </div>
    <div class="day-detail-list">
      ${(item.entries || []).slice().reverse().map((entry) => `
        <article class="day-detail-item">
          <div><strong>${Number(entry.count).toLocaleString("fr-FR")}</strong><p>${entry.date}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</p></div>
        </article>
      `).join("") || empty("Aucune entree.")}
    </div>
  `);
}

function renderJournal() {
  const query = journalFilters.query.toLowerCase();
  const filtered = state.journals
    .filter((entry) => journalFilters.type === "all" || entry.type === journalFilters.type)
    .filter((entry) => journalFilters.practice === "all" || entry.practiceId === journalFilters.practice)
    .filter((entry) => journalFilters.tag === "all" || (entry.tags || []).includes(journalFilters.tag))
    .filter((entry) => !journalFilters.dateFrom || entry.date >= journalFilters.dateFrom)
    .filter((entry) => !journalFilters.dateTo || entry.date <= journalFilters.dateTo)
    .filter((entry) => !journalFilters.favorite || entry.favorite)
    .filter((entry) => !query || [
      entry.title,
      entry.body,
      entry.emotion,
      entry.obstacle,
      entry.support,
      entry.intention,
      ...(entry.tags || [])
    ].join(" ").toLowerCase().includes(query))
    .sort((a, b) => journalFilters.sort === "oldest"
      ? String(a.date).localeCompare(String(b.date))
      : String(b.date).localeCompare(String(a.date)));
  qs("#journal").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div><span class="eyebrow">Integration</span><h2>Journal de pratique</h2></div>
        <div class="button-row">
          <button class="ghost-btn" id="weeklyReview">Revue hebdomadaire</button>
          <button class="primary-btn" id="addJournal">Nouvelle note</button>
        </div>
      </div>
      <div class="filter-bar">
        <label>Rechercher <input id="journalSearch" type="search" value="${escapeAttr(journalFilters.query)}" placeholder="Titre, contenu ou tag"></label>
        <label>Type <select id="journalTypeFilter">
          <option value="all">Tous</option>
          <option value="quick" ${journalFilters.type === "quick" ? "selected" : ""}>Note rapide</option>
          <option value="free" ${journalFilters.type === "free" ? "selected" : ""}>Journal libre</option>
          <option value="weekly" ${journalFilters.type === "weekly" ? "selected" : ""}>Revue hebdomadaire</option>
        </select></label>
        <label>Pratique <select id="journalPracticeFilter">
          <option value="all">Toutes</option>
          ${state.practices.map((practice) => `<option value="${practice.id}" ${journalFilters.practice === practice.id ? "selected" : ""}>${escapeHtml(practice.title)}</option>`).join("")}
        </select></label>
        <label>Tag <select id="journalTagFilter">
          <option value="all">Tous</option>
          ${state.journalTags.map((tag) => `<option value="${escapeAttr(tag.label)}" ${journalFilters.tag === tag.label ? "selected" : ""}>${escapeHtml(tag.label)}</option>`).join("")}
        </select></label>
        <label>Du <input id="journalDateFrom" type="date" value="${journalFilters.dateFrom}"></label>
        <label>Au <input id="journalDateTo" type="date" value="${journalFilters.dateTo}"></label>
        <label>Tri <select id="journalSort">
          <option value="newest">Plus recentes</option>
          <option value="oldest" ${journalFilters.sort === "oldest" ? "selected" : ""}>Plus anciennes</option>
        </select></label>
        <label class="confirm-line journal-favorite-filter"><input id="journalFavoriteFilter" type="checkbox" ${journalFilters.favorite ? "checked" : ""}> Favoris uniquement</label>
      </div>
      <div class="journal-list">${filtered.map(journalCard).join("") || empty("Aucune note ne correspond a ces filtres.")}</div>
    </section>
  `;
  qs("#addJournal").addEventListener("click", () => openJournalDialog());
  qs("#weeklyReview").addEventListener("click", openWeeklyReviewDialog);
  qs("#journalSearch").addEventListener("input", (event) => {
    journalFilters.query = event.target.value;
    renderJournal();
    qs("#journalSearch")?.focus();
  });
  qs("#journalTypeFilter").addEventListener("change", (event) => {
    journalFilters.type = event.target.value;
    renderJournal();
  });
  qs("#journalPracticeFilter").addEventListener("change", (event) => {
    journalFilters.practice = event.target.value;
    renderJournal();
  });
  qs("#journalTagFilter").addEventListener("change", (event) => {
    journalFilters.tag = event.target.value;
    renderJournal();
  });
  qs("#journalDateFrom").addEventListener("change", (event) => {
    journalFilters.dateFrom = event.target.value;
    renderJournal();
  });
  qs("#journalDateTo").addEventListener("change", (event) => {
    journalFilters.dateTo = event.target.value;
    renderJournal();
  });
  qs("#journalFavoriteFilter").addEventListener("change", (event) => {
    journalFilters.favorite = event.target.checked;
    renderJournal();
  });
  qs("#journalSort").addEventListener("change", (event) => {
    journalFilters.sort = event.target.value;
    renderJournal();
  });
  bindJournalActions();
}

function journalCard(entry) {
  const practice = state.practices.find((item) => item.id === entry.practiceId);
  const session = state.sessions.find((item) => item.id === entry.sessionId);
  const indicators = [
    entry.presence && entry.presence !== "non precisee" ? `Presence : ${entry.presence}` : "",
    entry.agitation && entry.agitation !== "non precisee" ? `Agitation : ${entry.agitation}` : "",
    entry.torpor && entry.torpor !== "non precisee" ? `Torpeur : ${entry.torpor}` : "",
    entry.clarity && entry.clarity !== "non precisee" ? `Clarte : ${entry.clarity}` : "",
    entry.emotion ? `Emotion : ${entry.emotion}` : ""
  ].filter(Boolean);
  return `
    <article class="journal-entry panel">
      <div class="row-head">
        <div><span class="eyebrow">${entry.type === "weekly" ? "Revue hebdomadaire" : entry.type === "free" ? "Journal libre" : "Note rapide"}</span><h3>${escapeHtml(entry.title)}</h3></div>
        <button class="icon-btn" data-favorite-journal="${entry.id}" aria-label="${entry.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}">${entry.favorite ? "★" : "☆"}</button>
      </div>
      <div class="tag-row">
        <span class="tag">${formatDisplayDate(entry.date)}</span>
        ${practice ? `<span class="tag">${escapeHtml(practice.title)}</span>` : ""}
        ${session ? `<span class="tag">${formatDuration(sessionDurationSeconds(session))}</span>` : ""}
      </div>
      <p>${escapeHtml(entry.body)}</p>
      ${entry.image?.dataUrl ? `<img class="journal-image" src="${escapeAttr(entry.image.dataUrl)}" alt="${escapeAttr(entry.image.alt || "Image jointe au journal")}">` : ""}
      <div class="tag-row">
        ${indicators.map((label) => `<span class="tag">${escapeHtml(label)}</span>`).join("")}
        ${Number(entry.minutes || 0) ? `<span class="tag">${entry.minutes} min</span>` : ""}
        ${(entry.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${entry.obstacle || entry.support || entry.intention ? `
        <dl class="journal-observations">
          ${entry.obstacle ? `<div><dt>Obstacle</dt><dd>${escapeHtml(entry.obstacle)}</dd></div>` : ""}
          ${entry.support ? `<div><dt>Soutien</dt><dd>${escapeHtml(entry.support)}</dd></div>` : ""}
          ${entry.intention ? `<div><dt>Intention</dt><dd>${escapeHtml(entry.intention)}</dd></div>` : ""}
        </dl>
      ` : ""}
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
  const mondayFirst = state.settings.firstDayOfWeek !== "sunday";
  const days = buildCalendarDays(year, month, mondayFirst);
  const weekdayLabels = mondayFirst
    ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    : ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  qs("#calendar").innerHTML = `
    <section class="panel">
      <span class="eyebrow">Calendrier</span>
      <div class="calendar-toolbar">
        <div class="button-row">
          <button class="icon-btn" id="previousMonth" aria-label="Mois precedent">‹</button>
          <button class="ghost-btn" id="currentMonth">Aujourd'hui</button>
          <button class="icon-btn" id="nextMonth" aria-label="Mois suivant">›</button>
        </div>
        <h2>${calendarCursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: state.settings.timezone || undefined })}</h2>
      </div>
      <div class="calendar-grid">
        ${weekdayLabels.map((d) => `<strong class="muted">${d}</strong>`).join("")}
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
  const sessions = countedSessions(state.sessions.filter((session) => session.date === date));
  const journals = state.journals.filter((entry) => entry.date === date);
  const mantras = state.mantra.history.filter((entry) => entry.date === date);
  const dateLabel = formatDisplayDate(date, {
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

function renderRetreats() {
  const active = state.retreats.filter((item) => !item.archived);
  qs("#retreats").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div><span class="eyebrow">Mode retraite</span><h2>Retraites personnelles</h2><p class="muted">Un espace simplifie, sans pression liee aux series.</p></div>
        <button class="primary-btn" id="addRetreat">Nouvelle retraite</button>
      </div>
      <div class="retreat-grid">${active.map(retreatCard).join("") || empty("Aucune retraite configuree.")}</div>
    </section>
  `;
  qs("#addRetreat").addEventListener("click", () => openRetreatDialog());
  bindRetreatActions();
}

function retreatCard(retreat) {
  const today = retreat.days.find((day) => day.date === todayKey()) || { completed: [], note: "" };
  const completed = today.completed?.length || 0;
  return `
    <article class="retreat-card">
      <div class="row-head"><div><span class="tag">${escapeHtml(retreat.type || "Retraite personnelle")}</span><h3>${escapeHtml(retreat.name)}</h3></div><span class="tag">${retreat.startDate} → ${retreat.endDate}</span></div>
      <p>${escapeHtml(retreat.intention || "")}</p>
      <p class="muted">${escapeHtml(retreat.location || "Lieu non precise")}${retreat.teacher ? ` · ${escapeHtml(retreat.teacher)}` : ""}</p>
      <div class="progress-bar"><span style="width:${Math.min(100, Math.round((completed / Math.max(1, retreat.schedule.length)) * 100))}%"></span></div>
      <p>${completed} étape${completed > 1 ? "s" : ""} accomplie${completed > 1 ? "s" : ""} aujourd'hui sur ${retreat.schedule.length}</p>
      <div class="button-row">
        <button class="primary-btn" data-open-retreat="${retreat.id}">Ouvrir le mode retraite</button>
        <button class="ghost-btn" data-edit-retreat="${retreat.id}">Modifier</button>
        <button class="ghost-btn" data-export-retreat="${retreat.id}">Exporter</button>
        <button class="icon-btn danger-btn" data-delete-retreat="${retreat.id}" aria-label="Supprimer">×</button>
      </div>
    </article>
  `;
}

function bindRetreatActions() {
  document.querySelectorAll("[data-open-retreat]").forEach((button) => button.addEventListener("click", () => openRetreatMode(state.retreats.find((item) => item.id === button.dataset.openRetreat))));
  document.querySelectorAll("[data-edit-retreat]").forEach((button) => button.addEventListener("click", () => openRetreatDialog(state.retreats.find((item) => item.id === button.dataset.editRetreat))));
  document.querySelectorAll("[data-export-retreat]").forEach((button) => button.addEventListener("click", () => exportRetreat(state.retreats.find((item) => item.id === button.dataset.exportRetreat))));
  document.querySelectorAll("[data-delete-retreat]").forEach((button) => button.addEventListener("click", () => softDelete("retreats", button.dataset.deleteRetreat, "Supprimer cette retraite et ses notes ?")));
}

function openRetreatDialog(retreat = null) {
  const schedule = retreat?.schedule?.join("\n") || "Session du matin\nEtude\nKarma yoga\nSession de l'apres-midi\nDedication";
  openDialog(retreat ? "Modifier la retraite" : "Nouvelle retraite", `
    <label>Nom <input id="retreatName" value="${escapeAttr(retreat?.name || "Retraite personnelle")}" required></label>
    <div class="form-grid">
      <label>Lieu <input id="retreatLocation" value="${escapeAttr(retreat?.location || "")}"></label>
      <label>Type <input id="retreatType" value="${escapeAttr(retreat?.type || "Retraite personnelle")}"></label>
      <label>Debut <input id="retreatStart" type="date" value="${retreat?.startDate || todayKey()}"></label>
      <label>Fin <input id="retreatEnd" type="date" value="${retreat?.endDate || todayKey()}"></label>
      <label>Enseignant ou centre <input id="retreatTeacher" value="${escapeAttr(retreat?.teacher || "")}"></label>
      <label>Objectif de recitation <input id="retreatRecitation" type="number" min="0" value="${retreat?.recitationGoal || 0}"></label>
    </div>
    <label>Intention <textarea id="retreatIntention">${escapeHtml(retreat?.intention || "")}</textarea></label>
    <label>Programme quotidien, une etape par ligne <textarea id="retreatSchedule">${escapeHtml(schedule)}</textarea></label>
    <label>Periodes de silence <input id="retreatSilence" value="${escapeAttr(retreat?.silence || "")}" placeholder="Ex. 21h00 - 09h00"></label>
  `, () => {
    const values = {
      name: qs("#retreatName").value.trim(),
      location: qs("#retreatLocation").value.trim(),
      type: qs("#retreatType").value.trim(),
      startDate: qs("#retreatStart").value,
      endDate: qs("#retreatEnd").value,
      teacher: qs("#retreatTeacher").value.trim(),
      recitationGoal: Number(qs("#retreatRecitation").value || 0),
      intention: qs("#retreatIntention").value.trim(),
      schedule: qs("#retreatSchedule").value.split("\n").map((line) => line.trim()).filter(Boolean),
      silence: qs("#retreatSilence").value.trim()
    };
    if (retreat) {
      Object.assign(retreat, values);
      markUpdated(retreat, Object.keys(values));
    } else {
      state.retreats.push(newRecord({ ...values, archived: false, days: [] }));
    }
    saveState();
  });
}

function openRetreatMode(retreat) {
  if (!retreat) return;
  let day = retreat.days.find((item) => item.date === todayKey());
  if (!day) {
    day = newRecord({ date: todayKey(), completed: [], note: "", sleep: "", energy: "", generalState: "" });
    retreat.days.push(day);
  }
  openInfoDialog(retreat.name, `
    <article class="retreat-mode">
      <span class="eyebrow">${todayKey()}</span>
      <h3>${escapeHtml(retreat.intention || "Pratiquer avec simplicite et regularite.")}</h3>
      ${retreat.silence ? `<p class="detail-callout">Silence : ${escapeHtml(retreat.silence)}</p>` : ""}
      <div class="retreat-checklist">
        ${retreat.schedule.map((step, index) => `<label><input type="checkbox" data-retreat-step="${index}" ${day.completed.includes(index) ? "checked" : ""}><span>${escapeHtml(step)}</span></label>`).join("")}
      </div>
      <div class="form-grid">
        <label>Sommeil <input id="retreatSleep" value="${escapeAttr(day.sleep || "")}"></label>
        <label>Energie <input id="retreatEnergy" value="${escapeAttr(day.energy || "")}"></label>
        <label>Etat general <input id="retreatState" value="${escapeAttr(day.generalState || "")}"></label>
      </div>
      <label>Notes du jour <textarea id="retreatNote">${escapeHtml(day.note || "")}</textarea></label>
      <button class="primary-btn" id="saveRetreatDay">Enregistrer la journee</button>
    </article>
  `);
  qs("#saveRetreatDay").addEventListener("click", () => {
    day.completed = [...document.querySelectorAll("[data-retreat-step]:checked")].map((input) => Number(input.dataset.retreatStep));
    day.sleep = qs("#retreatSleep").value.trim();
    day.energy = qs("#retreatEnergy").value.trim();
    day.generalState = qs("#retreatState").value.trim();
    day.note = qs("#retreatNote").value.trim();
    markUpdated(day, ["completed", "sleep", "energy", "generalState", "note"]);
    markUpdated(retreat, ["days"]);
    qs("#practiceDialog").close();
    saveState();
    showToast("Journee de retraite enregistree.");
  });
}

function exportRetreat(retreat) {
  if (!retreat) return;
  const content = [`# ${retreat.name}`, "", `Du ${retreat.startDate} au ${retreat.endDate}`, `Intention : ${retreat.intention || ""}`, ""];
  retreat.days.forEach((day) => {
    content.push(`## ${day.date}`, `Etapes accomplies : ${(day.completed || []).length}/${retreat.schedule.length}`, `Sommeil : ${day.sleep || ""}`, `Energie : ${day.energy || ""}`, `Etat general : ${day.generalState || ""}`, day.note || "", "");
  });
  downloadFile(`retraite-${retreat.name.toLowerCase().replaceAll(" ", "-")}.md`, content.join("\n"), "text/markdown;charset=utf-8");
}

function renderLibrary() {
  qs("#library").innerHTML = `
    <section class="panel">
      <div class="section-head"><div><span class="eyebrow">Bibliotheque</span><h2>Espace personnel</h2></div><button class="primary-btn" id="addLibraryItem">Ajouter</button></div>
      <p class="muted">Les contenus personnels sont prives par defaut et ne sont jamais publies automatiquement.</p>
      <div class="library-grid">
        ${state.libraryItems.map(personalLibraryCard).join("") || empty("Aucun document personnel.")}
      </div>
    </section>
    <section class="panel">
      <span class="eyebrow">Guides publics</span>
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
  qs("#addLibraryItem").addEventListener("click", () => openLibraryItemDialog());
  document.querySelectorAll("[data-edit-library]").forEach((button) => button.addEventListener("click", () => openLibraryItemDialog(state.libraryItems.find((item) => item.id === button.dataset.editLibrary))));
  document.querySelectorAll("[data-delete-library]").forEach((button) => button.addEventListener("click", () => softDelete("libraryItems", button.dataset.deleteLibrary, "Supprimer cet element personnel ?")));
  document.querySelectorAll("[data-favorite-library]").forEach((button) => button.addEventListener("click", () => {
    const item = state.libraryItems.find((entry) => entry.id === button.dataset.favoriteLibrary);
    if (!item) return;
    item.favorite = !item.favorite;
    markUpdated(item, ["favorite"]);
    saveState();
  }));
  document.querySelectorAll("[data-guide-id]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const guide = libraryItems.find((item) => item.id === link.dataset.guideId);
      if (guide) openGuideDetail(guide);
    });
  });
}

function personalLibraryCard(item) {
  return `
    <article class="library-card">
      <div class="row-head"><span class="tag">${escapeHtml(item.folder || "Personnel")}</span><button class="icon-btn" data-favorite-library="${item.id}" aria-label="Favori">${item.favorite ? "★" : "☆"}</button></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || "")}</p>
      <div class="tag-row"><span class="tag">${escapeHtml(item.type || "Note")}</span><span class="tag">${escapeHtml(item.status || "prive personnel")}</span>${item.lineage ? `<span class="tag">${escapeHtml(item.lineage)}</span>` : ""}</div>
      ${safeExternalUrl(item.source) ? `<a class="library-link" href="${escapeAttr(safeExternalUrl(item.source))}" target="_blank" rel="noopener">Ouvrir la source</a>` : ""}
      <div class="button-row"><button class="ghost-btn" data-edit-library="${item.id}">Modifier</button><button class="ghost-btn danger-btn" data-delete-library="${item.id}">Supprimer</button></div>
    </article>
  `;
}

function openLibraryItemDialog(item = null) {
  openDialog(item ? "Modifier l'element" : "Ajouter a la bibliotheque", `
    <label>Titre <input id="libraryTitle" value="${escapeAttr(item?.title || "")}" required></label>
    <div class="form-grid">
      <label>Type <select id="libraryType">${["Note", "Texte", "Priere", "Lien", "PDF", "Audio", "Image", "Document"].map((type) => `<option ${item?.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>Dossier <select id="libraryFolder">${["Pratiques quotidiennes", "Enseignements publics", "Textes recus", "Etude", "Retraite", "Prieres", "Personnel"].map((folder) => `<option ${item?.folder === folder ? "selected" : ""}>${folder}</option>`).join("")}</select></label>
      <label>Auteur ou maitre <input id="libraryAuthor" value="${escapeAttr(item?.author || "")}"></label>
      <label>Lignee <input id="libraryLineage" value="${escapeAttr(item?.lineage || "")}"></label>
      <label>Langue <input id="libraryLanguage" value="${escapeAttr(item?.language || "francais")}"></label>
      <label>Statut <select id="libraryStatus">${["public", "enseignement general", "instruction recommandee", "transmission recue", "initiation requise", "contenu prive personnel"].map((status) => `<option ${item?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      <label>Source ou lien <input id="librarySource" type="url" value="${escapeAttr(item?.source || "")}"></label>
      <label>Tags <input id="libraryTags" value="${escapeAttr((item?.tags || []).join(", "))}"></label>
      <label>Fichier local <input id="libraryFile" type="file" accept=".pdf,.txt,.md,.doc,.docx,image/*,audio/*"></label>
    </div>
    <label>Description ou note <textarea id="libraryDescription">${escapeHtml(item?.description || "")}</textarea></label>
    <label class="confirm-line"><input id="libraryAuthorized" type="checkbox" ${item ? "checked" : ""}> Je confirme etre autorise a conserver ce contenu dans mon espace personnel.</label>
  `, () => {
    const status = qs("#libraryStatus").value;
    if (["transmission recue", "initiation requise"].includes(status) && !qs("#libraryAuthorized").checked) {
      showToast("Confirmation requise pour ce contenu restreint.");
      return;
    }
    const values = {
      title: qs("#libraryTitle").value.trim(),
      type: qs("#libraryType").value,
      folder: qs("#libraryFolder").value,
      author: qs("#libraryAuthor").value.trim(),
      lineage: qs("#libraryLineage").value.trim(),
      language: qs("#libraryLanguage").value.trim(),
      status,
      source: qs("#librarySource").value.trim(),
      localFileName: qs("#libraryFile").files?.[0]?.name || item?.localFileName || "",
      localFileType: qs("#libraryFile").files?.[0]?.type || item?.localFileType || "",
      localOnly: Boolean(qs("#libraryFile").files?.[0] || item?.localOnly),
      tags: qs("#libraryTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      description: qs("#libraryDescription").value.trim(),
      private: true,
      favorite: item?.favorite || false
    };
    if (item) {
      Object.assign(item, values);
      markUpdated(item, Object.keys(values));
    } else {
      state.libraryItems.push(newRecord(values));
    }
    saveState();
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

function renderAudio() {
  qs("#audio").innerHTML = `
    <section class="panel audio-workspace">
      <div class="section-head"><div><span class="eyebrow">Lecteur audio</span><h2>Ecoute et apprentissage</h2></div><button class="primary-btn" id="chooseAudio">Ajouter un fichier local</button></div>
      <input id="audioFile" type="file" accept="audio/*" hidden>
      <audio id="audioPlayer" controls ${activeAudioUrl ? `src="${activeAudioUrl}"` : ""}></audio>
      <div class="form-grid">
        <label>Volume <input id="audioVolume" type="range" min="0" max="1" step="0.05" value="0.8"></label>
        <label>Vitesse <select id="audioSpeed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label>
        <label class="confirm-line"><input id="audioLoop" type="checkbox"> Repetition</label>
        <label>Pause entre passages <input id="audioPause" type="number" min="0" max="30" value="2"> secondes</label>
      </div>
      <div class="button-row">
        <button class="ghost-btn" id="startBell">Cloche de debut</button>
        <button class="ghost-btn" id="middleBell">Cloche intermediaire</button>
        <button class="ghost-btn" id="endBell">Cloche de fin</button>
      </div>
      <p class="muted">Les fichiers audio personnels restent sur cet appareil. Seuls leur titre et leurs reglages peuvent etre synchronises.</p>
    </section>
    <section class="panel">
      <span class="eyebrow">Fichiers recents</span>
      <div class="compact-list">${state.audioItems.map((item) => `<div><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.practice || "Personnel")}</strong></div>`).join("") || empty("Aucun fichier reference.")}</div>
    </section>
  `;
  const player = qs("#audioPlayer");
  qs("#chooseAudio").addEventListener("click", () => qs("#audioFile").click());
  qs("#audioFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = URL.createObjectURL(file);
    state.audioItems.push(newRecord({ title: file.name, type: file.type, size: file.size, localOnly: true, practice: "" }));
    saveState();
    renderAudio();
  });
  qs("#audioVolume").addEventListener("input", (event) => { player.volume = Number(event.target.value); });
  qs("#audioSpeed").addEventListener("change", (event) => { player.playbackRate = Number(event.target.value); });
  qs("#audioLoop").addEventListener("change", (event) => { player.loop = event.target.checked; });
  qs("#startBell").addEventListener("click", () => ringBellTone(432, 1.8));
  qs("#middleBell").addEventListener("click", () => ringBellTone(540, 1));
  qs("#endBell").addEventListener("click", () => ringBellTone(324, 2.2));
}

function ringBellTone(frequency, duration) {
  if (!state.settings.bell) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency / 2, context.currentTime + duration);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // Le navigateur peut attendre une interaction avant de jouer un son.
  }
}

function renderTibetanCalendar() {
  const profile = state.settings.tibetanCalendarProfile || "personnalise";
  const today = todayKey();
  const builtInEvents = buildTibetanCalendar(tibetanCalendarYear).filter((event) => {
    if (profile === "Bon") return event.type === "Phase lunaire";
    if (event.tradition === "Gelug") return profile === "Gelug";
    if (event.tradition === "Karma Kagyu") return profile === "Karma Kagyu";
    return true;
  });
  const personalEvents = state.calendarEvents.filter((event) => String(event.date).startsWith(String(tibetanCalendarYear)));
  const eventTypes = [...new Set([...builtInEvents, ...personalEvents].map((event) => event.type))].sort();
  const events = [...builtInEvents, ...personalEvents]
    .filter((event) => tibetanCalendarType === "all" || event.type === tibetanCalendarType)
    .filter((event) => tibetanCalendarPeriod === "past" ? String(event.date) < today : String(event.date) >= today)
    .sort((a, b) => {
      const dateOrder = String(a.date).localeCompare(String(b.date));
      return (tibetanCalendarPeriod === "past" ? -dateOrder : dateOrder) || String(a.name).localeCompare(String(b.name));
    });
  qs("#tibetanCalendar").innerHTML = `
    <section class="panel">
      <div class="section-head"><div><span class="eyebrow">Calendrier optionnel</span><h2>Calendrier tibetain</h2></div><button class="primary-btn" id="addCalendarEvent">Ajouter un evenement</button></div>
      <div class="calendar-source-toolbar">
        <label>Profil <select id="calendarProfile">${["Nyingma", "Karma Kagyu", "Gelug", "Sakya", "Bon", "personnalise"].map((value) => `<option ${profile === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        <label>Type <select id="tibetanEventType"><option value="all">Tous</option>${eventTypes.map((type) => `<option value="${escapeAttr(type)}" ${tibetanCalendarType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        <div class="calendar-year-controls">
          <button class="icon-btn" id="previousTibetanYear" aria-label="Annee precedente">←</button>
          <strong>${tibetanCalendarYear}</strong>
          <button class="icon-btn" id="nextTibetanYear" aria-label="Annee suivante">→</button>
          <button class="ghost-btn" id="currentTibetanYear">Aujourd'hui</button>
        </div>
      </div>
      <div class="calendar-period-tabs" role="group" aria-label="Periode du calendrier">
        <button class="ghost-btn ${tibetanCalendarPeriod === "upcoming" ? "is-active" : ""}" data-calendar-period="upcoming" aria-pressed="${tibetanCalendarPeriod === "upcoming"}">A venir et aujourd'hui</button>
        <button class="ghost-btn ${tibetanCalendarPeriod === "past" ? "is-active" : ""}" data-calendar-period="past" aria-pressed="${tibetanCalendarPeriod === "past"}">Jours passes</button>
      </div>
      <p class="detail-caution">${profile === "Karma Kagyu"
        ? "Profil Karma Kagyu: reperes de pratique, commemorations de lignee confirmees et approximation lunaire inspiree du calendrier Tsurluk. Cette vue ne remplace pas l'almanach officiel de votre centre; les jours marques « date calculee » peuvent differer."
        : "Base Phukpa avec reperes lunaires calcules. Les jours marques « date calculee » peuvent differer selon le fuseau, les jours omis ou doubles et la tradition Tsurluk. Le profil Bon affiche uniquement les phases astronomiques et vos dates personnelles."}</p>
      <div class="calendar-sources">
        ${Object.values(TIBETAN_CALENDAR_SOURCES).map((source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)}</a>`).join("")}
      </div>
      <div class="event-list">${events.map(calendarEventCard).join("") || empty("Aucune date disponible pour ce filtre.")}</div>
    </section>
  `;
  qs("#calendarProfile").addEventListener("change", (event) => {
    state.settings.tibetanCalendarProfile = event.target.value;
    saveState();
  });
  qs("#tibetanEventType").addEventListener("change", (event) => {
    tibetanCalendarType = event.target.value;
    renderTibetanCalendar();
  });
  document.querySelectorAll("[data-calendar-period]").forEach((button) => button.addEventListener("click", () => {
    tibetanCalendarPeriod = button.dataset.calendarPeriod;
    renderTibetanCalendar();
  }));
  qs("#previousTibetanYear").addEventListener("click", () => {
    tibetanCalendarYear -= 1;
    renderTibetanCalendar();
  });
  qs("#nextTibetanYear").addEventListener("click", () => {
    tibetanCalendarYear += 1;
    renderTibetanCalendar();
  });
  qs("#currentTibetanYear").addEventListener("click", () => {
    tibetanCalendarYear = new Date().getFullYear();
    tibetanCalendarPeriod = "upcoming";
    renderTibetanCalendar();
  });
  qs("#addCalendarEvent").addEventListener("click", () => openCalendarEventDialog());
  document.querySelectorAll("[data-edit-event]").forEach((button) => button.addEventListener("click", () => openCalendarEventDialog(state.calendarEvents.find((item) => item.id === button.dataset.editEvent))));
  document.querySelectorAll("[data-delete-event]").forEach((button) => button.addEventListener("click", () => softDelete("calendarEvents", button.dataset.deleteEvent, "Supprimer cet evenement ?")));
}

function calendarEventCard(event) {
  return `<article class="event-card ${event.builtIn ? "is-calendar-source" : ""}"><div><div class="tag-row"><span class="tag">${escapeHtml(event.tradition || "Personnalise")}</span><span class="tag">${escapeHtml(event.type || "Evenement")}</span>${event.calculated ? `<span class="tag">Date calculee</span>` : ""}</div><h3>${escapeHtml(event.name)}</h3><p><strong>${formatDisplayDate(event.date, { weekday: "long" })}</strong> · ${escapeHtml(event.explanation || "")}</p>${event.suggestedPractice ? `<p class="muted">${escapeHtml(event.suggestedPractice)}</p>` : ""}${safeExternalUrl(event.source) ? `<a href="${escapeAttr(safeExternalUrl(event.source))}" target="_blank" rel="noopener">${escapeHtml(event.sourceName || "Source")}</a>` : ""}</div>${event.builtIn ? "" : `<div class="button-row"><button class="ghost-btn" data-edit-event="${event.id}">Modifier</button><button class="icon-btn danger-btn" data-delete-event="${event.id}" aria-label="Supprimer">×</button></div>`}</article>`;
}

function openCalendarEventDialog(event = null) {
  openDialog(event ? "Modifier l'evenement" : "Nouvel evenement", `
    <label>Nom <input id="eventName" value="${escapeAttr(event?.name || "")}" required></label>
    <div class="form-grid">
      <label>Date <input id="eventDate" type="date" value="${event?.date || todayKey()}"></label>
      <label>Tradition <input id="eventTradition" value="${escapeAttr(event?.tradition || state.settings.tibetanCalendarProfile || "personnalise")}"></label>
      <label>Type <select id="eventType">${["Phase lunaire", "Guru Rinpoche", "Tara", "Dakini", "Protecteurs", "Tsok", "Fete", "Maitre", "Centre", "Personnel"].map((type) => `<option ${event?.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>Source facultative <input id="eventSource" type="url" value="${escapeAttr(event?.source || "")}"></label>
    </div>
    <label>Courte explication <textarea id="eventExplanation">${escapeHtml(event?.explanation || "")}</textarea></label>
    <label>Pratique suggeree <input id="eventPractice" value="${escapeAttr(event?.suggestedPractice || "")}"></label>
  `, () => {
    const values = { name: qs("#eventName").value.trim(), date: qs("#eventDate").value, tradition: qs("#eventTradition").value.trim(), type: qs("#eventType").value, source: qs("#eventSource").value.trim(), explanation: qs("#eventExplanation").value.trim(), suggestedPractice: qs("#eventPractice").value.trim() };
    if (event) { Object.assign(event, values); markUpdated(event, Object.keys(values)); } else state.calendarEvents.push(newRecord(values));
    saveState();
  });
}

function renderReminders() {
  qs("#reminders").innerHTML = `
    <section class="panel">
      <div class="section-head"><div><span class="eyebrow">Notifications facultatives</span><h2>Rappels respectueux</h2></div><button class="primary-btn" id="addReminder">Nouveau rappel</button></div>
      <p class="muted">Les notifications sont des invitations discretes, jamais des obligations.</p>
      <div class="button-row">
        <button class="ghost-btn" id="requestNotifications">Autoriser les notifications</button>
        <label class="confirm-line"><input id="pauseReminders" type="checkbox" ${state.settings.remindersPaused ? "checked" : ""}> Suspendre tous les rappels</label>
      </div>
      <div class="reminder-list">${state.reminders.map(reminderCard).join("") || empty("Aucun rappel active.")}</div>
    </section>
  `;
  qs("#requestNotifications").addEventListener("click", async () => {
    if (!("Notification" in window)) return showToast("Les notifications ne sont pas disponibles sur ce navigateur.");
    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "Notifications autorisees." : "Autorisation non accordee.");
  });
  qs("#pauseReminders").addEventListener("change", (event) => {
    state.settings.remindersPaused = event.target.checked;
    saveState();
    scheduleReminderChecks();
  });
  qs("#addReminder").addEventListener("click", () => openReminderDialog());
  document.querySelectorAll("[data-toggle-reminder]").forEach((button) => button.addEventListener("click", () => {
    const item = state.reminders.find((reminder) => reminder.id === button.dataset.toggleReminder);
    if (!item) return;
    item.enabled = !item.enabled;
    markUpdated(item, ["enabled"]);
    saveState();
    scheduleReminderChecks();
  }));
  document.querySelectorAll("[data-edit-reminder]").forEach((button) => button.addEventListener("click", () => openReminderDialog(state.reminders.find((item) => item.id === button.dataset.editReminder))));
  document.querySelectorAll("[data-delete-reminder]").forEach((button) => button.addEventListener("click", () => softDelete("reminders", button.dataset.deleteReminder, "Supprimer ce rappel ?")));
}

function reminderCard(item) {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return `<article class="reminder-card"><div><span class="tag">${escapeHtml(item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${item.time} · ${(item.days || []).map((day) => days[day]).join(" ")}</p><p class="muted">${escapeHtml(item.message)}</p></div><div class="button-row"><button class="${item.enabled ? "primary-btn" : "ghost-btn"}" data-toggle-reminder="${item.id}">${item.enabled ? "Active" : "Desactive"}</button><button class="ghost-btn" data-edit-reminder="${item.id}">Modifier</button><button class="icon-btn danger-btn" data-delete-reminder="${item.id}" aria-label="Supprimer">×</button></div></article>`;
}

function openReminderDialog(item = null) {
  const days = item?.days || [1, 2, 3, 4, 5, 6, 0];
  openDialog(item ? "Modifier le rappel" : "Nouveau rappel", `
    <label>Titre <input id="reminderTitle" value="${escapeAttr(item?.title || "Moment de pratique")}" required></label>
    <div class="form-grid">
      <label>Type <select id="reminderType">${["Pratique du matin", "Pratique du soir", "Routine", "Accumulation", "Calendrier tibetain", "Revue hebdomadaire", "Retraite"].map((type) => `<option ${item?.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>Heure <input id="reminderTime" type="time" value="${item?.time || "08:00"}"></label>
      <fieldset class="day-picker"><legend>Jours</legend>${[["L", 1], ["M", 2], ["M", 3], ["J", 4], ["V", 5], ["S", 6], ["D", 0]].map(([label, day]) => `<label><input name="reminderDay" type="checkbox" value="${day}" ${days.includes(day) ? "checked" : ""}>${label}</label>`).join("")}</fieldset>
    </div>
    <label>Message <textarea id="reminderMessage">${escapeHtml(item?.message || "Ton espace de pratique est disponible lorsque tu le souhaites.")}</textarea></label>
  `, () => {
    const values = { title: qs("#reminderTitle").value.trim(), type: qs("#reminderType").value, time: qs("#reminderTime").value, days: [...document.querySelectorAll('input[name="reminderDay"]:checked')].map((input) => Number(input.value)), message: qs("#reminderMessage").value.trim(), enabled: item?.enabled || false, lastTriggered: item?.lastTriggered || "" };
    if (item) { Object.assign(item, values); markUpdated(item, Object.keys(values)); } else state.reminders.push(newRecord(values));
    saveState();
    scheduleReminderChecks();
  });
}

function scheduleReminderChecks() {
  clearInterval(reminderInterval);
  if (state.settings.remindersPaused) return;
  reminderInterval = setInterval(checkReminders, 30000);
  checkReminders();
}

function checkReminders() {
  if (state.settings.remindersPaused || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const triggerKey = `${todayKey(now)}-${time}`;
  state.reminders.forEach((item) => {
    if (!item.enabled || item.time !== time || !item.days.includes(now.getDay()) || item.lastTriggered === triggerKey) return;
    new Notification(item.title, { body: item.message, icon: "./assets/icon.svg" });
    item.lastTriggered = triggerKey;
    markUpdated(item, ["lastTriggered"]);
    saveState();
  });
}

function renderStats() {
  if (state.settings.statsVisible === false) {
    qs("#stats").innerHTML = `<section class="panel">${empty("Les statistiques sont masquees dans les reglages.")}</section>`;
    return;
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - statsPeriod + 1);
  cutoff.setHours(0, 0, 0, 0);
  const practiceCategory = new Map(state.practices.map((practice) => [practice.title, practice.category || "Autre"]));
  const sessions = state.sessions.filter((session) => {
    const inPeriod = new Date(`${session.date}T12:00:00`) >= cutoff;
    const matchesPractice = statsPractice === "all" || session.label === statsPractice;
    const matchesCategory = statsCategory === "all" || practiceCategory.get(session.label) === statsCategory;
    return inPeriod && matchesPractice && matchesCategory && !session.summaryOnly;
  });
  const totalSeconds = sumSessionSeconds(sessions);
  const average = sessions.length ? totalSeconds / sessions.length : 0;
  const daily = sessionsByDay(sessions, Math.min(statsPeriod, 31));
  const maxDaily = Math.max(1, ...daily.map((day) => day.seconds));
  const byPractice = new Map();
  sessions.forEach((session) => byPractice.set(session.label, (byPractice.get(session.label) || 0) + sessionDurationSeconds(session)));
  const practiceRows = [...byPractice.entries()].sort((a, b) => b[1] - a[1]);
  const maxPractice = Math.max(1, ...practiceRows.map(([, seconds]) => seconds));
  const hours = new Map();
  sessions.forEach((session) => {
    const hour = session.createdAt ? new Date(session.createdAt).getHours() : null;
    if (hour !== null && Number.isFinite(hour)) hours.set(hour, (hours.get(hour) || 0) + 1);
  });
  const commonHour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const obstacles = new Map();
  state.journals.filter((entry) => new Date(`${entry.date}T12:00:00`) >= cutoff && entry.obstacle).forEach((entry) => {
    obstacles.set(entry.obstacle, (obstacles.get(entry.obstacle) || 0) + 1);
  });
  const heatmap = sessionsByDay(state.sessions, 90);
  const byMonth = new Map();
  const byWeekday = new Map();
  sessions.forEach((session) => {
    const month = session.date.slice(0, 7);
    const weekday = new Date(`${session.date}T12:00:00`).getDay();
    byMonth.set(month, (byMonth.get(month) || 0) + sessionDurationSeconds(session));
    byWeekday.set(weekday, (byWeekday.get(weekday) || 0) + sessionDurationSeconds(session));
  });
  const monthRows = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const weekdayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const regularDay = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];
  const routineSessions = sessions.filter((session) => session.routineId && !session.summaryOnly);
  const routineCounts = new Map();
  routineSessions.forEach((session) => {
    const routine = state.routines.find((item) => item.id === session.routineId);
    const label = routine?.name || "Routine archivee";
    routineCounts.set(label, (routineCounts.get(label) || 0) + 1);
  });
  qs("#stats").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div><span class="eyebrow">Observation personnelle</span><h2>Statistiques de pratique</h2></div>
        <button class="ghost-btn" id="exportStatsCsv">Exporter CSV</button>
        <div class="filter-bar compact-filter">
          <label>Periode <select id="statsPeriod">
            <option value="7" ${statsPeriod === 7 ? "selected" : ""}>7 jours</option>
            <option value="30" ${statsPeriod === 30 ? "selected" : ""}>30 jours</option>
            <option value="90" ${statsPeriod === 90 ? "selected" : ""}>90 jours</option>
            <option value="365" ${statsPeriod === 365 ? "selected" : ""}>1 an</option>
          </select></label>
          <label>Pratique <select id="statsPractice">
            <option value="all">Toutes</option>
            ${[...new Set(state.sessions.map((session) => session.label))].sort().map((label) => `<option ${statsPractice === label ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select></label>
          <label>Categorie <select id="statsCategory">
            <option value="all">Toutes</option>
            ${[...new Set(state.practices.map((practice) => practice.category || "Autre"))].sort().map((category) => `<option ${statsCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
          </select></label>
        </div>
      </div>
      <div class="metrics-grid">
        ${metric("Temps", formatDuration(totalSeconds), `${statsPeriod} derniers jours`)}
        ${metric("Sessions", sessions.length, "sans comparaison")}
        ${metric("Duree moyenne", formatDuration(average), "par session")}
        ${metric("Horaire frequent", commonHour === undefined ? "—" : `${String(commonHour).padStart(2, "0")} h`, "selon les sessions datees")}
        ${metric("Jour regulier", regularDay ? weekdayNames[regularDay[0]] : "—", "temps cumule sur la periode")}
      </div>
    </section>
    <div class="two-col">
      <section class="panel">
        <span class="eyebrow">Vue mensuelle</span>
        <h2>Temps par mois</h2>
        <div class="compact-list">
          ${monthRows.map(([month, seconds]) => `<div><span>${escapeHtml(month)}</span><strong>${formatDuration(seconds)}</strong></div>`).join("") || empty("Pas encore de donnees mensuelles.")}
        </div>
      </section>
      <section class="panel">
        <span class="eyebrow">Routines</span>
        <h2>Historique execute</h2>
        <div class="compact-list">
          ${[...routineCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => `<div><span>${escapeHtml(label)}</span><strong>${count} etape${count > 1 ? "s" : ""}</strong></div>`).join("") || empty("Aucune routine sur cette periode.")}
        </div>
      </section>
    </div>
    <section class="panel">
      <span class="eyebrow">Rythme quotidien</span>
      <h2>Minutes par jour</h2>
      <div class="bar-chart" aria-label="Minutes de pratique par jour">
        ${daily.map((day) => `<div class="bar-column" title="${day.date} · ${formatDuration(day.seconds)}"><span style="height:${Math.max(3, Math.round((day.seconds / maxDaily) * 100))}%"></span><small>${day.date.slice(8)}</small></div>`).join("")}
      </div>
    </section>
    <div class="two-col">
      <section class="panel">
        <span class="eyebrow">Repartition</span>
        <h2>Par pratique</h2>
        <div class="horizontal-bars">
          ${practiceRows.map(([label, seconds]) => `<div><span>${escapeHtml(label)}</span><div><i style="width:${Math.round((seconds / maxPractice) * 100)}%"></i></div><strong>${formatDuration(seconds)}</strong></div>`).join("") || empty("Aucune session sur cette periode.")}
        </div>
      </section>
      <section class="panel">
        <span class="eyebrow">Accumulations</span>
        <h2>Progression active</h2>
        <div class="compact-list">
          ${state.accumulations.filter((item) => !item.archived).map((item) => {
            const total = accumulationTotal(item);
            return `<div><span>${escapeHtml(item.name)}</span><strong>${total.toLocaleString("fr-FR")} / ${Number(item.target || 0).toLocaleString("fr-FR")}</strong></div>`;
          }).join("") || empty("Aucune accumulation active.")}
        </div>
        <span class="eyebrow stats-subhead">Obstacles notes</span>
        <div class="tag-row">${[...obstacles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => `<span class="tag">${escapeHtml(label)} · ${count}</span>`).join("") || empty("Aucun obstacle renseigne.")}</div>
      </section>
    </div>
    <section class="panel">
      <span class="eyebrow">Vue sur 90 jours</span>
      <h2>Continuite de la pratique</h2>
      <div class="practice-heatmap" aria-label="Carte des jours pratiques">
        ${heatmap.map((day) => `<span class="${day.seconds ? "has-practice" : ""}" title="${day.date} · ${formatDuration(day.seconds)}"></span>`).join("")}
      </div>
    </section>
  `;
  qs("#statsPeriod").addEventListener("change", (event) => {
    statsPeriod = Number(event.target.value);
    renderStats();
  });
  qs("#statsPractice").addEventListener("change", (event) => {
    statsPractice = event.target.value;
    renderStats();
  });
  qs("#statsCategory").addEventListener("change", (event) => {
    statsCategory = event.target.value;
    renderStats();
  });
  qs("#exportStatsCsv").addEventListener("click", () => exportStatisticsCsv(sessions));
}

function renderSettings() {
  qs("#settings").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div><span class="eyebrow">Reglages avances</span><h2>Votre espace de pratique</h2></div>
        <button class="primary-btn" id="saveSettings">Enregistrer</button>
      </div>
      <div class="settings-sections">
        <fieldset class="settings-group">
          <legend>Pratique</legend>
          <div class="form-grid">
          <label>Objectif quotidien en minutes <input id="dailyGoal" type="number" min="1" max="360" value="${state.settings.dailyGoal}"></label>
          <label>Duree par defaut <input id="defaultTimer" type="number" min="1" max="180" value="${state.settings.defaultTimer}"></label>
          <label>Cloche sonore <select id="bellSetting"><option value="true" ${state.settings.bell ? "selected" : ""}>Activee</option><option value="false" ${!state.settings.bell ? "selected" : ""}>Desactivee</option></select></label>
          <label>Vibration facultative <select id="vibrationSetting"><option value="false" ${!state.settings.vibration ? "selected" : ""}>Desactivee</option><option value="true" ${state.settings.vibration ? "selected" : ""}>Activee</option></select></label>
          <label>Statistiques <select id="statsVisibility"><option value="true" ${state.settings.statsVisible !== false ? "selected" : ""}>Visibles</option><option value="false" ${state.settings.statsVisible === false ? "selected" : ""}>Masquees</option></select></label>
          <label>Series <select id="streakVisibility"><option value="true" ${state.settings.streaksVisible !== false ? "selected" : ""}>Visibles</option><option value="false" ${state.settings.streaksVisible === false ? "selected" : ""}>Masquees</option></select></label>
          </div>
        </fieldset>

        <fieldset class="settings-group">
          <legend>Apparence et accessibilite</legend>
          <div class="form-grid">
          <label>Langue <select id="languageSetting"><option value="fr">Francais</option><option value="en" disabled>English (a venir)</option><option value="de" disabled>Deutsch (a venir)</option><option value="bo" disabled>Tibetain (a venir)</option></select></label>
          <label>Theme <select id="themeSetting">
            <option value="auto" ${state.settings.theme === "auto" ? "selected" : ""}>Automatique</option>
            <option value="light" ${state.settings.theme === "light" ? "selected" : ""}>Clair</option>
            <option value="dark" ${state.settings.theme === "dark" ? "selected" : ""}>Sombre</option>
          </select></label>
          <label>Taille du texte <select id="textSizeSetting">
            <option value="small" ${state.settings.textSize === "small" ? "selected" : ""}>Compacte</option>
            <option value="normal" ${!state.settings.textSize || state.settings.textSize === "normal" ? "selected" : ""}>Normale</option>
            <option value="large" ${state.settings.textSize === "large" ? "selected" : ""}>Grande</option>
            <option value="xlarge" ${state.settings.textSize === "xlarge" ? "selected" : ""}>Tres grande</option>
          </select></label>
          <label>Contraste renforce <select id="contrastSetting"><option value="false" ${!state.settings.highContrast ? "selected" : ""}>Desactive</option><option value="true" ${state.settings.highContrast ? "selected" : ""}>Active</option></select></label>
          <label>Animations reduites <select id="motionSetting"><option value="false" ${!state.settings.reducedMotion ? "selected" : ""}>Selon l'appareil</option><option value="true" ${state.settings.reducedMotion ? "selected" : ""}>Toujours reduites</option></select></label>
          </div>
        </fieldset>

        <fieldset class="settings-group">
          <legend>Dates et organisation</legend>
          <div class="form-grid">
          <label>Premier jour de la semaine <select id="firstDaySetting"><option value="monday" ${state.settings.firstDayOfWeek !== "sunday" ? "selected" : ""}>Lundi</option><option value="sunday" ${state.settings.firstDayOfWeek === "sunday" ? "selected" : ""}>Dimanche</option></select></label>
          <label>Format de date <select id="dateFormatSetting">
            <option value="long" ${state.settings.dateFormat === "long" ? "selected" : ""}>21 juin 2026</option>
            <option value="short" ${state.settings.dateFormat === "short" ? "selected" : ""}>21/06/2026</option>
            <option value="iso" ${state.settings.dateFormat === "iso" ? "selected" : ""}>2026-06-21</option>
          </select></label>
          <label>Fuseau horaire <input id="timezoneSetting" value="${escapeAttr(state.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}" list="timezoneSuggestions"></label>
          <datalist id="timezoneSuggestions">
            ${["Europe/Brussels", "Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Kathmandu", "Asia/Kolkata"].map((zone) => `<option value="${zone}"></option>`).join("")}
          </datalist>
          </div>
        </fieldset>

        <fieldset class="settings-group">
          <legend>Confidentialite et synchronisation</legend>
          <div class="form-grid">
            <label>Synchronisation du compte <select id="cloudSyncSetting" ${currentUser ? "" : "disabled"}>
              <option value="true" ${state.settings.cloudSyncEnabled !== false ? "selected" : ""}>Activee</option>
              <option value="false" ${state.settings.cloudSyncEnabled === false ? "selected" : ""}>Suspendue</option>
            </select><span class="field-help">${currentUser ? "La sauvegarde locale reste active dans les deux cas." : "Connectez-vous pour synchroniser plusieurs appareils."}</span></label>
            <label>Rappels <button class="ghost-btn" id="openReminderSettings" type="button">Gerer les rappels</button></label>
          </div>
        </fieldset>

        <fieldset class="settings-group">
          <legend>Import et export</legend>
          <div class="settings-actions">
            <button class="ghost-btn" id="exportData" type="button">Sauvegarde JSON</button>
            <button class="ghost-btn" id="importData" type="button">Importer JSON</button>
            <input id="importFile" type="file" accept="application/json,.json" hidden>
            <button class="ghost-btn" id="exportSessionsCsv" type="button">Sessions CSV</button>
            <button class="ghost-btn" id="exportAccumulationsCsv" type="button">Accumulations CSV</button>
            <button class="ghost-btn" id="printReport" type="button">Journal / PDF</button>
          </div>
        </fieldset>

        <fieldset class="settings-group danger-zone">
          <legend>Donnees sensibles</legend>
          <p class="small-copy">Une sauvegarde JSON est recommandee avant toute suppression.</p>
          <div class="button-row">
            <button class="ghost-btn danger-btn" id="resetData" type="button">Supprimer toutes mes donnees</button>
            ${currentUser ? `<button class="ghost-btn danger-btn" id="deleteAccount" type="button">Supprimer mon compte</button>` : ""}
          </div>
        </fieldset>
      </div>
    </section>
  `;
  qs("#saveSettings").addEventListener("click", async () => {
    const cloudWasEnabled = state.settings.cloudSyncEnabled !== false;
    const timerDurationChanged = Number(qs("#defaultTimer").value) !== Number(state.settings.defaultTimer);
    const timezone = qs("#timezoneSetting").value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(timezone)) {
      showToast("Le fuseau horaire indique n'est pas reconnu.");
      return;
    }
    state.settings.dailyGoal = Math.max(1, Number(qs("#dailyGoal").value));
    state.settings.defaultTimer = Math.max(1, Number(qs("#defaultTimer").value));
    state.settings.bell = qs("#bellSetting").value === "true";
    state.settings.vibration = qs("#vibrationSetting").value === "true";
    state.settings.statsVisible = qs("#statsVisibility").value === "true";
    state.settings.streaksVisible = qs("#streakVisibility").value === "true";
    state.settings.language = qs("#languageSetting").value;
    state.settings.theme = qs("#themeSetting").value;
    state.settings.textSize = qs("#textSizeSetting").value;
    state.settings.highContrast = qs("#contrastSetting").value === "true";
    state.settings.reducedMotion = qs("#motionSetting").value === "true";
    state.settings.firstDayOfWeek = qs("#firstDaySetting").value;
    state.settings.dateFormat = qs("#dateFormatSetting").value;
    state.settings.timezone = timezone;
    state.settings.cloudSyncEnabled = currentUser ? qs("#cloudSyncSetting").value === "true" : true;
    if (timerDurationChanged && !timer.running && elapsedTimerSeconds(timer) === 0) {
      clearTimerTicker();
      timer = createTimerState(state.settings.defaultTimer, timer.label);
      persistTimerState();
    }
    localStorage.setItem(storageKey(), JSON.stringify(state));
    applyPreferences();
    render();
    renderNav();
    if (currentUser && cloudWasEnabled && state.settings.cloudSyncEnabled === false) {
      localStorage.setItem(`${storageKey()}:dirty`, "1");
      await syncStateNow({ bypassPreference: true });
    } else if (currentUser && state.settings.cloudSyncEnabled !== false) {
      localStorage.setItem(`${storageKey()}:dirty`, "1");
      scheduleRemoteSync();
    }
    showToast("Reglages enregistres.");
  });
  qs("#resetData").addEventListener("click", () => {
    if (confirm("Supprimer toutes les donnees de pratique de ce compte ? Cette action est definitive apres synchronisation.")) {
      const preservedSettings = { ...state.settings };
      state = migrateState({ ...clone(seedState), settings: preservedSettings }, seedState);
      localStorage.setItem(storageKey(), JSON.stringify(state));
      saveState();
      setView("dashboard");
      showToast("Toutes les donnees de pratique ont ete supprimees.");
    }
  });
  qs("#deleteAccount")?.addEventListener("click", openDeleteAccountDialog);
  qs("#openReminderSettings").addEventListener("click", () => setView("reminders"));
  qs("#exportData").addEventListener("click", () => {
    downloadFile(`chemin-clair-${todayKey()}.json`, JSON.stringify(state, null, 2), "application/json");
  });
  qs("#importData").addEventListener("click", () => qs("#importFile").click());
  qs("#importFile").addEventListener("change", importBackupFile);
  qs("#exportSessionsCsv").addEventListener("click", exportSessionsCsv);
  qs("#exportAccumulationsCsv").addEventListener("click", exportAccumulationsCsv);
  qs("#printReport").addEventListener("click", printJournalReport);
}

function openDeleteAccountDialog() {
  openDialog("Supprimer mon compte", `
    <div class="detail-caution">
      Cette action supprime le compte, les sessions de connexion et les donnees synchronisees. Elle ne peut pas etre annulee.
    </div>
    <label>Mot de passe actuel <input id="deleteAccountPassword" type="password" autocomplete="current-password" required></label>
    <label class="confirm-line"><input id="deleteAccountConfirm" type="checkbox"> Je comprends que cette suppression est definitive.</label>
  `, async () => {
    if (!qs("#deleteAccountConfirm").checked) {
      showToast("Confirmez la suppression definitive.");
      return false;
    }
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: qs("#deleteAccountPassword").value })
    });
    const payload = await response.json();
    if (!response.ok) {
      showToast(payload.error || "Suppression du compte impossible.");
      return false;
    }
    localStorage.removeItem(storageKey(currentUser.id));
    localStorage.removeItem(revisionStorageKey());
    currentUser = null;
    remoteRevision = 0;
    syncStatus = "local";
    state = loadCachedState();
    applyPreferences();
    renderNav();
    render();
    setView("dashboard");
    showToast("Compte et donnees synchronisees supprimes.");
    return true;
  });
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
      markUpdated(session, Object.keys(values));
    } else {
      const now = new Date().toISOString();
      state.sessions.push({ id: makeId(), ...values, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function openPracticeDialog(practice = null) {
  const stepsText = practice
    ? (practice.detailedSteps || []).map((step) => [
        step.title,
        step.duration || "",
        step.instruction || "",
        step.original || "",
        step.transliteration || "",
        step.phonetic || "",
        step.translation || "",
        step.commentary || ""
      ].join(" | ")).join("\n")
    : `Preparation | 2 min | Stabiliser le corps et poser l'intention. | | | | |
Pratique principale | 6 min | Suivre les instructions personnelles autorisees avec attention. | | | | |
Dedication | 2 min | Reposer l'esprit et dedier les bienfaits. | | | | |`;
  openDialog(practice ? "Modifier la pratique" : "Nouvelle pratique", `
    <label>Titre <input id="practiceTitle" value="${escapeAttr(practice?.title || "Nouvelle pratique")}" required></label>
    <div class="form-grid">
      <label>Categorie <input id="practiceCategory" value="${escapeAttr(practice?.category || "Personnel")}"></label>
      <label>Duree <input id="practiceMinutes" type="number" min="1" value="${practice?.minutes || 10}"></label>
    </div>
    <label>But de la pratique <textarea id="practicePurpose">${escapeHtml(practice?.purpose || "Clarifier l'intention de cette pratique personnelle.")}</textarea></label>
    <label>Preparation <textarea id="practicePreparation">${escapeHtml(practice?.preparation || "Preparer un espace calme, regler le minuteur et adopter une posture stable.")}</textarea></label>
    <label>Etapes detaillees
      <textarea id="practiceSteps">${escapeHtml(stepsText)}</textarea>
      <span class="field-help">Une ligne par etape : Titre | duree | instructions | original | translitteration | phonetique | traduction | commentaire. Les champs apres les instructions sont facultatifs.</span>
    </label>
    <label>Cloture <textarea id="practiceClosing">${escapeHtml(practice?.closing || "Terminer par quelques respirations calmes avant de se lever.")}</textarea></label>
    <label>Point d'attention <textarea id="practiceCaution">${escapeHtml(practice?.caution || "Adapter la pratique a sa situation et aux instructions de son enseignant.")}</textarea></label>
    <label>Resume <textarea id="practiceNotes">${escapeHtml(practice?.notes || "Sequence personnelle a utiliser dans le respect des transmissions recues.")}</textarea></label>
  `, () => {
    const previousSteps = practice?.detailedSteps || [];
    const usedStepIds = new Set();
    const detailedSteps = qs("#practiceSteps").value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [title, duration, instruction, original, transliteration, phonetic, translation, commentary] = line.split("|").map((part) => part.trim());
        const values = {
          title: title || "Etape",
          duration: duration || "",
          instruction: instruction || "Accomplir cette etape avec attention.",
          original: original || "",
          transliteration: transliteration || "",
          phonetic: phonetic || "",
          translation: translation || "",
          commentary: commentary || ""
        };
        const existing = previousSteps[index]?.title === values.title
          ? previousSteps[index]
          : previousSteps.find((step) => step.title === values.title && !usedStepIds.has(step.id));
        if (!existing) return newRecord(values);
        usedStepIds.add(existing.id);
        const next = { ...existing, ...values };
        if (Object.keys(values).some((key) => existing[key] !== values[key])) markUpdated(next, Object.keys(values));
        return next;
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
      recordNestedDeletions(state, "practices.detailedSteps", practice.detailedSteps || [], detailedSteps);
      Object.assign(practice, values);
      markUpdated(practice, Object.keys(values));
    } else {
      const now = new Date().toISOString();
      state.practices.push({ id: makeId(), ...values, archived: false, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function openJournalDialog(entry = null) {
  const scaleOptions = (selected) => ["non precisee", "faible", "moderee", "forte"]
    .map((value) => `<option ${selected === value ? "selected" : ""}>${value}</option>`)
    .join("");
  openDialog(entry ? "Modifier la note" : "Nouvelle note", `
    <label>Titre <input id="journalTitle" value="${escapeAttr(entry?.title || "Apres la pratique")}" required></label>
    <div class="form-grid">
      <label>Type <select id="journalType">
        <option value="quick" ${entry?.type === "quick" || !entry ? "selected" : ""}>Note rapide</option>
        <option value="free" ${entry?.type === "free" ? "selected" : ""}>Journal libre</option>
        <option value="weekly" ${entry?.type === "weekly" ? "selected" : ""}>Revue hebdomadaire</option>
      </select></label>
      <label>Date <input id="journalDate" type="date" value="${escapeAttr(entry?.date || todayKey())}"></label>
      <label>Minutes <input id="journalMinutes" type="number" min="0" value="${entry?.minutes ?? minutesFor(todayKey())}"></label>
      <label>Etat <input id="journalMood" value="${escapeAttr(entry?.mood || "presence")}"></label>
      <label>Pratique associee <select id="journalPractice">
        <option value="">Aucune</option>
        ${state.practices.map((practice) => `<option value="${practice.id}" ${entry?.practiceId === practice.id ? "selected" : ""}>${escapeHtml(practice.title)}</option>`).join("")}
      </select></label>
      <label>Session associee <select id="journalSession">
        <option value="">Aucune</option>
        ${state.sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((session) => `<option value="${session.id}" ${entry?.sessionId === session.id ? "selected" : ""}>${escapeHtml(session.date)} · ${escapeHtml(session.label)} · ${formatDuration(sessionDurationSeconds(session))}</option>`).join("")}
      </select></label>
      <label>Tags, separes par des virgules <input id="journalTags" value="${escapeAttr((entry?.tags || []).join(", "))}"></label>
      <label>Qualite de presence <select id="journalPresence">
        ${["non precisee", "fragile", "variable", "stable", "claire"].map((value) => `<option ${entry?.presence === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>Agitation <select id="journalAgitation">${scaleOptions(entry?.agitation || "non precisee")}</select></label>
      <label>Torpeur <select id="journalTorpor">${scaleOptions(entry?.torpor || "non precisee")}</select></label>
      <label>Clarte <select id="journalClarity">${scaleOptions(entry?.clarity || "non precisee")}</select></label>
      <label>Emotion dominante <input id="journalEmotion" value="${escapeAttr(entry?.emotion || "")}" placeholder="calme, joie, tristesse..."></label>
      <label>Obstacle principal <input id="journalObstacle" value="${escapeAttr(entry?.obstacle || "")}"></label>
      <label>Element aidant <input id="journalSupport" value="${escapeAttr(entry?.support || "")}"></label>
    </div>
    <label>Note <textarea id="journalBody">${escapeHtml(entry?.body || "Ce que je remarque aujourd'hui...")}</textarea></label>
    <label>Intention pour la suite <textarea id="journalIntention">${escapeHtml(entry?.intention || "")}</textarea></label>
    <label>Image locale facultative
      <input id="journalImage" type="file" accept="image/png,image/jpeg,image/webp">
      <span class="field-help">Maximum 1,5 Mo. L'image reste sur cet appareil et n'est pas envoyee vers la synchronisation.</span>
    </label>
    ${entry?.image?.dataUrl ? `
      <div class="attachment-preview">
        <img src="${escapeAttr(entry.image.dataUrl)}" alt="${escapeAttr(entry.image.alt || "Image jointe")}">
        <label class="confirm-line"><input id="removeJournalImage" type="checkbox"> Retirer l'image actuelle</label>
      </div>
    ` : ""}
  `, async () => {
    const imageFile = qs("#journalImage").files?.[0];
    if (imageFile && imageFile.size > 1_500_000) {
      showToast("Cette image depasse la limite de 1,5 Mo.");
      return false;
    }
    let image = qs("#removeJournalImage")?.checked ? null : entry?.image || null;
    if (imageFile) {
      image = {
        name: imageFile.name,
        type: imageFile.type,
        size: imageFile.size,
        alt: `Image du journal : ${qs("#journalTitle").value.trim()}`,
        dataUrl: await readFileAsDataUrl(imageFile)
      };
    }
    const tags = qs("#journalTags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
    const values = {
      title: qs("#journalTitle").value.trim() || "Note de pratique",
      type: qs("#journalType").value,
      date: qs("#journalDate").value,
      minutes: Number(qs("#journalMinutes").value),
      mood: qs("#journalMood").value,
      practiceId: qs("#journalPractice").value,
      sessionId: qs("#journalSession").value,
      tags,
      presence: qs("#journalPresence").value,
      agitation: qs("#journalAgitation").value,
      torpor: qs("#journalTorpor").value,
      clarity: qs("#journalClarity").value,
      emotion: qs("#journalEmotion").value.trim(),
      obstacle: qs("#journalObstacle").value.trim(),
      support: qs("#journalSupport").value.trim(),
      body: qs("#journalBody").value,
      intention: qs("#journalIntention").value.trim(),
      favorite: entry?.favorite || false,
      image
    };
    tags.forEach((label) => {
      const existing = state.journalTags.find((tag) => tag.label.toLowerCase() === label.toLowerCase());
      if (!existing) state.journalTags.push(newRecord({ label }));
    });
    if (entry) {
      Object.assign(entry, values);
      markUpdated(entry, Object.keys(values));
    } else {
      const now = new Date().toISOString();
      state.journals.push({ id: makeId(), ...values, createdAt: now, updatedAt: now, version: 1 });
    }
    saveState();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function openWeeklyReviewDialog() {
  const weekSessions = countedSessions(state.sessions.filter((session) => new Date(`${session.date}T12:00:00`) >= weekStart()));
  const practiceTotals = new Map();
  weekSessions.forEach((session) => practiceTotals.set(session.label, (practiceTotals.get(session.label) || 0) + sessionDurationSeconds(session)));
  const mostRegular = [...practiceTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucune pratique enregistree";
  openDialog("Revue hebdomadaire", `
    <p class="detail-callout">Cette semaine : ${formatDuration(sumSessionSeconds(weekSessions))} reparties sur ${weekSessions.length} sessions. Pratique la plus presente : ${escapeHtml(mostRegular)}.</p>
    <label>Quel obstacle revient souvent ? <textarea id="reviewObstacle"></textarea></label>
    <label>Qu'est-ce qui a soutenu la stabilite ? <textarea id="reviewSupport"></textarea></label>
    <label>Quelle qualite souhaites-tu cultiver ? <textarea id="reviewQuality"></textarea></label>
    <label>Quel ajustement simple envisages-tu ? <textarea id="reviewAdjustment"></textarea></label>
  `, () => {
    state.journals.push(newRecord({
      type: "weekly",
      title: `Revue de la semaine du ${weekStart().toLocaleDateString("fr-FR")}`,
      date: todayKey(),
      minutes: 0,
      mood: "observation",
      presence: "non precisee",
      agitation: "non precisee",
      torpor: "non precisee",
      clarity: "non precisee",
      emotion: "",
      obstacle: qs("#reviewObstacle").value.trim(),
      support: qs("#reviewSupport").value.trim(),
      intention: qs("#reviewAdjustment").value.trim(),
      tags: ["revue-hebdomadaire"],
      favorite: false,
      body: [
        `Pratique la plus presente : ${mostRegular}.`,
        `Obstacle : ${qs("#reviewObstacle").value.trim()}.`,
        `Soutien : ${qs("#reviewSupport").value.trim()}.`,
        `Qualite a cultiver : ${qs("#reviewQuality").value.trim()}.`,
        `Ajustement : ${qs("#reviewAdjustment").value.trim()}.`
      ].join("\n")
    }));
    saveState();
  });
}

function markUpdated(record, fields = Object.keys(record)) {
  const previousVersion = Number(record.version || 1);
  const previousUpdatedAt = record.updatedAt || record.createdAt || new Date().toISOString();
  const now = new Date().toISOString();
  record.fieldVersions = { ...(record.fieldVersions || {}) };
  record.fieldUpdatedAt = { ...(record.fieldUpdatedAt || {}) };
  Object.keys(record).forEach((field) => {
    if (["fieldVersions", "fieldUpdatedAt"].includes(field)) return;
    if (record.fieldVersions[field] === undefined) record.fieldVersions[field] = previousVersion;
    if (!record.fieldUpdatedAt[field]) record.fieldUpdatedAt[field] = previousUpdatedAt;
  });
  record.updatedAt = now;
  record.version = previousVersion + 1;
  fields.forEach((field) => {
    record.fieldVersions[field] = record.version;
    record.fieldUpdatedAt[field] = now;
  });
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
  document.querySelectorAll("[data-favorite-journal]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.journals.find((item) => item.id === button.dataset.favoriteJournal);
      if (!entry) return;
      entry.favorite = !entry.favorite;
      markUpdated(entry, ["favorite"]);
      saveState();
    });
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

function exportStatisticsCsv(sessions) {
  const rows = [
    ["date", "pratique", "categorie", "duree_secondes", "routine"],
    ...sessions.map((session) => {
      const practice = state.practices.find((item) => item.title === session.label);
      const routine = state.routines.find((item) => item.id === session.routineId);
      return [
        session.date,
        session.label,
        practice?.category || "",
        sessionDurationSeconds(session),
        routine?.name || ""
      ];
    })
  ];
  downloadFile(`chemin-clair-statistiques-${todayKey()}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function exportAccumulationsCsv() {
  const rows = [["type", "id", "date", "nom", "nombre", "objectif"]];
  state.mantra.history.forEach((entry) => rows.push(["mantra", entry.id, entry.date, entry.name, entry.count, ""]));
  state.accumulations.forEach((item) => {
    if (!item.entries?.length) {
      rows.push(["accumulation", item.id, item.startDate || "", item.name || "", 0, item.target || ""]);
    }
    item.entries?.forEach((entry) => rows.push([
      "accumulation",
      entry.id,
      entry.date || "",
      item.name || "",
      entry.count || 0,
      item.target || ""
    ]));
  });
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
  const cloudState = payload.data
    ? preserveLocalJournalImages(mergeState(seedState, payload.data))
    : migrateState(null, seedState);
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
    <h2>Statistiques</h2><p>${countedSessions().length} sessions · ${formatDuration(totalSeconds)} de pratique · ${state.mantra.history.reduce((sum, item) => sum + Number(item.count || 0), 0)} mantras</p>
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
  save.onclick = async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const result = await onSave();
      if (result !== false) dialog.close();
    } catch (error) {
      showToast(error.message || "Enregistrement impossible.");
    } finally {
      save.disabled = false;
    }
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

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderView() {
  const renderers = {
    dashboard: renderDashboard,
    timer: renderTimer,
    routines: renderRoutines,
    mantras: renderMantras,
    accumulations: renderAccumulations,
    rituals: renderRituals,
    journal: renderJournal,
    calendar: renderCalendar,
    tibetanCalendar: renderTibetanCalendar,
    retreats: renderRetreats,
    library: renderLibrary,
    audio: renderAudio,
    reminders: renderReminders,
    stats: renderStats,
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

applyPreferences();
renderNav();
setView(activeView);
renderShellStats();
renderAccountPanel();

qs("#closeAuthBtn").addEventListener("click", () => qs("#authDialog").close());
qs("#authModeBtn").addEventListener("click", () => openAuthDialog(authMode === "login" ? "register" : "login"));
qs("#authForm").addEventListener("submit", submitAuth);
qs("#menuTab").addEventListener("click", () => setSidebarOpen(true));
qs("#closeSidebarBtn").addEventListener("click", () => setSidebarOpen(false, { restoreFocus: true }));
qs("#sidebarBackdrop").addEventListener("click", () => setSidebarOpen(false, { restoreFocus: true }));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
    setSidebarOpen(false, { restoreFocus: true });
  }
});

drawerMedia.addEventListener?.("change", syncSidebarMode);
syncSidebarMode();

window.addEventListener("focus", () => {
  if (currentUser) restoreRemoteState({ importLocalWhenEmpty: false });
});

window.addEventListener("online", () => {
  if (currentUser) syncStateNow();
});

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (state.settings.theme === "auto") applyPreferences();
});

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    await registration.update();
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
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
scheduleReminderChecks();
