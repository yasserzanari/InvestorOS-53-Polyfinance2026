# Assistant partagé

`AssistantChatPanel` est la surface de conversation réutilisée par `/app/assistant` et `/app/profiles`. Les deux écrans s’appuient sur `useProfileWorkspace` : les conversations et leurs onglets sont synchronisés par l’API avec le compte de démonstration actif. `/app/assistant` reprend la conversation la plus récente; chaque entrée dans `/app/profiles` ouvre une conversation vide et propose l’historique dans la barre supérieure. Le panneau de travail partagé (Profil, Tâches, Agents, Sources et résultats Simulation) est visible depuis les deux routes; la mémoire de profil reste séparée des conversations.

## Navigation et orchestration

L’entrée **Assistant** apparaît juste après le **Dashboard** dans la navigation. Les suggestions du Dashboard et les actions des modules transmettent leur contexte à `/app/assistant`; la conversation déjà enregistrée pour le compte est reprise, puis le contexte est joint au nouveau message.

L’API décrit les modules connus à Amazon Bedrock. L’assistant peut appeler les outils réellement autorisés par l’API (analyse du portefeuille fictif, calcul conditionnel du scénario lorsque les chocs viennent de l’utilisateur, mise à jour de faits du profil, consultation de spécialistes Bedrock, lecture des notes méthodologiques, questions interactives et suggestions de suivi). Il peut gérer les onglets partagés et y créer une liste de tâches avec des liens vers les modules.

Créer une tâche avec un lien ne signifie pas qu’une action a été exécutée dans le module lié. Les modules qui ne fournissent pas d’outil d’écriture ou d’analyse au backend restent des destinations de relais : l’assistant doit le dire et ne jamais annoncer une opération qu’il n’a pas exécutée. Les données de démonstration restent identifiées comme fictives.

Quand `project_market_scenarios` termine un calcul avec des chocs explicites, son résultat validé est aussi conservé dans un onglet **Trajectoires · TICKER** du même workspace. Cet onglet rend les branches, leurs fourchettes de quantiles, le cours de départ, la date d’arrêt, la méthode, les limites et les liens source/module. Le résultat peut être rouvert depuis Assistant ou Profils; il est remplacé par le calcul suivant du même ticker et est synchronisé avec le compte de démonstration côté serveur.

## Stockage

- Clé de conversation : `investoros.workspace.v2.<accountId>`.
- Clé de sélection partagée : `investoros.workspace.active-tab.v2.<accountId>`.
- Les anciennes clés de sélection propres à chaque écran sont lues en secours, puis remplacées par la clé partagée au prochain changement d’onglet.
- Les conversations et comptes ne sont pas envoyés à une base de données persistante; la conversation est transmise à Bedrock au fil des demandes depuis l’API.
