import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../shared/AppShell';
import { DemoAccountProvider } from '../shared/DemoAccountContext';
import { DashboardPage, ModuleLanding } from '../features/overview/DashboardPage';
import { AssistantPage, ProfilesPage } from '../features/profiles/ProfilesPage';
import { productModules } from './modules';

const LandingPage = lazy(() => import('../features/landing/LandingPage').then(({ LandingPage: Page }) => ({ default: Page })));
const LoginPage = lazy(() => import('../features/auth/LoginPage').then(({ LoginPage: Page }) => ({ default: Page })));
const PortfolioPage = lazy(() => import('../features/portfolios').then(({ PortfolioPage: Page }) => ({ default: Page })));
const ScenariosPage = lazy(() => import('../features/scenarios/ScenariosPage').then(({ ScenariosPage: Page }) => ({ default: Page })));
const EvidencePage = lazy(() => import('../features/evidence/EvidencePage').then(({ EvidencePage: Page }) => ({ default: Page })));
const AnalysesPage = lazy(() => import('../features/analyses/AnalysesPage').then(({ AnalysesPage: Page }) => ({ default: Page })));

export function App() {
  return (
    <DemoAccountProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="app-loading" role="status">InvestorOS</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="profiles" element={<ProfilesPage />} />
              <Route path="portfolios" element={<PortfolioPage />} />
              <Route path="scenarios" element={<ScenariosPage />} />
              <Route path="evidence" element={<EvidencePage />} />
              <Route path="analyses" element={<AnalysesPage />} />
              {productModules.filter(({ id }) => !['overview', 'assistant', 'profiles', 'portfolios', 'scenarios', 'evidence', 'analyses'].includes(id)).map((module) => (
                <Route
                  key={module.id}
                  path={module.href.replace('/app/', '')}
                  element={<ModuleLanding moduleId={module.id} />}
                />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DemoAccountProvider>
  );
}
