# Module Portefeuilles

La route `/app/portfolios` affiche les positions du compte de démonstration chargé depuis AWS, leur répartition et quatre observations explicables sur les expositions et le profil.

## Données et limites

- Les positions, valeurs, devise et pondérations viennent de `/v1/demo/overview` (DynamoDB). Elles sont fictives et présentées en lecture seule.
- Le panneau affiche quatre observations déterministes : concentration des trois principales positions, sensibilité arithmétique à un choc hypothétique de 1 % sur la ligne dominante, éléments de profil qui restent à préciser et couverture des données. Chaque carte ouvre les valeurs utilisées, la méthode de lecture et les limites.
- Le profil est lu depuis la mémoire du compte; si elle est absente ou indisponible, les valeurs initiales du persona sont utilisées et leur statut est indiqué dans le panneau.
- Ces observations ne constituent pas un score de risque ni un verdict d’adéquation. Aucun seuil n’est inventé. L’API ne fournit pas ici de série de cours ni le détail interne des fonds; la page ne calcule donc pas de rendements, volatilité, corrélations ou pertes historiques.

## Structure

- `PortfolioPage.tsx` assemble la page et lit le compte de démonstration actif.
- `components/` contient la watchlist des positions, la répartition et les observations détaillées du risque.
- `model/portfolio-observations.ts` contient les calculs déterministes et les données de preuve associées aux quatre observations.
- `styles/portfolio.css` définit la grille responsive et les styles du module.
- `charts/portfolio-chart/` conserve le composant graphique existant pour les usages qui lui fournissent une série réelle documentée.

Les composants reçoivent leurs données par props. Toute nouvelle mesure financière doit avoir une provenance et une définition explicites avant d’être affichée.
