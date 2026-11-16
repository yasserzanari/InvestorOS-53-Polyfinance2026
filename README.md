# InvestorOS

InvestorOS est un prototype d’aide à la décision d’investissement réalisé pour le Datathon Polyfinance 2026. Il relie un profil investisseur fictif, un portefeuille de démonstration, des analyses documentées et des scénarios conditionnels. Il ne passe aucun ordre et ne constitue pas un conseil financier personnalisé.

## Démarrer

Prérequis : Node.js 24, npm et Python 3.12. Pour lancer l’interface et l’API locales :

```bash
npm ci
npm run dev:local
```

Le guide détaillé est dans [la documentation de développement](docs/development/local-setup.md). Les secrets et identifiants AWS restent côté serveur; ne les placez jamais dans le navigateur.

## Comprendre le dépôt

- [Architecture et flux de code](docs/architecture/codebase.md)
- [Architecture d’exécution et déploiement AWS](docs/architecture/runtime-and-deployment.md)
- [Index de toute la documentation](docs/README.md)

Les capacités présentes dans le code, configurées dans Terraform, déployées dans AWS et vérifiées de bout en bout sont des états différents. Consultez [l’alignement hackathon](docs/product/hackathon-alignment.md) et le README de l’environnement Terraform concerné avant de conclure qu’une intégration est opérationnelle.
