# Chemin Clair

Application web autonome pour soutenir une pratique bouddhiste tibetaine reguliere et respectueuse.

## Fonctionnalites

- Tableau de bord et objectif quotidien
- Minuteur de meditation avec cloche
- Compteur de mantras et cycles de mala
- Rituels detailles pas a pas
- Mode guide plein ecran avec variantes original, translitteration, phonetique et traduction
- Creation de pratiques personnelles
- Routines configurables avec etapes facultatives et choix du mode d'historique
- Journal de pratique
- Journal enrichi avec revues hebdomadaires, recherche, filtres et images privees
- Calendrier et suivi des series
- Bibliotheque de guides complets
- Retraites, accumulations, calendrier tibetain, audio et rappels
- Calendrier tibetain Phukpa source avec phases lunaires, jours de pratique et grands Duchen
- Analyses hebdomadaires et mensuelles des accumulations
- Statistiques filtrables par pratique et categorie avec export CSV
- Themes clair et sombre, contraste renforce et tailles de texte
- Export des donnees au format JSON
- Sauvegarde locale dans le navigateur
- Comptes securises avec session persistante
- Synchronisation entre appareils
- Fusion recursive des donnees imbriquees avec resolution deterministe des conflits
- Tombstones de suppression pour empecher le retour d'elements effaces
- Donnees isolees par compte
- Suppression securisee du compte et de ses donnees synchronisees

## Utilisation

La version publique est deployee sur Vercel. Le mode local reste disponible sans compte; une connexion permet de synchroniser les donnees entre appareils.

## Configuration serveur

Le projet utilise des fonctions Vercel et PostgreSQL. Configurez `DATABASE_URL` dans Vercel. Les tables `cc_users`, `cc_sessions` et `cc_user_state` sont creees automatiquement au premier appel.

## Respect des traditions

Cette application soutient l'organisation et la regularite. Elle ne remplace pas un enseignant qualifie, une transmission authentique ou les instructions propres a une lignee.
