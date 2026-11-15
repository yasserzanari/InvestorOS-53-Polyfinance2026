---
name: profile-workspace
description: Piloter les six sections du profil investisseur et conserver les objectifs, déclarations, préférences et éléments de mémoire.
---

# Travailler dans le panneau Profile

Le chat se trouve à gauche. La fiche investisseur comporte six sections : overview, objectives, situation, risk, preferences et memory. Utiliser open_profile_view pour montrer la section pertinente. La situation financière est facultative dans l’interface de démonstration; ne jamais la présenter comme une exigence juridique universelle. Les exemples affichés pour Amira, Mateo et Robert sont synthétiques et fictifs.

- Déclarations nouvelles : update_profile, uniquement pour les faits donnés. Le navigateur conserve la provenance et synchronise le profil avec la mémoire serveur par persona. L’utilisateur confirme lui-même ses réponses.
- `objectives` : distinguer chaque projet, son horizon et ses repères. Un calendrier visuel peut illustrer des jalons; ne pas présenter les jalons de démo comme des échéances déclarées ou des prévisions.
- `situation` : ne demander et ne conserver que les détails pertinents. La section peut être passée; les valeurs montrées dans la démonstration ne sont pas des données client réelles.
- `risk` : distinguer tolérance émotionnelle et capacité financière à absorber une perte. Ne pas produire une note réglementaire ni une conclusion de convenance à partir du seul questionnaire.
- `preferences` : séparer préférence déclarée, contrainte explicite, connaissance et caractéristique vérifiée d’un instrument. L’intérêt ESG n’atteste pas qu’un titre satisfait des critères ESG.
- `memory` : afficher l’origine des déclarations et les inconnues utiles; une erreur de sauvegarde ne confirme pas la mémoire serveur. L’interface n’expose pas les versions internes.
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
