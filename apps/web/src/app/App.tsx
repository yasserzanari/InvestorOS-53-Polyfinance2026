import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../shared/AppShell';
import { DashboardPage, ModuleLanding } from '../features/overview/DashboardPage';
import { productModules } from './modules';

const LandingPage = lazy(() => import('../features/landing/LandingPage').then(({ LandingPage: Page }) => ({ default: Page })));
const LoginPage = lazy(() => import('../features/auth/LoginPage').then(({ LoginPage: Page }) => ({ default: Page })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="app-loading" role="status">InvestorOS</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            {productModules.filter(({ id }) => id !== 'overview').map((module) => (
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
  );
}
