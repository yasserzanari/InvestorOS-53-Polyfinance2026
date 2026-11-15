---
name: analysis-planning
description: Clarifier l’objectif, sélectionner un parcours InvestorOS et proposer un plan d’analyse sourcé adapté au cas d’usage, avec peu de questions.
---

# analysis-planning

Transforme la demande en question d’analyse claire avant une collecte importante. Comprends ce que la personne veut apprendre ou décider, et propose un périmètre cohérent avec les outils et les sources réellement disponibles. Ne transforme pas chaque demande en rapport standard.

## Choisir le parcours

Charge ce skill et les skills spécialisés réellement utiles. `available_tools` et le catalogue de sources de la session priment sur toute description : un outil absent ou une donnée non couverte est une limite, jamais un résultat à simuler.

| Intention | Skill de parcours | Garde-fou central |
|---|---|---|
| Modèle d’affaires, fondamentaux, risques d’un émetteur; événements à venir | `company-analysis` | Faits d’entreprise et annonces datées; pas de prévision du cours ni de recommandation. |
| Déclaration, nouvelle ou controverse | `evidence-review`, puis `company-analysis` si l’enquête porte sur un émetteur | Attribuer l’affirmation, vérifier les sources primaires et distinguer preuve de déclaration. |
| Rendement ou mouvement déjà observé | `historical-market`; `evidence-review` pour une cause alléguée | Série configurée et fenêtre réelle; la proximité temporelle ne prouve pas la causalité. |
| Pourquoi un titre a fortement monté ou baissé | `market-movement-investigation` pour un mouvement historique confirmé dans un dossier existant | Comparer les mêmes séances, dates de publication et documents lus; une piste de presse ou une proximité temporelle n’établit pas la cause. |
| Poids, concentration, diversification ou objectif personnel | `portfolio-exposures`; `investor-profile` si une inconnue change l’interprétation | Portefeuille fictif et expositions retournées; une catégorie ne révèle pas ses actifs sous-jacents. |
| Choc hypothétique explicite | `conditional-scenarios` | Garder les chocs, jalons, unités et horizon choisis; calcul conditionnel seulement. |
| Trajectoire statistique sans choc | `conditional-scenarios` | Estimation historique bornée, ni prévision ni probabilité. |
| Fournisseur ou dépendance documentée | `supply-chain` | Relations sourcées; ne pas inférer criticité, poids ou perte. |
| Capacités ou limites de la plateforme | `platform-capabilities` | Répondre depuis les outils et données configurés, sans lancer d’analyse d’actif. |
| ESG, crypto ou donnée spécialisée | `platform-capabilities`, puis `company-analysis`/`evidence-review` si l’objet est précis | Vérifier critère, mesure et couverture; une préférence n’est pas un score ou une conformité. |

N’appelle que les outils utiles aux sous-questions retenues. Une recherche documentaire n’autorise pas une simulation par défaut; un historique n’établit ni adéquation personnelle ni conseil.

## Comprendre sans multiplier les questions

1. Résume mentalement le but en une phrase : « comprendre quoi, sur quel objet, pour quelle période et pour quel usage ? »
2. Réutilise le dernier message, l’historique et le profil. Une déclaration déjà faite est une réponse, même si le profil est vide; ne demande pas de la confirmer.
3. Pose une question uniquement si des réponses différentes changeraient le parcours, les sources, la méthode ou le sens du résultat. Par défaut, pose zéro ou une question groupée; ne dépasse pas trois questions au total pour cadrer la demande. Réutilise chaque réponse et ne relance pas un questionnaire au tour suivant pour compléter le profil. Si l’inconnue n’empêche pas une recherche valable, garde-la visible comme limite du plan.
4. Si une hypothèse raisonnable permet d’avancer, annonce-la dans le périmètre proposé et laisse la personne la corriger. Ne demande pas ce qu’un outil peut mesurer.

Repères : « analyse NVDA pour la semaine prochaine » contient cible et période; demande l’angle uniquement s’il modifie la collecte, sinon propose une veille équilibrée. « Est-ce un bon moment pour investir ? » ne dit pas si la personne cherche les fondamentaux, un événement ou l’effet sur son portefeuille : clarifie ce choix sans conseiller. « Simule une baisse » exige un choc et un horizon; demande seulement ce qui manque.

## Squelette d’un bon plan

Pour une collecte documentaire importante, affiche un aperçu modifiable de **trois à cinq étapes** (au plus six). Chaque étape répond à la question; retire les axes décoratifs. Le plan visible est un contrat de périmètre, pas des requêtes internes ni une chaîne de pensée.

1. **Question et périmètre** : cible, période, objectif ou comparaison.
2. **Preuves et méthode** : types de sources autorisées et vérifications/mesures qu’elles permettent.
3. **Analyse et contrepoints** : facteurs favorables, défavorables, risques ou autre explication utile.
4. **Restitution et limites** : résultat attendu, couverture possible et données manquantes.

En général, quatre étapes suffisent. Donne les sources par type utile (dépôt réglementaire, calendrier officiel, série historique), sans inventer de couverture ni afficher l’inventaire technique. Le catalogue `source_ids` de la session est la limite : ne promets pas une recherche web libre ou une donnée seulement parce qu’elle existe publiquement.

### Axes selon le cas

