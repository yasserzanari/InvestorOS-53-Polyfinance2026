# Parcours de démonstration : profils, preuves et simulation

Ce guide relie les trois profils de démonstration aux capacités qui existent dans InvestorOS. Il sert de scénario de présentation et de contrat de contenu : les demandes sont des exemples modifiables, et le produit doit continuer à accepter d’autres actifs, événements, hypothèses et profils.

## Besoin produit à montrer

La valeur agentique n’est pas de faire parler plusieurs agents. Elle est d’aider une personne à passer d’une question à une décision mieux cadrée : charger le contexte du compte choisi, détecter les inconnues ou tensions, demander une précision, appeler les opérations disponibles, puis organiser le résultat en onglets partagés. Les chiffres restent calculés par le backend; l’Assistant explique les résultats et leurs limites.

Le parcours peut commencer dans Assistant ou dans un module. Les onglets et la conversation du compte actif sont partagés entre Assistant et Profils. Simulation reste un module de données historiques et de scénarios explicites : l’utilisateur peut y ouvrir un événement ou un dépôt, consulter sa source, puis envoyer le contexte sélectionné à l’Assistant.

## Règles communes de démonstration

- Utiliser le sélecteur de compte pour choisir le persona et vérifier que l’API charge sa fixture de portefeuille.
- Afficher les valeurs du portefeuille comme données fictives. Ne jamais relier un libellé descriptif à un ticker sans correspondance fournie.
- Distinguer donnée observée, déclaration du persona, calcul déterministe, hypothèse saisie et information inconnue.
- Quand une réponse manque ou se contredit, utiliser `ask_user`; ne pas fabriquer une réponse depuis l’âge ou le nom du persona.
- Les outils, sources et onglets affichés doivent correspondre aux appels et résultats réels du tour. Les sources sont ouvrables; les follow-ups sont des actions qui envoient réellement leur texte.
- Simulation n’utilise pas de posts X. Aucun accès officiel gratuit et autorisé à X n’est configuré. Les dépôts SEC, actes du Federal Register, historiques du jeu local et résultats GDELT disponibles sont des sources distinctes, avec leurs limites.
- Un rendement après un événement est une comparaison temporelle, pas son impact causal. Si le jeu n’a pas de prix après la date, afficher « indisponible ».

## Amira — croissance diversifiée, IA et crypto

### Demande à jouer

> Je veux profiter de l’IA et de la crypto sans mettre tout mon portefeuille dans le même risque. Qu’est-ce qui est déjà concentré?

### Travail et présentation attendus

1. Le compte Amira charge le portefeuille fictif via l’outil backend de portefeuille; l’Assistant ne déduit pas un portefeuille depuis le texte.
2. Le calcul montre les lignes fournies : technologie/IA 35 %, actions mondiales 30 %, crypto-actifs 10 %, obligations 15 %, liquidités 10 %. Les deux lignes explicitement nommées technologie/IA et crypto totalisent 45 % du portefeuille fictif.
3. Le résultat est présenté dans la conversation avec le calcul et ses entrées, puis dans l’onglet de travail si le tour en crée un. Chaque valeur se rapporte à la fixture et reste modifiable par l’utilisateur.
4. Le follow-up demande si Amira veut d’abord limiter l’ampleur d’une baisse, conserver une exposition de croissance ou préciser ses besoins de liquidité. Une réponse libre reste une réponse libre jusqu’à confirmation.
5. Simulation n’est proposée qu’après sélection d’un titre présent dans son propre univers de données et ne prétend pas que celui-ci est dans le portefeuille Amira.

### Réponse honnête à faire voir

« Dans la fixture, 35 % sont étiquetés technologie/IA et 10 % crypto, soit 45 % entre ces deux lignes. Ce calcul ne révèle pas les expositions internes des fonds mondiaux ni les corrélations entre positions. Je ne connais pas encore la perte que vous pourriez absorber ni votre besoin de liquidité. »

### Limite de la démonstration

Les positions n’ont pas de séries de prix liées. L’Assistant peut faire des calculs arithmétiques sur les poids disponibles, mais pas calculer une volatilité historique, une corrélation ou une perte maximale de ce portefeuille.

## Mateo — croissance équilibrée et critères ESG

### Demande à jouer

> Est-ce que mon portefeuille respecte mes critères ESG et est-ce qu’il est assez diversifié?

### Travail et présentation attendus

