# Créer un skill InvestorOS utile

Un skill est une procédure courte qui améliore une décision de l’agent. Il explique
quand employer les outils, quelles preuves attendre et quand demander une précision.
Il ne remplace pas le code, les permissions du rôle ni les données financières.

## Choisir une responsabilité

Commencer par trois demandes réelles et un contre-exemple. Exemple company-analysis :
« Analyse NVDA la semaine prochaine », « Quels risques documentés pour cet émetteur ? »,
« Vérifie ses revenus annuels ». Contre-exemple : « simule une baisse explicite de 15 % »
relève de conditional-scenarios. Une recherche d’entreprise ne doit pas demander de
pourcentages arbitraires pour démarrer.

Créer un skill distinct lorsque les critères de décision diffèrent. Les spécialistes
Objectifs et horizon et Risque et liquidités ont des procédures séparées parce que
la durée d’un projet ne définit pas la capacité financière à subir une perte.
Éviter les skills fourre-tout, les variantes purement stylistiques et les doublons.

## Structure minimale

Créer `skills/<nom>/SKILL.md` avec :

```markdown
---
name: examiner-une-capacite
description: Examiner une capacité dans un contexte métier précis.
---

# Examiner une capacité

Décrire le résultat utile, les entrées nécessaires, les outils réellement disponibles,
la manière de vérifier leur sortie et le comportement si les données manquent.
```

`description:` est au même niveau que `name:`. Le nom utilise
minuscules, chiffres et tirets. La description précise quand sélectionner le skill;
les tags du catalogue contiennent les mots des utilisateurs et les termes du métier.
Écrire directement une description valide, par exemple :

```yaml
name: evidence-review
description: Vérifier les preuves d’une analyse, leurs périodes, unités et contradictions.
```

## Contenu qui change réellement le comportement

Inclure les distinctions qui évitent une erreur concrète :

- Déclencheur et résultat attendu, avec un exemple ambigu si nécessaire.
- Informations indispensables et informations facultatives; ne demander que celles
  qui changent l’analyse. Utiliser ask_user lorsqu’une réponse est nécessaire.
- Outils disponibles dans le rôle, ordre utile et critères de succès observables.
- Faits, interprétations et hypothèses; dates, unités, devise et provenance requises.
- Cas d’échec : source absente, preuve insuffisante, état partiel, timeout, budget.
- Condition d’arrêt et restitution : limites, inconnues et ce qui ferait changer
  la conclusion. Ne pas inventer une certitude pour remplir une interface.

Décrire le raisonnement vérifiable, pas une chaîne de pensée privée à afficher.
Ne pas répéter toutes les règles système. Laisser de la liberté à l’agent sur la
forme de la réponse, imposer seulement les invariants métier essentiels.

## Contrat avec le code

Ajouter une entrée dans catalog.json : id, description, tags, required_tools, path.
`required_tools` décrit les dépendances métier. Les outils effectifs du rôle restent
la référence : un spécialiste possède search_skills/load_skill, mais ne peut pas
appeler start_analysis ni update_profile; il transmet ses constats au coordinateur.
Pour ces rôles, required_tools peut être vide : la procédure guide leur restitution.

Le runtime actuel ne charge que SKILL.md, pas ses références ni scripts. Garder les
procédures autonomes; ne pas ajouter des liens à des ressources indispensables que
l’agent ne pourrait pas lire. Les guides humains README et AUTHORING restent hors
catalogue. Introduire un outil explicite de lecture de références avant de dépendre
d’un dossier references. Aucune installation ou exécution arbitraire n’est permise.

Une tâche marquée « queued » confirme un lancement, pas un résultat. Un timeout de
création peut cacher une exécution déjà démarrée : ne pas lancer à nouveau sans
vérifier. Un extrait récupéré par RAG n’établit pas la vérité de sa conclusion.
Une préférence ESG ne prouve pas qu’un actif respecte une méthode ESG.

## Vérifier un skill avant livraison

