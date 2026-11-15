# Dashboard InvestorOS

`DashboardPage` est la vue d’accueil de `/app`. Elle lit l’aperçu du compte de démonstration actif depuis l’API AWS, met en avant les notifications et présente les ressources de la plateforme. Les valeurs de portefeuille proviennent des fixtures fictives DynamoDB et restent identifiées comme telles; le Dashboard ne calcule ni rendement historique, ni volatilité, ni alerte de risque.

La vue d’ensemble consacre maintenant son panneau principal à l’activité du compte : enregistrements d’analyse lus dans `/v1/demo/overview` et nouvelles de Simulation seulement pour les tickers explicitement fournis par une position. Les catégories génériques des portefeuilles de démonstration ne sont pas converties en actions. Si l’API ou les tickers manquent, le panneau explique l’état sans générer d’événements fictifs. La carte de diversification est un treemap dont la surface représente le poids déclaré de chaque position; elle ne code aucune variation de marché. Les compteurs de profils et d’espaces décrivent les options de démonstration disponibles, pas l’activité des utilisateurs.

## Données et états

`loadDemoOverview(persona)` distingue les états `connected`, `not_configured`, `rate_limited` et `unavailable`. La page lui transmet l’identifiant du persona sélectionné. Lorsque l’API est accessible, elle utilise le profil, les positions et les analyses reçus pour afficher le résumé et adapter les suggestions. Si la lecture échoue ou si le service n’est pas configuré, elle montre un état explicite et ne remplace pas les données par des chiffres simulés. Les positions descriptives ne sont pas liées à des tickers de Simulation sans correspondance fournie.

Le Dashboard est un point de départ, pas un écran d’exécution pour chaque module. Analyses lit les enregistrements fictifs disponibles dans DynamoDB, sans créer de nouvelles lignes. Réseaux sert de registre local de relations et de preuves saisies par l’utilisateur; aucun lien fournisseur n’est prérempli ni vérifié par le système. Sources et méthode documente les fournisseurs utilisés et charge le statut du jeu Simulation; cette page n’affirme pas que chaque fournisseur est disponible pour chaque titre.

## Saisie et continuité du chat

`DashboardPrompt` permet d’écrire ou de dicter une demande. Entrée l’envoie et Maj+Entrée ajoute une ligne. Les suggestions se recalculent selon le texte et l’état réel de l’aperçu API; les sélectionner préremplit le prompt sans l’envoyer. La reconnaissance vocale dépend des capacités et permissions du navigateur; le texte reste modifiable avant envoi.

L’envoi ouvre `/app/assistant` avec le texte de départ. La route utilise le même workspace par compte que `/app/profiles` : l’Assistant reprend la conversation et les onglets existants, puis transmet la demande au backend Bedrock. La réponse, les questions interactives, les outils et leurs sources n’apparaissent qu’à partir des événements réellement reçus de l’API. Une indisponibilité de Bedrock est montrée comme une erreur, sans réponse d’agent fabriquée.

## Modules et navigation

La navigation latérale est dérivée du catalogue `productModules`. Pour ajouter un module, renseigner son libellé, son icône, son groupe et sa route dans `apps/web/src/app/modules.tsx`, puis enregistrer une page dédiée dans `apps/web/src/app/App.tsx` lorsqu’il possède un flux de travail. Les écrans Analyses, Réseaux et Sources et méthode sont décrits dans leurs README respectifs. Un lien ou une tâche d’Assistant vers un module est un relais de navigation; il ne constitue pas à lui seul une opération dans ce module.

## Présentation des preuves

Les résumés du Dashboard doivent conserver l’origine et le statut des données. Ne pas transformer une position illustrative en actif coté, ni une étape suggérée en action accomplie. Les méthodes, événements historiques et hypothèses de trajectoire appartiennent au module Simulation, où les sources et les limites sont affichées à proximité des résultats.
