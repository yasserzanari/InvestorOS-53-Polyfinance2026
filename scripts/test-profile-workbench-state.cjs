// Browser state regression checks. Every API call is intercepted; no AWS or server memory is used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.PROFILE_WEB_URL || 'http://127.0.0.1:5185';
const account = 'mateo';
const storageKey = `investoros.workspace.v2.${account}`;
const fields = ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'];
const profile = {
  objective: 'Préserver les fonds du projet fictif', horizon: '18 mois — mémoire serveur de test',
  riskTolerance: 'Modérée', lossCapacity: 'Une perte compromettrait ce projet',
  liquidity: 'Fonds nécessaires dans 18 mois', constraints: 'Sans effet de levier',
  preferences: 'Pas de crypto', knowledge: 'Débutant',
  origins: Object.fromEntries(fields.map(field => [field, 'Fixture navigateur isolée'])),
  confirmed: true, version: 3, updatedAt: '2026-11-15T10:00:00Z',
};

function projection(ticker, horizon, shock = -10) {
  return {
    ticker, asOf: '2026-11-12', startingPrice: 100, currency: 'USD',
    source: 'Fixture de test, aucun cours réel', sourceClassification: 'illustrative',
    method: 'Trajectoire illustrative pour vérifier uniquement les interactions.',
    limitations: ['Ces chiffres ne constituent pas une analyse financière.'],
    timeUnit: 'observations', horizonObservations: horizon,
    branches: [{
      id: `${ticker.toLowerCase()}-branch`, title: `Hypothèse ${ticker}`, event: `Événement fictif ${ticker}`,
      shockPct: shock, eventAfterObservations: 10,
      path: [0, 10, horizon].map(observations => ({
        observations, eventApplied: observations >= 10,
        lowerPrice: observations ? 80 : 100,
        medianPrice: observations ? 100 + shock : 100,
        upperPrice: observations ? 120 : 100,
      })),
    }],
  };
}

