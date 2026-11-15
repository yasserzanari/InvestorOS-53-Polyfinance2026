---
name: profile-workspace
description: Piloter les sous-onglets interactifs du profil investisseur pour structurer une comparaison, une clarification et ses preuves, en conservant le contexte.
---

# Travailler dans le panneau Profile

Le chat se trouve à gauche. Les vues du panneau droit sont profile, alignment, comparison, scenarios, evidence et memory. Utiliser open_profile_view pour ouvrir la vue pertinente, sans annoncer une action effectuée si aucun événement ne la confirme.

- Déclarations nouvelles : update_profile, uniquement pour les faits donnés. Le navigateur conserve la provenance, la version et synchronise le profil avec la mémoire serveur par persona. L’utilisateur confirme lui-même ses réponses.
- Comparaison d’actifs historiques : compare_profile_instruments reçoit deux ou trois tickers et éventuellement startDate/endDate. Le serveur publie automatiquement le document et ouvre comparison. Il fournit rendement, repli, variabilité non annualisée, dates, méthode et courbes. Le texte de l’agent explique les résultats, sans inventer de statistiques.
- Tension/contextualisation : publish_profile_insight produit une carte structurée dans alignment. Résumer le lien entre demande et champs explicites; employer clarification, tension, information ou partial. Les références de preuves doivent réellement avoir été reçues.
- Scénarios conditionnels : les outils de simulation existants publient leurs trajectoires dans scenarios. Ne pas remplacer le résultat par une note narrative. Clarifier les chocs manquants lorsqu’ils sont requis par l’outil.
- Sources : evidence montre les références effectivement reçues et les sources de comparaisons. Une référence n’établit pas la vérité de toute une interprétation.
- Mémoire : memory rend visibles provenance et version; une sauvegarde en erreur n’est pas une mémoire serveur confirmée. Ne pas demander de réinitialiser l’historique pour corriger un manque du profil.

Préférer un résultat court dans le chat et les détails utiles dans la vue. Ne pas créer une longue liste de notes redondantes. Réutiliser les documents dédiés profile-comparison et profile-alignment, qui sont mis à jour. Les rubriques ignorées restent à préciser; un profil complet textuellement n’est pas une preuve de convenance.

Une fermeture explicitement demandée se fait via close_profile_document avec l’id réellement présent dans le contexte. La fermeture ne modifie pas les champs du profil. Ne pas supprimer des documents sans demande pour contourner une limite de capacité; demander lequel fermer ou réutiliser le document approprié. Les scénarios volumineux restent des documents de simulation, pas des notes textuelles.

La vue `documents` peut être ouverte avec `open_profile_view`; fournis `documentId` pour sélectionner une note ou un résultat réellement présent dans le contexte. La création ou mise à jour d’une note par `upsert_tab` ouvre automatiquement Documents en mode Profile et sélectionne ce document. N’invente pas un identifiant et ne remplace pas une carte d’alignement ou une comparaison structurée par une note.

Après les outils, limite le chat final à deux à quatre phrases : le constat important, sa limite et l’action utile dans la vue. Les cartes portent les détails. Ne répète pas les brouillons produits avant une correction d’outil et ne remplace pas le contenu de la carte par une annonce de publication.

Une demande portant uniquement sur une note ne relance aucun ancien calcul du chat. Crée la note, ouvre Documents puis conclus. Ne réexécute pas un scénario à partir de l’historique pendant cette demande documentaire. Après un résultat créé, une réponse textuelle vide peut être remplacée par le résumé validé de la carte ou la confirmation serveur de l’action effectivement terminée; ce remplacement ne génère aucun chiffre ni constat supplémentaire.

Les demandes sur les fournisseurs doivent charger supply-chain puis utiliser inspect_supply_chain. L’outil ouvre un document structuré network avec Graphe/Liste/Pressions/Événements et sélectionne son identifiant dans Documents. Ne recopie pas ces données dans une note; ne demande pas à la personne de construire manuellement le réseau.
