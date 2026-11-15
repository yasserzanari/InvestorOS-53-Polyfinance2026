# Espace Profile interactif

## Fonctionnement

La route `/app/profiles` conserve le chat partagé à gauche. `ProfileWorkbench.tsx` affiche à droite six vues permanentes : Profil, Alignement, Comparer, Scénarios, Preuves et Mémoire. Une vue Documents apparaît lorsqu’un agent crée des notes, tâches, activités ou résultats de recherche. Sur mobile, Conversation et Profil et analyses se présentent dans deux panneaux alternatifs; le chat ne s’empile plus au-dessus d’un long formulaire. Le panneau est redimensionnable et agrandissable.

Profil regroupe les huit rubriques en quatre pages courtes; chaque changement conserve sa provenance, date et version et retire la confirmation. Seule une action de la personne confirme les réponses. Un profil textuellement complet n’est pas une certification de convenance.

Alignement distingue le constat de l’IA, sélectionné par défaut après publication, des tensions et inconnues des règles de champs. Les pistes de la carte reprennent le dialogue avec sa question d’origine; les limites restent consultables. Les champs cités sont éditables par un lien direct. La version des champs utilisée pour une carte est conservée : une modification signale la péremption et désactive ses anciennes pistes jusqu’à actualisation. Les règles reconnaissent aussi les horizons et retraits exprimés en mois, notamment « 18 mois », sans supprimer la prise en compte des négations.

Comparer appelle `POST /v1/profiles/compare`. Les rendements ajustés et replis proviennent des mêmes dates communes et de la même devise. La variabilité est un écart-type échantillonnal non annualisé entre observations communes. La courbe est en base 100; seuls les points affichés sont échantillonnés. Le calcul, ses métriques, méthode, limites et empreinte des entrées restent dans le document. Des devises différentes sont refusées; aucun FX implicite ni volatilité de portefeuille inventée.

Scénarios réutilise les outils de simulation. `ProfileScenario.tsx` propose Synthèse, Paramètres et Méthode; le réglage des branches est compact. Les anciens résultats sont indisponibles si les hypothèses changent, jusqu’au recalcul ou au rétablissement. Le résultat modifié est conservé dans le document. Les centiles restent conditionnels, sans probabilité future annoncée.

## Outils et skills de l’agent

- `compare_profile_instruments` calcule et conserve la comparaison, puis ouvre la vue correspondante.
- `publish_profile_insight` valide une carte liée aux champs explicites du profil; aucune référence de preuve non reçue n’est acceptée.
- `open_profile_view` sélectionne une vue, y compris Documents. `documentId` permet de sélectionner un document existant; les identifiants inconnus sont refusés. Chaque événement est distinct, même si la vue avait déjà été ouverte avant une navigation manuelle. En mode Profile, `upsert_tab` ouvre automatiquement la note créée ou modifiée.
- `close_profile_document` ferme seulement le document demandé, en conservant profil et autres documents. Le bouton de fermeture permet aussi de retirer un scénario volumineux. La dernière fermeture de Documents revient à Profil.
- `update_profile`, `ask_user`, les outils historiques/scénarios et `upsert_tab` restent partagés. Les IDs réservés aux comparaisons et cartes ne peuvent pas être remplacés par une note arbitraire.
- `workspaceMode: profiles` charge les procédures investor-profile et profile-investment-alignment dans le vrai contexte modèle; la trace indique runtime-bootstrap. Le modèle peut découvrir d’autres skills selon la demande. Le skill profile-workspace décrit les commandes et les vues.

Les sources versionnées dans `agent-skills/` et le snapshot embarqué sont synchronisés par `scripts/sync-agent-skills.py`. Au 15 novembre 2026, la version est 1.8.13 avec 19 skills; lire la version courante dans `/v1/profiles/status` et le SHA-256 de chaque chargement. Une demande explicite de calcul ou de création de scénarios lit d’abord les capacités réellement disponibles; elle ne peut aboutir sans résultat calculé. Les demandes de précision sur un scénario reçoivent un intitulé de question contextualisé.

## Mémoire

`useProfileMemory.ts` charge la mémoire serveur avant d’autoriser les éditions et synchronise profil, documents et références de sources après modification. Les références conservées sont bornées aux 80 dernières. Au chargement, la mémoire serveur est la référence pour éviter qu’un ancien onglet du navigateur écrase un document plus récent. Les conversations restent dans le stockage local du navigateur, séparées par persona. Une nouvelle session de navigateur peut restaurer le profil et les documents depuis le serveur, mais ne retrouve pas l’historique local d’un autre navigateur.

`GET/PUT /v1/profiles/memory/{amira|mateo|robert}` utilise une révision optimiste. Un conflit 409 bloque l’écrasement et invite à recharger la mémoire. Les données locales ne sont pas présentées comme sauvegardées si la requête échoue.