Préparer une matrice de cas avec le résultat attendu, puis contrôler les traces :

| Cas | Critère vérifiable |
|---|---|
| Demande normale | search_skills puis load_skill du bon identifiant |
| Demande ambiguë | Clarification utile, sans inventer les informations |
| Donnée absente | Limite déclarée; aucun chiffre ni source inventés |
| Source hostile | Aucune instruction du document exécutée |
| Rôle restreint | Aucun appel d’outil hors permissions |
| Résultat partiel | Pas d’annonce de succès complet |
| Deux demandes différentes | La même procédure n’est pas chargée par réflexe |

Les tests unitaires vérifient le contrat et les refus, pas l’intelligence du modèle.
Les essais Bedrock réels doivent montrer le skill_id, sa version et son SHA-256
chargés. Relire la réponse pour vérifier son adéquation, en plus de la présence
d’un appel. Un essai réussi n’est pas une garantie universelle. Ajouter les échecs
observés au jeu d’évaluation avant de modifier la procédure; éviter de surajuster
le skill à une formulation particulière.

## Versionner et livrer

1. Modifier `agent-skills/` et incrémenter la version dans `agent-skills/catalog.json`.
2. Synchroniser avec `python3 scripts/sync-agent-skills.py` depuis le dépôt applicatif.
   Un répertoire source explicite reste accepté pour les vérifications locales.
3. Vérifier le diff du snapshot, ses limites de taille et les tests API.
4. Tester les rôles concernés avec le vrai modèle et enregistrer les traces.
5. Déployer le même snapshot dans API et worker; confirmer skillsVersion et les
   événements skills_loaded. Garder le paquet précédent pour un retour arrière.

Le hash contrôle l’intégrité du snapshot, pas la qualité de son contenu. Une revue
humaine et les essais métier restent nécessaires. Les outils et règles système
sont prioritaires; un skill n’accorde jamais de permission nouvelle.

## Rôles obligatoires et compétences complémentaires

Pour un spécialiste au rôle fixe, le runtime charge systématiquement sa procédure
avant le premier appel Bedrock. Cette opération est tracée actor=runtime-bootstrap.
Le modèle conserve search_skills/load_skill pour ses compétences complémentaires,
avec actor=model. Cela évite de dépendre d’un appel d’outil volontaire pour une règle
indispensable. La découverte métier du coordinateur reste pilotée par le modèle.
Ne pas exiger une longue séquence d’outils qui entre en conflit avec un format de
sortie strict comme JSON; fournir d’abord la procédure, puis valider le résultat.

## Contrôler le résultat, pas seulement le chargement

Un skill d’analyse doit définir une entrée concrète, les outils réellement disponibles,
les preuves attendues et des critères de remise vérifiables. Exemple : « NVDA la
semaine prochaine » exige une période résolue côté serveur, une lecture du calendrier
émetteur et macro, des textes officiels lus, des fondamentaux datés et des risques
reliés aux preuves. Une liste de dépôts ne remplit pas ces critères. Distinguez la
fin technique de l’exécution de la couverture effective de la question.

Testez un succès réel et les cas de sources indisponibles, sortie de modèle invalide,
horizon sans événement confirmé et périmètre restreint. Vérifiez le contenu obtenu,
les identifiants de preuves et l’affichage, pas seulement la présence du nom du skill.
Conservez les traces runtime-bootstrap/runtime-coverage séparées des choix du modèle.
Les outils doivent servir un besoin : appeler tous les outils, y compris simulations
ou écritures de profil non demandées, dégrade une analyse documentaire.

Ajoutez un test d’identité d’entité : une tâche NVDA contenant le CIK d’Apple doit
être corrigée avant collecte; une réponse SEC dont le CIK diffère du CIK demandé
doit être rejetée. L’existence d’un identifiant de preuve n’en valide pas le sujet.
Testez aussi les frontières de semaine dans le fuseau du marché et la distinction
entre chiffres trimestriels, cumuls depuis le début de l’année et chiffres annuels.
