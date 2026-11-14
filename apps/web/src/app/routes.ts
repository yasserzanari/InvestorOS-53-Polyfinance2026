export const appRoutes = {
  landing: '/',
  login: '/login',
  dashboard: '/app',
  assistant: '/app/assistant',
  profiles: '/app/profiles',
  portfolios: '/app/portfolios',
  analyses: '/app/analyses',
  network: '/app/network',
  scenarios: '/app/scenarios',
  evidence: '/app/evidence',
} as const;

export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];