const sources = [
  { id: 'evidence-old', index: 1, title: 'Ancienne référence du document', url: 'https://example.org/shared-document', snippet: 'Premier extrait de test.' },
  { id: 'evidence-linked', index: 2, title: 'Preuve liée au constat', url: 'https://example.org/shared-document', snippet: 'Second extrait, identifiant distinct mais URL identique.' },
];
const restoredComparison = {
  type: 'comparison', title: 'MSFT / NVDA', currency: 'USD',
  period: { from: '2024-02-05', to: '2024-03-08' }, observations: 3,
  metrics: ['MSFT', 'NVDA'].map(ticker => ({
    ticker, name: `${ticker} — fixture restaurée`, returnPct: 2, periodVolatilityPct: 1,
    drawdownPct: -1, excludedObservations: 0, classification: 'illustrative',
    source: 'Fixture navigateur', sourceUrl: `https://example.org/${ticker}`,
    sourceDescription: 'Fixture de restauration, aucun cours réel.', sourceAsOf: '2024-03-08',
  })),
  series: [
    { date: '2024-02-05', MSFT: 100, NVDA: 100 },
    { date: '2024-02-20', MSFT: 101, NVDA: 99 },
    { date: '2024-03-08', MSFT: 102, NVDA: 102 },
  ],
  dataSha256: 'b'.repeat(64), methodDetails: 'Fixture pour vérifier la restauration des contrôles.',
  limits: ['Données illustratives de test.'], createdAt: '2026-11-15T10:00:00Z',
};
const insight = {
  type: 'insight', title: 'Constat de test des références', question: 'Quelle preuve soutient ce point ?',
  summary: 'Fixture pour vérifier la liaison par identifiant.', status: 'clarification', fields: ['horizon'],
  evidenceIds: ['evidence-linked'], alternatives: ['Clarifier le rôle des fonds'], nextQuestion: '',
  limits: ['Test de rendu uniquement.'], profileSnapshot: Object.fromEntries(fields.map(field => [field, profile[field]])),
  createdAt: '2026-11-15T10:00:00Z',
  portfolioBasis: {
    portfolioName: 'Portefeuille fictif du test de rendu', currency: 'CAD',
    positions: [
      { label: 'Actions mondiales (fixture)', weightPct: 55.5 },
      { label: 'Obligations (fixture)', weightPct: 29.5 },
      { label: 'Liquidités (fixture)', weightPct: 15 },
    ],
  },
};
const tabs = [
  { id: 'simulation-aapl', title: 'Scénario AAPL de test', kind: 'simulation', content: JSON.stringify(projection('AAPL', 20)) },
  { id: 'simulation-msft', title: 'Scénario MSFT de test', kind: 'simulation', content: JSON.stringify(projection('MSFT', 40, 5)) },
  { id: 'profile-alignment', title: 'Alignement', kind: 'decision', content: JSON.stringify(insight) },
  { id: 'profile-comparison', title: 'Comparaison', kind: 'decision', content: JSON.stringify(restoredComparison) },
];
const question = {
  id: 'pending-test-question', title: 'Précision de test',
  questions: [{ id: 'q1', label: 'Quel est le rôle de ces fonds ?', kind: 'text', required: true, allowOther: false, options: [] }],
};
const localWorkspace = {
  profile: { ...profile, horizon: 'Ancien contexte local à ne pas envoyer' }, tabs, sources,
  conversationScoped: true, researchRuns: [], activeTab: 'simulation-aapl',
  messages: [{
    id: 'pending-assistant', role: 'assistant', text: 'Précisons le projet.', citations: [], followUps: [],
    tools: [], agents: [], versions: ['Précisons le projet.'], version: 0, questionRequest: question,
  }],
};

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], unexpected = [], requests = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  let releaseMemory;
  const memoryReady = new Promise(resolve => { releaseMemory = resolve; });
  let memory = { revision: 7, profile, tabs, sources, storage: 'fixture' };

  await context.addInitScript(({ account, storageKey, workspace }) => {
    localStorage.clear();
    localStorage.setItem('investoros.demo.active-account.v1', account);
    localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, { account, storageKey, workspace: localWorkspace });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== new URL(base).origin) {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.includes('/v1/')) {
      await route.continue();
      return;
    }
    requests.push({ method: request.method(), path: url.pathname });
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/v1/profiles/status')) return json({ configured: true, modelId: 'fixture-no-bedrock' });
    if (url.pathname.endsWith(`/v1/profiles/memory/${account}`)) {
      if (request.method() === 'GET') {
        await memoryReady;
        return json(memory);
      }
      assert.equal(request.method(), 'PUT');
      const body = request.postDataJSON();
      writes.push(body);
      assert.equal(body.expectedRevision, memory.revision);
      memory = { ...memory, profile: body.profile, tabs: body.tabs, sources: body.sources, revision: memory.revision + 1 };
      return json(memory);
    }
    if (url.pathname.endsWith('/v1/profiles/chat')) {
      const body = request.postDataJSON();
      assert.equal(body.profile.horizon, profile.horizon, 'Le dialogue doit attendre le contexte restauré.');
      const output = projection('AAPL', 25);
      const updated = { ...tabs[0], content: JSON.stringify(output) };
      return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [
        { type: 'tool', id: 'fixture-scenario-tool', name: 'project_market_scenarios', status: 'done', output },
        // Keep AAPL before MSFT deliberately: navigation must select the result ID, not the last tab.
        { type: 'workspace', profile: body.profile, tabs: [updated, ...body.tabs.filter(tab => tab.id !== updated.id)] },
        { type: 'profile_view', view: 'scenarios' },
        { type: 'text', delta: 'Réponse de fixture, sans appel modèle.' }, { type: 'done' },
      ].map(event => JSON.stringify(event)).join('\n') + '\n' });
    }
    if (url.pathname.endsWith('/v1/simulation/scenarios')) {
      const body = request.postDataJSON();
      const result = projection(body.ticker, body.horizonObservations, body.branches[0].shockPct);
      result.branches = body.branches.map(branch => ({ ...branch, path: result.branches[0].path }));
      return json(result);
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 501, contentType: 'application/json', body: '{"detail":"Unexpected fixture endpoint"}' });
  });

  try {
    await page.goto(base + '/app/profiles');
    await page.locator('[data-profile-workbench]').waitFor();
    await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent.includes('Chargement'));
    assert.equal(await page.getByRole('textbox', { name: 'Message à l’assistant', exact: true }).isDisabled(), true, 'Composer bloqué pendant la restauration');
    assert.equal(await page.getByRole('textbox', { name: 'Horizon', exact: true }).isDisabled(), true, 'Profil bloqué pendant la restauration');
    assert.equal(await page.getByRole('button', { name: 'Envoyer', exact: true }).isDisabled(), true, 'Question interactive bloquée pendant la restauration');
    await page.getByRole('tab', { name: 'Comparer', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Comparer', exact: true }).isDisabled(), true, 'Comparaison bloquée pendant la restauration');
    await page.getByRole('tab', { name: 'Scénarios', exact: true }).click();
    assert.equal(await page.locator('.pb-body').evaluate(element => element.inert), true, 'Toutes les actions du panneau sont inertes pendant la restauration');
    assert.equal(await page.getByRole('button', { name: 'Paramètres', exact: true }).evaluate(element => {
      element.focus(); return document.activeElement === element;
    }), false, 'Les paramètres inertes ne peuvent pas recevoir le focus');
    assert.equal(requests.filter(request => request.method !== 'GET').length, 0, 'Aucune mutation avant restauration');
    releaseMemory();
    await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent.includes('restaurée'));

    await page.getByRole('tab', { name: 'Comparer', exact: true }).click();
    const symbols = () => page.getByRole('textbox', { name: 'Symboles à comparer', exact: true });
    const startDate = () => page.getByLabel('Du', { exact: true });
    const endDate = () => page.getByLabel('Au', { exact: true });
    assert.equal(await symbols().inputValue(), 'MSFT, NVDA', 'Les symboles proviennent de la comparaison restaurée');
    assert.equal(await startDate().inputValue(), restoredComparison.period.from);
    assert.equal(await endDate().inputValue(), restoredComparison.period.to);
    const draft = { symbols: 'AAPL, MSFT', from: '2023-05-01', to: '2023-06-01' };
    await symbols().fill(draft.symbols);
    await startDate().fill(draft.from);
    await endDate().fill(draft.to);
    await page.getByRole('button', { name: 'Agrandir le panneau', exact: true }).click();
    await page.getByRole('button', { name: 'Afficher le chat', exact: true }).click();
    assert.equal(await symbols().inputValue(), draft.symbols, 'Un rendu parent ne réinitialise pas la saisie des symboles');
    assert.equal(await startDate().inputValue(), draft.from);
    assert.equal(await endDate().inputValue(), draft.to);

    await page.getByRole('tab', { name: 'Alignement', exact: true }).click();
    const exposures = page.getByRole('region', { name: 'Expositions du portefeuille fictif', exact: true });
    await exposures.waitFor();
    for (const position of insight.portfolioBasis.positions) {
      assert.equal(await exposures.getByText(position.label.replace(/\s*\(fixture\)\s*/gi, ''), { exact: true }).count(), 1);
      assert.equal(await exposures.getByText(`${position.weightPct.toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`, { exact: true }).count(), 1);
    }
    assert.match(await exposures.innerText(), /Catégories déclarées, sans composition sous-jacente/);
    await page.getByRole('button', { name: 'Voir les preuves', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: /Preuve liée au constat/ }).count(), 1, 'La preuve citée reste visible malgré une URL partagée');
    assert.equal(await page.locator('.pb-evidence-list>a').count(), 1);
    await page.getByRole('button', { name: 'Toutes les références', exact: true }).click();
    assert.equal(await page.locator('.pb-evidence-list>a[href="https://example.org/shared-document"]').count(), 2, 'Les deux identifiants sont préservés');
    assert.equal(await page.locator('.pb-evidence-list>a').count(), 4, 'Références reçues et deux sources de comparaison restent accessibles');

    await page.getByRole('tab', { name: 'Scénarios', exact: true }).click();
    assert.match(await page.locator('.pb-scenario-compact').innerText(), /MSFT/, 'Le dernier scénario est sélectionné par défaut');
    await page.getByRole('button', { name: 'Scénario précédent', exact: true }).click();
    assert.match(await page.locator('.pb-scenario-compact').innerText(), /AAPL/);
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Horizon du calcul', exact: true }).fill('30');
    assert.equal(await page.getByRole('button', { name: 'Synthèse', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Scénario suivant', exact: true }).click();
    assert.match(await page.locator('.pb-scenario-compact').innerText(), /MSFT/);
    assert.equal(await page.getByRole('button', { name: 'Synthèse', exact: true }).isDisabled(), false, 'La modification de A ne rend pas B périmé');
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Titre à simuler', exact: true }).inputValue(), 'MSFT');
    assert.equal(await page.getByRole('spinbutton', { name: 'Horizon du calcul', exact: true }).inputValue(), '40', 'Le brouillon de A ne passe pas dans B');
    await page.getByRole('spinbutton', { name: 'Horizon du calcul', exact: true }).fill('45');
    const calculated = page.waitForResponse(response => response.url().endsWith('/v1/simulation/scenarios') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Recalculer avec ces paramètres', exact: true }).click();
    const calculation = (await calculated).request().postDataJSON();
    assert.equal(calculation.ticker, 'MSFT');
    assert.equal(calculation.horizonObservations, 45);
    await page.waitForFunction(() => document.querySelector('.pb-scenario-compact')?.textContent.includes('45 séances'));
    await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent.includes('Enregistré sur le serveur'));
    assert.ok(writes.length > 0, 'Sauvegarde interceptée du scénario recalculé');
    assert.equal(JSON.parse(memory.tabs.find(tab => tab.id === 'simulation-aapl').content).horizonObservations, 20, 'Le scénario A reste intact');
    assert.equal(JSON.parse(memory.tabs.find(tab => tab.id === 'simulation-msft').content).horizonObservations, 45);
    await page.getByRole('tab', { name: 'Comparer', exact: true }).click();
    assert.equal(await symbols().inputValue(), draft.symbols, 'La mise à jour d’un autre document préserve la saisie');
    assert.equal(await startDate().inputValue(), draft.from);
    assert.equal(await endDate().inputValue(), draft.to);
    assert.deepEqual(JSON.parse(memory.tabs.find(tab => tab.id === 'profile-comparison').content).period, restoredComparison.period, 'Un brouillon ne remplace pas le résultat enregistré');

    await page.getByRole('textbox', { name: 'Message à l’assistant', exact: true }).fill('Vérifie le contexte restauré.');
    await page.getByRole('button', { name: 'Envoyer le message', exact: true }).click();
    await page.getByText('Réponse de fixture, sans appel modèle.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Scénarios', exact: true }).getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.pb-scenario-compact').innerText(), /AAPL/);
    assert.match(await page.locator('.pb-scenario-compact').innerText(), /25 séances/);
    const finalWorkspace = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), storageKey);
    assert.equal(finalWorkspace.profileView.split(':')[2], 'simulation-aapl', 'Une navigation générique conserve le scénario publié par l’IA');
    assert.equal(finalWorkspace.tabs.filter(tab => tab.kind === 'simulation').at(-1).id, 'simulation-msft', 'Le scénario visé est vérifié indépendamment de sa position');
    assert.equal(JSON.parse(finalWorkspace.tabs.find(tab => tab.id === 'simulation-msft').content).horizonObservations, 45);
    assert.equal(requests.filter(request => request.path.endsWith('/v1/profiles/chat')).length, 1);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    console.log('PASS: restauration avant mutations; comparaison MSFT/NVDA et saisie conservées; poids du portefeuille rendus; preuves par identifiant; scénarios et brouillons isolés; résultat IA ciblé. Toutes les API sont interceptées, aucun appel AWS.');
  } finally {
    releaseMemory();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