1. L’outil backend charge les quatre lignes de la fixture Mateo : actions mondiales 40 %, obligations diversifiées 25 %, actions canadiennes 20 %, liquidités 15 %.
2. L’Assistant peut calculer la concentration des lignes qui sont effectivement fournies. Il ne présente pas ce calcul comme une mesure d’exposition sous-jacente.
3. `ask_user` demande quels critères Mateo veut appliquer : exclusions, climat, normes, controverses ou autre; il peut préciser une méthode ou un univers de référence.
4. La réponse distingue l’absence de composition des fonds et l’absence de données ESG d’une conclusion négative ou positive. Les sources de méthode éventuelles restent séparées des preuves sur les titres détenus.
5. Un onglet de tâches peut lister les éléments réellement manquants : compositions, méthode ESG choisie et date de référence. Chaque action vers un module ouvre ce module.

### Réponse honnête à faire voir

« Je peux comparer les quatre pondérations déclarées et leur concentration. Je ne peux pas vérifier l’exposition ESG ni le chevauchement interne des fonds sans leur composition et une méthode datée. Quels critères souhaitez-vous utiliser? »

### Limite de la démonstration

Aucun score ESG ni classement d’entreprise n’est fourni par le jeu de données. Une préférence de Mateo ne constitue pas une preuve de conformité ESG.

## Robert — préservation du capital et titre médiatisé

### Demande à jouer

> Le titre dont tout le monde parle monte vite. Est-ce que je devrais en ajouter beaucoup à mon portefeuille?

### Travail et présentation attendus

1. L’Assistant rappelle le contexte déclaré de Robert : préservation, horizon de 3 à 5 ans, risque faible à modéré.
2. L’outil charge la fixture, où une ligne de 10 % est décrite comme très volatile. Cette ligne est illustrative; elle n’a ni ticker ni historique associé.
3. L’Assistant repère la tension entre l’objectif et l’augmentation envisagée, sans émettre d’ordre d’achat/vente ni prétendre connaître le titre.
4. `ask_user` pose une question développée : quelle baisse aurait des conséquences concrètes, et quand l’argent pourrait-il être nécessaire? Les champs de tolérance et de capacité à absorber une perte restent distincts.
5. Après réponse, l’Assistant peut créer des tâches pour préciser la position, son horizon et la source de prix. Il ne lance pas une simulation de cours sur un titre non identifié.

### Réponse honnête à faire voir

« Votre profil indique un objectif de préservation et un horizon de 3 à 5 ans. La fixture comporte une ligne illustrative de 10 % décrite comme très volatile, mais elle ne donne ni ticker ni cours; je ne peux donc pas mesurer son risque de marché. Avant de comparer des hypothèses, quelle baisse pourrait compromettre vos projets et quand pourriez-vous avoir besoin de cet argent? »

### Limite de la démonstration

Les pourcentages de choc choisis dans une simulation de portefeuille sont des hypothèses saisies, pas des pertes attendues. Pour comparer des rendements historiques, il faut un actif réellement identifié et des données couvrant la période étudiée.

## Démonstration du module Simulation

1. Choisir un actif dans l’univers chargé par l’API. Le graphique indique le paquet de prix, la date de fin, la devise et les limites.
2. Choisir un événement d’entreprise, un acte réglementaire ou un dépôt SEC. Les marqueurs et la liste latérale sélectionnent la même preuve; les sources officielles s’ouvrent dans un nouvel onglet.
3. Lire les rendements après date uniquement pour les séances présentes dans le jeu. Ils ne sont pas attribués à l’événement.
4. Comparer deux à quatre branches en saisissant soi-même le libellé du scénario, l’amplitude du choc et son jalon. Le moteur applique ces hypothèses aux quantiles de fenêtres historiques du même actif.
5. Lire les hypothèses et limites à côté du résultat : les quantiles marginaux ne sont pas des trajectoires conjointes, des probabilités, ni une prévision.

Les formulaires de scénario sont des champs génériques. Ajouter un nouveau cas d’usage ne doit pas demander d’ajouter une branche dédiée à un persona ou une entreprise.

## Références d’interface

Les références de préparation locales suggèrent une hiérarchie de dossier d’analyse : question et statut, onglets Résumé/Preuves/Scénarios/Activité, résultat explicable, preuves cliquables et événements sur un graphique. Le module Simulation reprend la sélection d’événements et la comparaison de branches avec les données disponibles. Les cartes de réseau fournisseurs et les aperçus navigateur des agents ne sont pas activés ici : les données de fournisseurs et une exécution de navigateur attribuable manquent; l’interface ne doit pas en dessiner de fausses.

Les captures de préparation sont sous `docs/prep/references-visuelles/` sur la machine de développement. Ce répertoire reste local et ignoré par Git selon les règles du dépôt.
