# Workflow d’analyse

`research.asl.json` est la définition ASL du workflow de recherche normalisée depuis AWS. L’ARN du worker est remplacé par le placeholder `${research_worker_arn}`; aucun renderer Terraform ne le consomme dans le code versionné actuel. Les sorties des agents ne remplacent pas les calculs déterministes.

## État AWS vérifié — 15 novembre 2026

- Région : `us-east-1`.
- State machine Standard : `investoros-dev-research`, active; rôle `investoros-dev-research-workflow`.
- Worker appelé par les états `Plan`, `ResearchTasks`, `Synthesize` et `MarkFailed` : Lambda Python 3.12 `investoros-dev-research-worker`.
- La Lambda API `investoros-dev-api` est active et reçoit `RESEARCH_STATE_MACHINE_ARN=arn:aws:states:us-east-1:010928221556:stateMachine:investoros-dev-research` ainsi que les noms des tables de recherche.
- Le state Terraform canonique observé est `s3://investoros-tfstate-010928221556-us-east-1/dev/terraform.tfstate`. Il contient `module.backend.aws_sfn_state_machine.research`, le worker et leurs rôles/policies. Le state ne remplace pas le code Terraform : la configuration actuellement versionnée sous `infrastructure/terraform/modules/backend` ne déclare plus ces ressources. Le tag AWS `ManagedBy=Terraform` ne permet pas de retrouver un autre dépôt de configuration.
- Le README de l’environnement `dev` signale le drift et interdit d’appliquer ce root tant que la configuration n’est pas réconciliée. Ne pas retirer ni importer ces ressources à l’aveugle.

## Vérification de bout en bout observée

Une exécution réelle portant l’identifiant `b4626560-12d6-4c0b-af23-41470896cd54` a terminé dans Step Functions avec `SUCCEEDED` le 15 novembre 2026. DynamoDB contient son enregistrement de run (`status=partial`), 10 événements dont `analysis_completed`, et 1 preuve. Le succès d’orchestration n’implique donc pas une couverture complète : l’API restitue correctement le statut partiel.

La route de démarrage est `POST /v1/research/analyses`; elle demande une question, un persona fictif et une session Cognito administrateur sur l’API AWS. Une exécution appelle Bedrock et des sources distantes, donc elle peut entraîner des frais. Les routes de lecture sont `GET /v1/research/analyses/{analysis_id}`, `/events` et `/evidence`. Une réponse HTTP `202` seule ne prouve pas que le workflow a fini ni que le résultat a été persisté.

Pour vérifier le parcours sur un compte autorisé, fournir l’URL API Gateway et un jeton Cognito valide dans l’environnement du shell, puis lancer :

```bash
export RESEARCH_SMOKE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
read -srp 'Jeton Cognito : ' RESEARCH_SMOKE_BEARER_TOKEN; echo
export RESEARCH_SMOKE_BEARER_TOKEN
python3 scripts/smoke-research-workflow.py
unset RESEARCH_SMOKE_BEARER_TOKEN
```

Le script démarre une seule analyse bornée au jeu AlphaForge, attend un statut `complete` ou `partial`, puis exige un résultat, l’événement `analysis_completed` et au moins une preuve persistée. Ne pas mettre le jeton dans une commande conservée dans l’historique du shell; l’exporter de manière sécurisée. L’analyse utilise le quota quotidien et peut entraîner des frais Bedrock.
