import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../shared/AppShell';
import { DemoAccountProvider } from '../shared/DemoAccountContext';
import { productModules } from './modules';
import { AuthCallback, AuthProvider, RequireAdmin } from '../shared/auth';

const LandingPage = lazy(() => import('../features/landing/LandingPage').then(({ LandingPage: Page }) => ({ default: Page })));
const LoginPage = lazy(() => import('../features/auth/LoginPage').then(({ LoginPage: Page }) => ({ default: Page })));
const DashboardPage = lazy(() => import('../features/overview/DashboardPage').then(({ DashboardPage: Page }) => ({ default: Page })));
const ModuleLanding = lazy(() => import('../features/overview/DashboardPage').then(({ ModuleLanding: Page }) => ({ default: Page })));
const AssistantPage = lazy(() => import('../features/profiles/ProfilesPage').then(({ AssistantPage: Page }) => ({ default: Page })));
const ProfilesPage = lazy(() => import('../features/profiles/ProfilesPage').then(({ ProfilesPage: Page }) => ({ default: Page })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then(({ SettingsPage: Page }) => ({ default: Page })));
const PortfolioPage = lazy(() => import('../features/portfolios').then(({ PortfolioPage: Page }) => ({ default: Page })));
const ScenariosPage = lazy(() => import('../features/scenarios/ScenariosPage').then(({ ScenariosPage: Page }) => ({ default: Page })));
const EvidencePage = lazy(() => import('../features/evidence/EvidencePage').then(({ EvidencePage: Page }) => ({ default: Page })));
const AnalysesPage = lazy(() => import('../features/analyses/AnalysesPage').then(({ AnalysesPage: Page }) => ({ default: Page })));
const NetworkPage = lazy(() => import('../features/network/NetworkPage').then(({ NetworkPage: Page }) => ({ default: Page })));
const AdminPage = lazy(() => import('../features/overview/AdminPage').then(({ AdminPage: Page }) => ({ default: Page })));

export function App() {
  return (
    <DemoAccountProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="app-loading" role="status">InvestorOS</div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route element={<RequireAdmin />}>
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="assistant" element={<AssistantPage />} />
                  <Route path="profiles" element={<ProfilesPage />} />
                  <Route path="portfolios" element={<PortfolioPage />} />
                  <Route path="scenarios" element={<ScenariosPage />} />
                  <Route path="evidence" element={<EvidencePage />} />
                  <Route path="analyses" element={<AnalysesPage />} />
                  <Route path="network" element={<NetworkPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  {productModules.filter(({ id }) => !['overview', 'assistant', 'profiles', 'portfolios', 'scenarios', 'evidence', 'analyses', 'network'].includes(id)).map((module) => (
                    <Route
                      key={module.id}
                      path={module.href.replace('/app/', '')}
                      element={<ModuleLanding moduleId={module.id} />}
                    />
                  ))}
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>

      </BrowserRouter>
    </DemoAccountProvider>
  );
}
