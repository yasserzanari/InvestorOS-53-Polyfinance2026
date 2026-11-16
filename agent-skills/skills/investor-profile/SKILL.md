---
name: investor-profile
description: Clarifier un profil investisseur, ses objectifs, horizon, liquidité, connaissances et capacité de perte.
---

# investor-profile

Commence par lire le profil actif et les faits déjà déclarés. Demande seulement les inconnues pertinentes via ask_user : single_choice pour un niveau de connaissances, multiple_choice pour des préférences compatibles, text pour les conséquences financières d’une perte. Un oui à une question ouverte ne décrit pas la capacité financière. Ne déduis rien de l’âge. Après réponse, update_profile ne conserve que les faits explicites. Distingue tolérance émotionnelle et capacité financière. N’annonce pas un profil complet si des champs restent ambigus.

## Vues et mémoire

Le profil déjà renseigné dans le contexte est réutilisable entre conversations du même persona. Enregistrer chaque précision explicite via update_profile avant la clarification suivante. Pour montrer une tension ou une inconnue, publier une carte avec publish_profile_insight et ouvrir alignment. Pour une comparaison historique indépendante, compare_profile_instruments peut avancer sans exiger toutes les rubriques personnelles. La personne confirme elle-même ses réponses dans la fiche.

Une forte tolérance émotionnelle et une faible capacité financière appellent une explication des deux dimensions, sans réécrire la déclaration pour les faire coïncider. Un projet essentiel à 18 mois et l'absence d'emprunt sont des contraintes compatibles; ne prétends pas à une difficulté de financement sans montant ou déficit déclaré. Les pistes de discussion respectent les contraintes du projet.

## Contrat des paramètres détaillés (1.9)

Avant une correction détaillée, appeler `get_profile_details`. Le résultat est la référence, jamais une ancienne phrase de l’historique. Ne pas utiliser `upsert_tab` pour `profile-objectives` ou `profile-controls`.

- `update_profile` : objectif général, horizon, tolérance, capacité de perte, besoins de liquidité, contraintes, connaissances et précisions de préférences. Préserver les nuances qualitatives. Conserver une plage ou une réponse qualitative dans horizonLabel, avec horizonYears null et aucune date inventée.
- `update_profile_goals` : patch des projets par identifiant stable (maximum huit au total), chacun avec id stable, title, description, horizonYears (1–50, ou null si non quantifié), horizonLabel pour les plages qualitatives, role Principal ou Secondaire, targetAmount facultatif et targetDate uniquement si explicitement fournie. Au plus un Principal. Lire l’état puis réutiliser les identifiants. Les autres projets sont conservés automatiquement; deleteIds ne doit contenir que les projets dont la suppression est explicitement demandée. Le principal synchronise l’objectif et l’horizon de l’aperçu. L’année de référence est conservée; une échéance indicative n’est pas une promesse.
- `update_profile_situation` : patch partiel de incomeRange, liquidities, financialAssets, obligations, personalContext. Ces champs sont facultatifs dans le prototype; ne demander que ce qui sert l’objectif et accepter le refus. Pas de numéro de compte, identité officielle, mot de passe, NAS ou pièce justificative. Données fictives uniquement dans la démo.
- `update_profile_controls` : patch partiel. Clés `available`, `minimum`, `complexity`, `learning`, `esg`, `favoured`, `excluded`, `experience-<produit>`, `years-<produit>`. Produits exacts : Actions, Obligations, Fonds (OPC), ETF (trackers), Crypto-actifs, Options. Utiliser les valeurs autorisées par le schéma. Les secteurs sont séparés par `|`; aucun secteur ne doit être inféré. `esg` est l’approche; les précisions restent dans `profile.preferences` et ne doivent pas être écrasées. Horizon/retraits/revenus/dettes ont des propriétaires uniques, pas des valeurs contradictoires dans deux sections.

Après chaque écriture, relire les valeurs retournées. Si l’outil échoue, aucune mise à jour ne doit être annoncée. Le succès de l’outil actualise la fiche; seule la confirmation de mémoire serveur dans l’interface atteste la sauvegarde durable. L’agent ne confirme jamais les réponses à la place de la personne et n’efface pas son profil sans un mécanisme explicite de confirmation.

## Réponse cohérente, principes et cadre juridique

Deux à quatre phrases utiles : ce qui est déclaré et modifié, la limite ou tension importante, puis une question `ask_user` seulement si nécessaire. Ne pas redemander ce qui est déjà connu; ne pas profiler selon l’âge, le genre ou une curiosité pour un actif. Ne pas manipuler les réponses pour justifier un produit risqué. Tolérance émotionnelle et capacité financière sont distinctes; une capacité non chiffrée n’est pas zéro.

Cette démo AlphaForge utilise les personas fictifs Amira (croissance longue, technologies/crypto, diversification), Mateo (équilibre, risque modéré, ESG explicite), Robert (préservation, horizon plus court). Ne pas remplacer leurs déclarations par des stéréotypes ni inventer revenu, capital, seuil de perte ou projet immobilier. Les chiffres financiers doivent provenir de calculs déterministes et d’entrées traçables. Distinguer observation, hypothèse, déclaration, donnée manquante et simulation. Une corrélation ne démontre pas une causalité; aucun rendement futur n’est garanti. Une préférence ESG n’atteste pas la qualité ESG d’un émetteur. Pas de transaction réelle.

La situation est facultative pour parcourir ce prototype : cela ne dispense pas les personnes inscrites de leurs obligations de connaissance du client et de convenance selon l’activité réelle. Un questionnaire seul n’établit pas la convenance. Ne jamais affirmer que le produit est certifié par l’AMF ou conforme à toutes les lois. Pour une décision réelle, rappeler le rôle d’un représentant autorisé si pertinent, sans ajouter un long avertissement à chaque échange.

Sources officielles de ce cadre (consultées le 16 novembre 2026) :
- AMF, profil d’investisseur : https://lautorite.qc.ca/grand-public/outils-et-calculateurs/calculateurs/votre-profil-dinvestisseur
- OCRI, connaissance du client et évaluation de la convenance : https://www.ocri.ca/salle-de-presse/publications/la-connaissance-du-client-et-levaluation-de-la-convenance-pour-la-clientele-de-detail
- Québec, Loi sur la protection des renseignements personnels dans le secteur privé, notamment finalité et nécessité de la collecte : https://www.legisquebec.gouv.qc.ca/fr/pdf/lc/P-39.1.pdf

Ces sources fondent les limites et pratiques de la démo; leur citation n’est pas une certification juridique ni un avis personnalisé.

Noms compatibles Bedrock : Fonds (OPC) utilise `experience-fonds-opc` / `years-fonds-opc`; ETF utilise `experience-etf` / `years-etf`. Les noms avec espaces/parenthèses restent réservés au stockage historique de l’interface, pas aux schémas d’outils.
