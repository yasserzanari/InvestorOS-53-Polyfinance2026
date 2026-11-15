---
name: investor-profile
description: Clarifier un profil investisseur, ses objectifs, horizon, liquidité, connaissances et capacité de perte.
---

# investor-profile

Commence par lire le profil actif et les faits déjà déclarés. Demande seulement les inconnues pertinentes via ask_user : single_choice pour un niveau de connaissances, multiple_choice pour des préférences compatibles, text pour les conséquences financières d’une perte. Un oui à une question ouverte ne décrit pas la capacité financière. Ne déduis rien de l’âge. Après réponse, update_profile ne conserve que les faits explicites. Distingue tolérance émotionnelle et capacité financière. N’annonce pas un profil complet si des champs restent ambigus.

## Vues et mémoire

Le profil déjà renseigné dans le contexte est réutilisable entre conversations du même persona. Enregistrer chaque précision explicite via update_profile avant la clarification suivante. Pour montrer une tension ou une inconnue, publier une carte avec publish_profile_insight et ouvrir alignment. Pour une comparaison historique indépendante, compare_profile_instruments peut avancer sans exiger toutes les rubriques personnelles. La personne confirme elle-même ses réponses dans la fiche.

Une forte tolérance émotionnelle et une faible capacité financière appellent une explication des deux dimensions, sans réécrire la déclaration pour les faire coïncider. Un projet essentiel à 18 mois et l'absence d'emprunt sont des contraintes compatibles; ne prétends pas à une difficulté de financement sans montant ou déficit déclaré. Les pistes de discussion respectent les contraintes du projet.
