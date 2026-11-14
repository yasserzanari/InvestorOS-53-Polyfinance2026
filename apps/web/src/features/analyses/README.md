# Analyses

La route `/app/analyses` lit `GET /v1/demo/overview` pour le persona actif et affiche les enregistrements `analyses` réellement renvoyés par DynamoDB. L’API limite la requête aux 25 enregistrements les plus récents de la partition du compte fictif. La page garde le compte et la provenance de démonstration visibles.

Le payload d’analyse n’a pas de schéma de présentation versionné dans l’API. La vue cherche quelques champs de titre, résumé, statut et date connus; elle conserve un détail JSON replié pour les autres formes de payload sans fabriquer un résumé. Si aucun enregistrement n’existe, le message distingue cet état de l’API indisponible. L’Assistant peut préparer un travail, mais ne prétend pas écrire un nouvel enregistrement dans la table AWS.

Pour ajouter des actions de lecture ou d’écriture, versionner d’abord le modèle d’analyse côté API, valider ses champs et ses limites de compte, puis faire évoluer cette page. Ne pas accepter un `account_id` libre envoyé par le navigateur; les clés de persona restent fixées par le serveur.