- **Entreprise / fondamentaux** : modèle d’affaires et moteurs; revenus, marges, trésorerie et bilan sur des périodes comparables; industrie ou pairs uniquement si le périmètre est comparable; risques et éléments contraires. Pas de valorisation ni recommandation si l’outil ne les calcule pas.
- **Événements à venir** : annonces confirmées dans la fenêtre, dates et sources primaires; facteur macro seulement s’il change l’analyse; séparer confirmé, attendu et inconnu. Ne pas anticiper résultats ou cours.
- **Nouvelle / controverse** : auteur, date, affirmation; vérification primaire quand possible; preuves contraires; éléments non vérifiés.
- **Historique** : actif, événement et fenêtre; observations effectivement retournées; nouvelles concurrentes; conclusion descriptive, sans causalité inventée.
- **Mouvement observé** : variation confirmée entre deux clôtures, comparaison aux références disponibles sur les mêmes séances, documents lus et antérieurs à la clôture; séparer les pistes d’actualité de leurs vérifications. Ce suivi exploite un dossier existant et ne justifie pas un nouveau plan de recherche par défaut.
- **Profil / portefeuille** : objectif et horizon concernés; expositions réelles du portefeuille fictif; contraintes explicites de risque, perte et liquidité; tensions et inconnues. Aucun avant/après chiffré sans poids et financement explicites.
- **Scénario** : actif/portefeuille, chocs, jalons, horizon et unités donnés par la personne; calcul conditionnel et limites du modèle. Aucun choc dérivé d’une actualité.
- **Chaîne d’approvisionnement** : entreprise, niveau de chaîne et enjeu; relations prouvées seulement; limites géographiques et de couverture.
- **ESG / mesure spécialisée** : critère si cela change la recherche; matérialité, période, méthode, comparabilité et couverture; pas de score global tiré d’une préférence ou d’un indicateur isolé.

### Adapter le plan au contexte déclaré

- Si la personne veut **diversifier** et accepte les fluctuations, examiner d’abord la concentration et les chevauchements réellement observables. Une tolérance élevée n’est pas une demande de risque supplémentaire et ne prouve pas la diversification.
- Si elle donne des **critères ESG ou personnels**, demander lesquels seulement s’ils ne sont pas déjà exprimés et changent les sources. Vérifier les preuves pour le critère concerné; distinguer préférence, politique déclarée et résultat vérifié.
- Si l’objectif a un **horizon court** et que l’actualité suscite une décision, séparer l’échéance et le besoin de liquidité des réactions médiatiques. Attribuer les affirmations et privilégier la confirmation primaire; ne pas assimiler le bruit médiatique à une prévision.

Ces exemples personnalisent les priorités, pas les observations de marché. Le profil influence les questions et compromis, jamais les cours constatés.

## Sources et qualité d’analyste

Hiérarchise les sources primaires réellement autorisées : dépôts réglementaires et documents de l’émetteur pour les faits d’entreprise; calendriers officiels pour les annonces; séries déterministes pour les cours; médias ou publications autorisés pour le contexte. Vérifie entité, date, période, unité et périmètre avant de comparer. Un extrait RAG prouve seulement qu’un passage a été récupéré; un post X reste une déclaration attribuée. Pour une conclusion liée à une actualité, exige un document effectivement lu et daté avant l’événement observé. Une piste indexée ne prouve ni son contenu ni sa causalité.

Les bonnes pratiques d’analyse donnent un cadre, pas une liste de tâches obligatoire : partir de la question, collecter et comparer des entrées pertinentes, interpréter les résultats, confronter les explications et communiquer les limites. Pour une entreprise, examiner le modèle d’affaires, ses moteurs, les résultats et la position financière ainsi que les risques lorsque les preuves le permettent. N’affirme pas avoir analysé marges, flux de trésorerie, pairs ou valorisation si les outils ne retournent pas ces données. Pour ESG, sélectionne les facteurs matériellement pertinents et indique la qualité et la comparabilité de leur couverture. Pour une demande liée à la personne, distingue objectifs par projet, horizons, tolérance, capacité financière à subir une perte, liquidité et préférences explicites; laisse les inconnues visibles.

Références de méthode, non preuves sur le cas : [CFA Institute — Company Analysis](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/company-analysis-past-and-present), [CFA Institute — Equity Research Report Essentials](https://www.cfainstitute.org/sites/default/files/-/media/documents/support/research-challenge/challenge/rc-equity-research-report-essentials.pdf), [CFA Institute — ESG Integration](https://rpc.cfainstitute.org/research/reports/2023/guidance-for-integrating-esg-information-into-equity-analysis-and-research-reports), [Investor.gov — Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation) et [FINRA — Know Your Risk Tolerance](https://www.finra.org/investors/investing/investing-basics/know-your-risk-tolerance).

## Validation et restitution

Après le plan visible, demande l’accord avant `start_analysis` avec `ask_user`, `purpose: "plan_approval"`, une question `single_choice` et les libellés exacts « Oui, lancer ce plan » et « Modifier le plan ». Si la personne veut un changement, ajuste les axes touchés, réaffiche le plan et redemande l’accord. « Lance sans autre question » valide le périmètre déjà formulé.

N’impose pas ce sas aux questions factuelles, calculs immédiats, scénarios complets, lectures historiques ciblées ou questions générales sur les capacités. Après lancement, contrôle état, couverture, preuves, périodes et contradictions : la fin technique ne prouve pas que la question est couverte. À la remise, distingue faits, interprétations et hypothèses, cite les preuves retournées et explique les inconnues. Ne prétends pas qu’un plan est une analyse terminée, ne révèle pas de raisonnement privé et ne donne pas de conseil d’achat/vente.
