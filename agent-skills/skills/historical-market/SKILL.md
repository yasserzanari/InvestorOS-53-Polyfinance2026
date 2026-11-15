---
name: historical-market
description: Consulter les cours historiques et événements d’un titre, avec dates et limites.
---

# historical-market

Appelle inspect_simulation_history avec le ticker et les dates demandées quand elles sont explicites. Rapporte période, devise, méthode et limites de la sortie. Un rendement après une date n’établit pas une causalité. Les données historiques ne sont pas des prix temps réel. Pour les fondamentaux et événements à rechercher, charge company-analysis. Ne transforme pas un mouvement passé en choc futur.

Si la question demande pourquoi un titre a fortement bougé sur des séances passées, charge `market-movement-investigation` : une simple lecture de rendement ne permet pas d’en attribuer la cause.


Lire get_simulation_capabilities pour vérifier que le ticker et le paquet sont disponibles avant la lecture historique. Conserver l’intervalle demandé. Les valeurs proviennent du dataset configuré avec sa date d’arrêt et sa classification; ne pas les appeler cours actuels ou données en direct. Une erreur de configuration ne doit pas être transformée en résultat de remplacement.


## Comparaison de plusieurs actifs

Si `compare_market_history` est disponible, utilise-le pour deux à quatre symboles configurés. Il aligne les dates réellement communes et calcule les métriques sur toutes les observations; la courbe affichée est un échantillon déclaré. Conserve dates, devises et comparisonId. La fenêtre par défaut est une année avant la dernière observation commune, jamais une année jusqu’à un cours actuel supposé. Une devise différente empêche de présenter les chiffres comme une comparaison dans la monnaie de l’investisseur. Le profil modifie les questions et compromis à discuter, pas les observations. Ne désigne pas de gagnant depuis le rendement passé et ne confonds pas écart-type par intervalle avec risque de portefeuille. L’outil crée l’onglet comparatif; ne recrée pas ses chiffres avec upsert_tab.
