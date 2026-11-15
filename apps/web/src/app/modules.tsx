import type { LucideIcon } from 'lucide-react';
import {
  ChartNoAxesCombined,
  Bot,
  Compass,
  FileSearch,
  GitBranch,
  Layers3,
  Settings,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

export type ModuleIcon = LucideIcon;
export type ProductModule = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: ModuleIcon;
  group: 'Décider' | 'Explorer' | 'Administration';
};

// Add a product module here and register its route in App.tsx. The shared
// sidebar derives all navigation labels, icons, and paths from this list.
export const productModules: ProductModule[] = [
  {
    id: 'overview', label: 'Vue d’ensemble', shortLabel: 'Dashboard', href: '/app',
    description: 'Reprendre votre travail et choisir la prochaine étape.', icon: ChartNoAxesCombined, group: 'Décider',
  },
  {
    id: 'assistant', label: 'Assistant', shortLabel: 'Assistant', href: '/app/assistant',
    description: 'Orchestrer les tâches InvestorOS et retrouver votre espace de travail partagé.', icon: Bot, group: 'Décider',
  },
  {
    id: 'profiles', label: 'Profils investisseurs', shortLabel: 'Profils', href: '/app/profiles',
    description: 'Construire un profil avec ses objectifs, horizons et contraintes.', icon: UsersRound, group: 'Décider',
  },
  {
    id: 'analyses', label: 'Analyses', shortLabel: 'Analyses', href: '/app/analyses',
    description: 'Examiner une décision avec des preuves et des limites visibles.', icon: FileSearch, group: 'Décider',
  },
  {
    id: 'portfolios', label: 'Portefeuilles', shortLabel: 'Portefeuilles', href: '/app/portfolios',
    description: 'Explorer les positions, répartitions et expositions.', icon: Layers3, group: 'Décider',
  },
  {
    id: 'network', label: 'Réseaux d’entreprises', shortLabel: 'Réseaux', href: '/app/network',
    description: 'Cartographier les dépendances et leurs sources vérifiables.', icon: GitBranch, group: 'Explorer',
  },
  {
    id: 'scenarios', label: 'Simulation', shortLabel: 'Simulation', href: '/app/scenarios',
    description: 'Étudier les cours historiques, les événements datés et des trajectoires conditionnelles.', icon: Compass, group: 'Explorer',
  },
  {
    id: 'evidence', label: 'Sources et méthode', shortLabel: 'Sources', href: '/app/evidence',
    description: 'Vérifier les données, hypothèses et méthodes utilisées.', icon: ShieldCheck, group: 'Explorer',
  },
  {
    id: 'admin', label: 'Administration', shortLabel: 'Admin', href: '/app/admin',
    description: 'Supervision, architecture et santé de la plateforme.', icon: Settings, group: 'Administration',
  },
];
