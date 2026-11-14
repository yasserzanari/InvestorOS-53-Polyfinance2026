# Module Portefeuilles

Le module `portfolios` fournit la route `/app/portfolios`. Il présente un modèle de portefeuille fictif sous forme de tableau de décision compact : historique, allocation, rendements mensuels, risque et positions. Les ajustements peuvent être prévisualisés depuis le panneau Positions.

## Arborescence

```text
portfolios/
├── index.ts                         # API publique du module, utilisée par le routeur
├── PortfolioPage.tsx                # Assemblage de la page et liaison des événements
├── components/                      # Présentation, un composant par panneau ou unité visuelle
│   ├── AllocationChart.tsx           # Anneau d’allocation interactif
│   ├── AllocationPanel.tsx           # En-tête et graphique d’allocation
│   ├── HoldingSparkline.tsx          # Tendance compacte d’une position
│   ├── MetricCard.tsx                # Présentation d’un indicateur
│   ├── MonthlyReturnsPanel.tsx       # Tableau thermique des rendements mensuels
│   ├── PortfolioChartPanel.tsx       # Historique de valeur et capital investi
│   ├── PortfolioToolbar.tsx          # Lecture, vitesse, remise à zéro et export
│   ├── PositionInspector.tsx         # Détail de la position sélectionnée
│   ├── PositionsPanel.tsx            # Tableau des positions et cible de répartition
│   └── RiskMetricsPanel.tsx          # Mesures de risque et de rendement
├── charts/
│   └── portfolio-chart/              # Bookmark component library et son adaptateur de rendu
│       ├── PortfolioChart.tsx
│       ├── chart-engine.tsx
│       └── portfolio-chart.css
├── hooks/
│   └── usePortfolioReplay.ts         # État de lecture, sélection, rééquilibrage, export
├── model/
│   └── portfolio-model.ts            # Types, fixture déterministe et calculs
├── styles/
│   └── portfolio.css                 # Styles du module, limités à .portfolio-page
└── utils/
    ├── exportPortfolioCsv.ts         # Export CSV local avec provenance fictive
    └── format.ts                     # Devise, pourcentage, date et périodes de graphique
```

## Où modifier quoi

| Besoin | Fichier propriétaire |
|---|---|
| Réorganiser les panneaux ou connecter leurs callbacks | `PortfolioPage.tsx` |
| Modifier un panneau, un tableau ou une commande | Composant correspondant dans `components/` |
| Changer la génération des cours, les calculs ou les types | `model/portfolio-model.ts` |
| Modifier lecture, pause, vitesse, sélection ou rééquilibrage | `hooks/usePortfolioReplay.ts` |
| Adapter devise, dates, pourcentages ou périodes | `utils/format.ts` |
| Modifier le format du téléchargement | `utils/exportPortfolioCsv.ts` |
| Modifier l’historique valeur / capital investi | `charts/portfolio-chart/PortfolioChart.tsx`; garder le snapshot archivé intact |
| Modifier la mise en page | `styles/portfolio.css` |
| Ajouter un nouveau panneau | Créer un composant ciblé dans `components/`, puis le composer dans `PortfolioPage.tsx` |

## Contrats des composants

- `PortfolioPage` possède l’orchestration et transmet des valeurs/callbacks explicites aux panneaux.
- Les panneaux reçoivent des props de lecture seule; ils n’importent pas directement le contexte de compte ni ne génèrent leurs propres données.
- `usePortfolioReplay` est l’unique propriétaire de l’état temporel de la simulation et de la sélection partagée.
- `portfolio-model.ts` n’importe ni React ni composant d’interface. Il retourne des instantanés calculés à partir de l’étape et des rééquilibrages manuels.
- `index.ts` est le point d’entrée public à utiliser dans le routeur; les imports internes restent relatifs au module.
- `portfolio.css` est importé une fois par la page et toutes ses règles restent sous `.portfolio-page` ou le conteneur partagé ciblé par `:has(.portfolio-page)`.

## Données et limites

La page lit aussi le portefeuille fictif configuré pour le compte actif depuis `/v1/demo/overview` (DynamoDB AWS). Le panneau source affiche la valeur et les positions effectivement renvoyées par l’API, leur provenance fictive et un lien pour demander une analyse à l’assistant. Cette lecture est en lecture seule.

La relecture de marché reste une simulation locale distincte. Ses valeurs, titres, dates, rendements, volatilités, ratios, repères et rééquilibrages sont fictifs; ils ne viennent pas d’AWS, d’un compte de courtage, d’un flux de marché ou d’une prévision. La page et le CSV le signalent. Un rééquilibrage prévisualisé ou appliqué change uniquement cette simulation locale et ne transmet aucun ordre.

L’API de démo actuelle fournit un instantané mais pas de série temporelle ni les conventions requises pour calculer un rendement de compte. Remplacer le modèle par des données connectées seulement lorsque leur provenance, devise, date de valorisation, apports, frais et définition du benchmark sont documentés. Garder les calculs purs dans `model/` et l’adaptation des données séparée des composants.

## Graphique et bookmarks

Le bookmark sauvegardé Portfolio Chart (`component library`, ID `29532`) compare la valeur au capital investi et montre le repli. Le composant conserve son interaction de période, l’inspection pointeur/clavier, l’animation et son tableau accessible. Son jeu de démo intégré a été retiré; la page fournit explicitement les points du modèle. `chart-engine.tsx` contient les helpers nécessaires au snapshot, puisque le README d’origine indique que ce helper manque au dépôt.

Le bookmark Stock Portfolio Card ne fournit pas les contrôles de relecture ni l’aperçu des ajustements requis. Balance Chart génère sa propre série illustrative, donc ne convient pas à un historique produit. Les autres panneaux utilisent les composants métier de ce module.

## Développement et vérification

Le serveur Vite existant met le module à jour à chaud. Lancer `npm run typecheck -w @investoros/web` et `npm run build -w @investoros/web` après une modification; ne pas lancer les suites de tests sans demande explicite. Vérifier la page desktop à `/app/portfolios` et garder le cadre visible dans la fenêtre; les longs tableaux défilent à l’intérieur de leur panneau.
