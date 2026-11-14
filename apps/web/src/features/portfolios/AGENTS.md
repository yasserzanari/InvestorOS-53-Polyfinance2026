# Consignes du module Portefeuilles

- Lire `README.md` et `UX-CONTRACT.md` à la racine du dépôt avant de modifier ce module.
- Garder ce module sous `features/portfolios/`; `index.ts` est son entrée de route publique.
- Garder `PortfolioPage.tsx` comme composition. Mettre la présentation dans `components/`, l’état d’interaction dans `hooks/`, les calculs purs et fixtures dans `model/`, les adaptateurs de format/export dans `utils/`, et les styles dans `styles/`.
- Les composants de `components/` reçoivent leurs données par props. Ils ne lisent pas le contexte du compte et ne reconstruisent pas les fixtures.
- Ne pas mettre du JSX dans le modèle, de calcul financier dans les composants, ni d’état partagé de relecture dans plusieurs panneaux.
- Conserver l’indication fictive sur les nombres et les exports. La fixture locale n’est pas une série de marché ni un compte client.
- Ne pas modifier le shell, les tokens, les contrats API ou l’infrastructure dans le cadre d’une modification visuelle de ce module sans demande explicite.
- Préserver le composant source Portfolio Chart dans son style et son comportement; passer la série via `data` et adapter uniquement les libellés nécessaires.
- Utiliser le serveur Vite courant, vérifier `typecheck` et `build`, et inspecter la page desktop après un changement de mise en page. Ne pas pousser une version en attente de validation utilisateur.
