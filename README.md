# InvestorOS

InvestorOS est le projet du Datathon Polyfinance 2026 : une expérience d’aide à la décision d’investissement qui rend visibles les données, les hypothèses et les limites de ses analyses. Le produit cible AWS; les profils et portefeuilles de démonstration sont fictifs et aucune transaction n’est exécutée.

## Démarrer le frontend

```bash
npm ci
npm run dev
```

Le frontend Vite/React est dans `apps/web`. L’API Python est dans `apps/api`. Terraform et les workflows AWS se trouvent dans `infrastructure/terraform` et `services/workflows`.

## Structure

- `apps/web` — interface React + TypeScript + Vite.
- `apps/api` — API Python/FastAPI, adaptateur Lambda et intégrations AWS.
- `services/workflows` — définitions Step Functions pour les analyses.
- `infrastructure/terraform/environments` — environnements déployables (`dev`, `demo`).
- `infrastructure/terraform/modules` — modules AWS réutilisables.
- `data` — contrats et outils de données; fichiers du datathon gardés localement.
- `scripts` — commandes de développement et de déploiement.
- `docs` — notes préparatoires locales, exclues de Git.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour les frontières de composants et le flux d’une analyse.