- Local : SQLite dans `~/.local/share/investoros/profile-memory.sqlite3`, configurable avec `PROFILE_MEMORY_DB`.
- AWS : `PROFILE_WORKSPACE_TABLE`, ou `SOURCE_WORKSPACE_TABLE`, active DynamoDB. Le mapping `DEMO_CONTEXTS` fournit les clés de comptes autorisées côté serveur; seule la propriété `profile_workspace` est modifiée. Les permissions GetItem et UpdateItem sur la table sont nécessaires. Le wrapper API Gateway/Cognito existant protège les routes déployées; le serveur de développement reste local.
- Aucun Terraform global n’a été appliqué pour cette tranche. Le code actuel peut exploiter la table de comptes de la stack assistant-simulation sans nouvelle table.

## Vérifications du 15 novembre 2026

- 50 tests API ciblés : calculs sur dates communes, refus FX, références de preuve, révisions/isolation, conservation finale des scénarios, orchestration/outils/skills et contenu des procédures fourni au modèle.
- 12 tests des règles de cohérence, notamment les négations et les formulations rapportées (« fluctuations élevées », « ne peut pas absorber »).
- TypeScript et build de production vérifiés. Le build conserve un avertissement de taille sur le bundle principal préexistant; il ne démontre pas une performance de réseau public.
- Chrome/Playwright : six vues, comparaison réelle, erreurs de devise, édition et restauration dans une nouvelle session, agrandissement, mobile. À 1440×950, pas de défilement du corps des six vues de référence; les longues preuves et formulaires avancés peuvent défiler dans leur zone.
- Bedrock réel depuis le navigateur : comparaison AAPL/MSFT et ouverture de vue; mise à jour du profil et carte d’alignement avec clarification interactive; deux scénarios AAPL; remplissage des huit champs de Robert et confirmation par clic, conservée après rechargement. Ces observations portent sur le modèle et le contexte de ces essais, sans garantie pour toute formulation future.
- DynamoDB réel via l’adaptateur HTTP : écriture, relecture du profil fictif et refus d’une révision concurrente. Test effectué sur la table de comptes de développement.

Commandes reproductibles :

```sh
npm run typecheck --workspace @investoros/web
npm run build --workspace @investoros/web
PYTHONPATH=apps/api/src:apps/api/tests .venv/profile-api/bin/python -m unittest test_profile_decision test_profile_service test_agent_skills -q
node --test apps/web/src/features/profiles/profile-consistency.test.mjs
node scripts/test-profile-workbench.cjs
node scripts/test-profile-scenario-workbench.cjs
node scripts/test-profile-alignment-workbench.cjs
node scripts/test-assistant-profile-memory.cjs
```

Les essais navigateur supposent le frontend local 5175 et l’API 8010. Les traces et captures des essais réels sont conservées localement dans `docs/prep/profile-workbench-evidence/`, ignoré par Git. Cette tranche décrit du code et des vérifications locales avec appels AWS réels; elle n’atteste pas d’une publication de cette nouvelle interface sur le site public.

## Vérifications complémentaires de l’alignement et de la mémoire

`test-profile-alignment-workbench.cjs` utilise la vraie API de mémoire locale et le navigateur : constat IA distinct des règles, limites consultables, piste transmise au chat, note créée et sélectionnée par événement, preuve liée filtrée, accès au champ, signal de péremption et désactivation des pistes anciennes. La réponse modèle est interceptée dans cet essai pour rendre la navigation reproductible; ce test ne prouve pas une invocation Bedrock. Le navigateur ne présente aucun débordement du panneau ni de la page à 1440×950 sur ce cas. La capture validée est `docs/prep/profile-workbench-evidence/alignement-interactif.png`. Les fixtures sont retirées après l’essai.

`test-assistant-profile-memory.cjs` vérifie qu’une modification dans Assistant produit une seule sauvegarde, en conservant les documents et références partagés. Le mode conversationnel sérialise uniquement le profil pour détecter les changements, ce qui évite une sauvegarde en boucle.

Les 19 maquettes ImageGen et les captures de référence restent dans `docs/prep/ui-imagegen-2026-11-15/`. Elles proposent aussi des évolutions des autres modules : elles ne constituent pas une preuve de leur implémentation dans cette tranche Profile. Le composant sauvegardé 21st.dev « AI Agent Response » a été inspecté : il représente une trace d’exécution technique, sans contrat de fiche d’alignement; les composants et tokens existants sont conservés pour cette fiche.

## Dernier état de session AWS

Les identifiants AWS ont été renouvelés. Une lecture réelle d’une analyse de recherche existante a renvoyé 200 avec l’état complet, 6 preuves et 22 événements. Un appel Bedrock réel pour une demande d’analyse NVDA a toutefois échoué à afficher une question de clarification et a atteint la limite d’opérations; aucun lancement d’analyse (`start_analysis`) n’a eu lieu. Une session AWS valide et une lecture réussie ne prouvent pas que le parcours Bedrock complet fonctionne. Aucun déploiement de cette version n’a été effectué ou confirmé.
