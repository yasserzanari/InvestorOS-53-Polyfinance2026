import type { DemoApiConnection } from '../../shared/api';

const completeProfileStatuses = new Set(['complete', 'completed', 'confirmed']);

export function getPromptSuggestions(api: DemoApiConnection, draft: string): string[] {
  const query = draft.toLocaleLowerCase('fr-CA');
  const profileIntent = /profil|objectif|horizon|risque|préférence/.test(query);
  const portfolioIntent = /portefeuille|position|exposition|rendement|actif/.test(query);
  const sourceIntent = /source|donnée|preuve|vérifi/.test(query);
  const connected = api.status === 'connected';
  const profileReady = connected && completeProfileStatuses.has(api.overview.profile.status.toLowerCase());
  const hasPositions = connected && api.overview.portfolio.positions.length > 0;
  const hasAnalysis = connected && api.overview.analyses.length > 0;

  if (profileIntent) {
    return profileReady
      ? [
          'Explique comment mon horizon influence mon profil de risque.',
          'Quels objectifs de placement devrais-je préciser ?',
          'Quelles limites de risque devrais-je examiner ?',
        ]
      : [
          'Aide-moi à préciser mes objectifs et mon horizon de placement.',
          'Quelles informations manquent à mon profil investisseur ?',
          'Comment évaluer ma capacité à tolérer une perte ?',
        ];
  }

  if (portfolioIntent) {
    return hasPositions
      ? [
          'Résume les principales expositions de mon portefeuille.',
          'Quels risques de concentration devrais-je vérifier ?',
          'Quelles données manquent pour comparer mes positions ?',
        ]
      : [
          'Quelles positions fournir pour examiner mon portefeuille ?',
          'Comment repérer une concentration dans mes actifs ?',
          'Quelles données sont nécessaires pour calculer les risques ?',
        ];
  }

  if (sourceIntent) {
    return [
      'Quelles sources vérifier avant de préparer une analyse ?',
      'Comment confirmer la date et la provenance des données ?',
      'Comment comparer une information avec une source indépendante ?',
    ];
  }

  if (!connected) {
    return [
      'Aide-moi à préciser mes objectifs et mon horizon de placement.',
      'Quelles positions fournir pour examiner mon portefeuille ?',
      'Comment préparer une première analyse avec les données disponibles ?',
    ];
  }

  return [
    profileReady
      ? 'Explique comment mon profil influence mes choix de placement.'
      : 'Aide-moi à compléter mon profil investisseur.',
    hasPositions
      ? 'Résume les principales expositions de mon portefeuille.'
      : 'Quelles positions fournir pour examiner mon portefeuille ?',
    hasAnalysis
      ? 'Résume les points importants de ma dernière analyse.'
      : 'Comment préparer une première analyse avec les données disponibles ?',
  ];
}
