# Environnement dev

Point d’entrée Terraform isolé pour le développement. Ce premier commit configure la région et les conventions; il ne crée encore aucune ressource AWS. Les modules seront raccordés en étapes séparées après validation de l’accès IAM, des modèles Bedrock et des quotas.

Avant déploiement, configurer un backend Terraform distant chiffré avec verrouillage dans le compte du projet. Ne pas utiliser ni committer un state local partagé.
