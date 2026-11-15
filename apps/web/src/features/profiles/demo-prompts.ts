// Persona cases: docs/scenarios/. Company journey: docs/plan-produit-idees-utilisateur.md.
const portfolioPrompts: Record<string, string> = {
  amira: 'Je veux profiter de l’IA et de la crypto sans concentrer tous mes risques. Analyse la diversification de mon portefeuille.',
  mateo: 'Mon portefeuille respecte-t-il mes critères ESG et est-il assez diversifié ? Montre ce qui est vérifiable et ce qui manque.',
  robert: 'Un titre très médiatisé m’intéresse. Est-ce cohérent avec mon objectif de préservation du capital et mon horizon ?',
};

export function demoPrompts(accountId: string): string[] {
  return [
    'Analyse NVDA pour la semaine prochaine : événements à surveiller, sources et risques.',
    portfolioPrompts[accountId] ?? 'Analyse la diversification de mon portefeuille et sa cohérence avec mon profil.',
    'Compare deux scénarios hypothétiques sur NVDA à 30 jours : −10 % ou +10 % au 15e jour. Affiche les trajectoires et leurs limites.',
  ];
}
