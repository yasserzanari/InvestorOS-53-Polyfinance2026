# InvestorOS API

FastAPI sert le développement local; Mangum expose la même application comme handler Lambda. Les routes de profils, analyses et preuves seront ajoutées dans `src/investoros_api/routes/`; les appels AWS seront isolés dans `services/`.

Le endpoint `/health` est un contrôle de vie local et ne valide pas l’accès aux services AWS. L’invocation réelle Bedrock sera ajoutée après confirmation des permissions du rôle de projet.
