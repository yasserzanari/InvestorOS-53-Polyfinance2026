export type FieldKey = 'objective' | 'horizon' | 'riskTolerance' | 'lossCapacity' | 'liquidity' | 'constraints' | 'preferences' | 'knowledge';
export type Profile = Record<FieldKey, string> & {
  origins: Record<FieldKey, string>;
  detailOrigins?: Record<string,string>;
  confirmed: boolean;
  version: number;
  updatedAt: string | null;
  situation?: {
    incomeRange: string;
    liquidities: string;
    financialAssets: string;
    obligations: string;
    personalContext: string;
  };
};
import { DEMO_SITUATIONS } from './profile-demo-data';
type ChatMessage = { id: number; role: 'assistant' | 'user'; text: string };

const storageKey = 'investoros.demo.profiles.v1';
export const fieldOrder: FieldKey[] = ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'];

export const initialProfiles: Record<string, Profile> = {
  amira: {
    objective: 'Faire croître mon épargne à long terme tout en gardant une diversification.',
    horizon: '15 ans et plus', riskTolerance: 'Élevée', lossCapacity: 'À préciser',
    liquidity: 'À préciser.',
    constraints: 'Aucune contrainte déclarée.', preferences: 'Intérêt pour l’IA, les technologies, la crypto et la diversification.',
    knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null, situation: DEMO_SITUATIONS.amira,
  },
  mateo: {
    objective: 'Croissance équilibrée à moyen et long terme.',
    horizon: '10 ans', riskTolerance: 'Modérée', lossCapacity: 'À préciser',
    liquidity: 'Besoins moyens de liquidité.', constraints: 'Éviter les controverses importantes.',
    preferences: 'Critères ESG documentés; méthode à préciser.', knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null, situation: DEMO_SITUATIONS.mateo,
  },
  robert: {
    objective: 'Préservation du capital et croissance.',
    horizon: '4 ans', riskTolerance: 'Faible à modérée', lossCapacity: 'À préciser',
    liquidity: 'À préciser.',
    constraints: 'Aucune contrainte déclarée.', preferences: 'Peu attiré par la crypto.',
    knowledge: 'À préciser', origins: Object.fromEntries(fieldOrder.map((key) => [key, 'Persona de démonstration'])) as Record<FieldKey, string>, confirmed: false, version: 1, updatedAt: null, situation: DEMO_SITUATIONS.robert,
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
