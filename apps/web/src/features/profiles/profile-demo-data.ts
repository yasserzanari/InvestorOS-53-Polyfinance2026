import type { WorkspaceTab } from './profile-api';

export type DemoGoal = {
  id: string;
  title: string;
  description: string;
  horizonYears: number;
  role: 'Principal' | 'Secondaire';
};

export type DemoSituation = {
  incomeRange: string;
  liquidities: string;
  financialAssets: string;
  obligations: string;
  personalContext: string;
};

/** Synthetic values for the three public personas only; never represents customer data. */
export const DEMO_GOALS: Record<string, DemoGoal[]> = {
  mateo: [
    { id: 'capital-equilibre', title: 'Croissance équilibrée du capital', description: 'Faire croître le capital avec une approche diversifiée et un risque modéré.', horizonYears: 10, role: 'Principal' },
    { id: 'reserve-liquidites', title: 'Maintenir une réserve de liquidités', description: 'Préserver une marge pour les besoins prévisibles et les occasions à court terme.', horizonYears: 2, role: 'Secondaire' },
  ],
  amira: [
    { id: 'croissance-long-terme', title: 'Faire croître l’épargne à long terme', description: 'Garder une diversification tout en explorant les thèmes technologiques déclarés.', horizonYears: 15, role: 'Principal' },
    { id: 'diversification-thematique', title: 'Équilibrer les thèmes technologiques', description: 'Suivre l’exposition à l’IA, aux technologies et aux actifs spéculatifs dans un ensemble diversifié.', horizonYears: 10, role: 'Secondaire' },
  ],
  robert: [
    { id: 'preservation-capital', title: 'Préserver le capital', description: 'Limiter les fluctuations susceptibles de compromettre le projet à moyen terme.', horizonYears: 4, role: 'Principal' },
    { id: 'croissance-prudente', title: 'Ajouter une croissance prudente', description: 'Évaluer la croissance uniquement dans les limites de l’objectif de préservation.', horizonYears: 4, role: 'Secondaire' },
  ],
};

export const DEMO_SITUATIONS: Record<string, DemoSituation> = {
  mateo: { incomeRange: '75 000–100 000 $/an · exemple fictif', liquidities: '6–12 mois de dépenses · exemple fictif', financialAssets: '100 000–250 000 $ · exemple fictif', obligations: 'Endettement modéré · exemple fictif', personalContext: 'Aucune autre information fournie' },
  amira: { incomeRange: '60 000–85 000 $/an · exemple fictif', liquidities: '3–6 mois de dépenses · exemple fictif', financialAssets: '50 000–125 000 $ · exemple fictif', obligations: 'À préciser dans ce scénario fictif', personalContext: 'Aucune autre information fournie' },
  robert: { incomeRange: '70 000–95 000 $/an · exemple fictif', liquidities: '12 mois de dépenses · exemple fictif', financialAssets: '150 000–300 000 $ · exemple fictif', obligations: 'Faible endettement · exemple fictif', personalContext: 'Aucune autre information fournie' },
};

export function demoGoalsTab(accountId: string): WorkspaceTab {
  return {
    id: 'profile-objectives',
    title: 'Objectifs du profil',
    kind: 'profile',
    content: JSON.stringify({ schema: 1, persona: accountId, goals: DEMO_GOALS[accountId] ?? DEMO_GOALS.mateo }),
  };
}

export function goalsFromTab(tab: WorkspaceTab | undefined, accountId: string): DemoGoal[] {
  if (tab) {
    try {
      const parsed = JSON.parse(tab.content) as { goals?: DemoGoal[] };
      if (Array.isArray(parsed.goals) && parsed.goals.every(goal => goal && typeof goal.id === 'string' && typeof goal.title === 'string' && Number.isFinite(goal.horizonYears))) return parsed.goals;
    } catch { /* Use the safe persona fixture when an older document is malformed. */ }
  }
  return DEMO_GOALS[accountId] ?? DEMO_GOALS.mateo;
}
