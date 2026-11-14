export type FieldKey = 'objective' | 'horizon' | 'riskTolerance' | 'lossCapacity' | 'liquidity' | 'constraints' | 'preferences' | 'knowledge';
export type Profile = Record<FieldKey, string> & {
  origins: Record<FieldKey, string>;
  confirmed: boolean;
  version: number;
  updatedAt: string | null;
};
type ChatMessage = { id: number; role: 'assistant' | 'user'; text: string };

const storageKey = 'investoros.demo.profiles.v1';
export const fieldOrder: FieldKey[] = ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'];

export const initialProfiles: Record<string, Profile> = {
  amira: {
    objective: 'Faire croître mon épargne à long terme tout en gardant une diversification.',
    horizon: '15 ans et plus', riskTolerance: 'Élevée', lossCapacity: 'À préciser',
    liquidity: 'Aucun retrait important prévu à court terme (exemple).',
    constraints: 'Montant nécessaire à court terme : à préciser.', preferences: 'Intérêt pour l’IA et les technologies; crypto à examiner avec prudence.',
    knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null,
  },
  mateo: {
    objective: 'Faire croître mon épargne avec un équilibre entre rendement et risque.',
    horizon: '8 à 12 ans', riskTolerance: 'Modérée', lossCapacity: 'À préciser',
    liquidity: 'Besoins de liquidité à préciser.', constraints: 'Éviter les controverses importantes; capacité financière à préciser.',
    preferences: 'Préférences ESG (méthode et critères à préciser).', knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null,
  },
  robert: {
    objective: 'Préserver mon capital tout en cherchant une croissance raisonnable.',
    horizon: '3 à 5 ans', riskTolerance: 'Faible à modérée', lossCapacity: 'À préciser',
    liquidity: 'Une partie du capital pourrait être nécessaire dans les prochaines années.',
    constraints: 'Éviter une exposition excessive aux actifs risqués.', preferences: 'Peu d’intérêt pour la crypto.',
    knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null,
  },
};

export const fieldLabels: Record<FieldKey, string> = {
  objective: 'Objectif', horizon: 'Horizon', riskTolerance: 'Tolérance aux fluctuations',
  lossCapacity: 'Capacité à absorber une perte', liquidity: 'Liquidités et retraits',
  constraints: 'Contraintes', preferences: 'Préférences', knowledge: 'Connaissances financières',
};

const profileTabs: { id: string; label: string; fields: FieldKey[] }[] = [
  { id: 'objectifs', label: 'Objectifs', fields: ['objective', 'horizon'] },
  { id: 'risque', label: 'Risque', fields: ['riskTolerance', 'lossCapacity'] },
  { id: 'liquidites', label: 'Liquidités', fields: ['liquidity'] },
  { id: 'preferences', label: 'Préférences', fields: ['constraints', 'preferences', 'knowledge'] },
];
