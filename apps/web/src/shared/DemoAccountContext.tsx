import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type DemoAccount = {
  id: string;
  name: string;
  initials: string;
  profileName: string;
  profileType: string;
};

export const demoAccounts: DemoAccount[] = [
  { id: 'amira', name: 'Amira · Démo', initials: 'A', profileName: 'Amira', profileType: 'Croissance à long terme' },
  { id: 'mateo', name: 'Mateo · Démo', initials: 'M', profileName: 'Mateo', profileType: 'Croissance équilibrée' },
  { id: 'robert', name: 'Robert · Démo', initials: 'R', profileName: 'Robert', profileType: 'Préservation et croissance' },
];

type DemoAccountContextValue = {
  activeAccount: DemoAccount;
  setActiveAccountId: (id: string) => void;
};

const DemoAccountContext = createContext<DemoAccountContextValue | null>(null);
const ACCOUNT_STORAGE_KEY = 'investoros.demo.active-account.v1';

export function DemoAccountProvider({ children }: { children: ReactNode }) {
  const [activeAccountId, setActiveAccountId] = useState(() => {
    try {
      const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
      return demoAccounts.some((account) => account.id === stored) ? stored! : 'mateo';
    } catch {
      return 'mateo';
    }
  });

  const activeAccount = demoAccounts.find((account) => account.id === activeAccountId) ?? demoAccounts[1];
  const value = useMemo<DemoAccountContextValue>(() => ({
    activeAccount,
    setActiveAccountId: (id) => {
      if (!demoAccounts.some((account) => account.id === id)) return;
      setActiveAccountId(id);
      try { window.localStorage.setItem(ACCOUNT_STORAGE_KEY, id); } catch { /* Browser storage may be disabled. */ }
    },
  }), [activeAccount]);

  return <DemoAccountContext.Provider value={value}>{children}</DemoAccountContext.Provider>;
}

export function useDemoAccount() {
  const value = useContext(DemoAccountContext);
  if (!value) throw new Error('useDemoAccount must be used within DemoAccountProvider');
  return value;
}
