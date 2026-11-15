# Module Portefeuilles

La route `/app/portfolios` affiche les positions de la fixture AWS du compte de démonstration, leur répartition et une analyse IA des risques au regard du profil mémorisé.

## Données et limites

- Les positions, valeurs, devise et pondérations viennent de `/v1/demo/overview` (DynamoDB). Elles sont fictives et présentées en lecture seule.
- L’analyse des risques passe par l’assistant de profil et l’outil serveur `analyze_demo_portfolio`. Elle s’appuie sur les pondérations disponibles et le profil mémorisé; elle ne crée ni historique de marché ni conseil d’achat ou de vente.
- L’API ne fournit pas de série de cours. La page ne calcule donc pas de rendements, volatilité ou indicateurs historiques à partir de données simulées.

## Structure

- `PortfolioPage.tsx` assemble la page et lit le compte de démonstration actif.
- `components/` contient la watchlist des positions, la répartition et l’analyse des risques IA.
- `styles/portfolio.css` définit la grille responsive et les styles du module.
- `charts/portfolio-chart/` conserve le composant graphique existant pour les usages qui lui fournissent une série réelle documentée.

Les composants reçoivent leurs données par props. Toute nouvelle mesure financière doit avoir une provenance et une définition explicites avant d’être affichée.
