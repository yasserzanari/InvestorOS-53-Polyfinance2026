// Real browser UI with intercepted async transport. No AWS calls or persistent server writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.PROFILE_WEB_URL || 'http://127.0.0.1:5185';
const accountId = 'mateo';
const key = `investoros.workspace.v2.${accountId}`;
const fields = ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'];
const profile = {
  objective: 'Projet fictif de test', horizon: '10 ans', riskTolerance: 'Modérée',
  lossCapacity: 'À préciser', liquidity: 'À préciser', constraints: 'Aucune contrainte déclarée',
  preferences: 'À préciser', knowledge: 'Débutant',
  origins: Object.fromEntries(fields.map(field => [field, 'Fixture isolée'])),
  confirmed: false, version: 1, updatedAt: null,
};
const comparison = {
  type: 'comparison', title: 'AAPL / MSFT', currency: 'USD',
  period: { from: '2025-01-02', to: '2025-01-06' }, observations: 3,
  metrics: ['AAPL', 'MSFT'].map(ticker => ({
    ticker, name: `${ticker} — fixture`, returnPct: 2, periodVolatilityPct: 1,
    drawdownPct: -1, excludedObservations: 0, classification: 'illustrative',
    source: 'Fixture navigateur', sourceUrl: `https://example.org/${ticker}`,
    sourceDescription: 'Données illustratives de test, aucun cours réel.', sourceAsOf: '2025-01-06',
  })),
  series: [
    { date: '2025-01-02', AAPL: 100, MSFT: 100 },
    { date: '2025-01-03', AAPL: 101, MSFT: 99 },
    { date: '2025-01-06', AAPL: 102, MSFT: 102 },
  ],
  dataSha256: 'a'.repeat(64), methodDetails: 'Fixture de transport uniquement.',
  limits: ['Ne pas utiliser ces chiffres pour une décision.'], createdAt: '2026-11-15T10:00:00Z',
};
const comparisonTab = { id: 'profile-comparison', title: 'Comparaison', kind: 'decision', content: JSON.stringify(comparison) };
const citation = { id: 'async-test-source', index: 1, title: 'Source du test asynchrone', url: 'https://example.org/async', snippet: 'Fixture de transport.' };

async function waitUntil(predicate, description) {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, description);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function check(browser, variant) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], unexpected = [], polls = [], starts = [], cancellations = [], memoryReads = [], statusReads = [], writes = [];
  const aborting = variant === 'abort' || variant === 'abort-retry';
  let releaseMemory;
  const memoryGate = new Promise(resolve => { releaseMemory = resolve; });
  const jobId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let memory = { revision: 1, profile, tabs: [], sources: [], storage: 'fixture' };
  const initialEvents = [
    { type: 'status', label: 'Calcul de comparaison en cours — fixture' },
    { type: 'tool', id: 'async-comparison-tool', name: 'compare_profile_instruments', status: 'running', phase: 'executing' },
    { type: 'text', delta: 'Analyse ' },
  ];
  const completedEvents = [
    { type: 'tool', id: 'async-comparison-tool', name: 'compare_profile_instruments', status: 'done', output: comparison },
    { type: 'sources', citations: [citation] },
    { type: 'workspace', profile: { ...Object.fromEntries(fields.map(field => [field, profile[field]])), knowledge: 'Débutant — précision de fixture' }, tabs: [comparisonTab] },
    { type: 'profile_view', view: 'comparison' },
    { type: 'text', delta: 'terminée.' },
    { type: 'done' },
  ];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(account => {
    localStorage.clear();
    localStorage.setItem('investoros.demo.active-account.v1', account);
  }, accountId);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== new URL(base).origin) {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    if (!url.pathname.includes('/v1/')) return route.continue();
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/v1/profiles/status')) {
      statusReads.push({ at: Date.now() });
      if (variant === 'success' && statusReads.length === 1) return json({ detail: '503 status de test, réessayable.' }, 503);
      return json({ configured: true, modelId: 'async-fixture-no-bedrock', chatTransport: 'async' });
    }
    if (url.pathname.endsWith(`/v1/profiles/memory/${accountId}`)) {
      if (request.method() === 'GET') {
        memoryReads.push({ at: Date.now() });
        if (variant === 'success' && memoryReads.length === 1) return json({ detail: '503 mémoire de test, réessayable.' }, 503);
        if (variant === 'success') await memoryGate;
        return json(memory);
      }
      assert.equal(request.method(), 'PUT');
      const body = request.postDataJSON();
      writes.push(body);
      assert.equal(body.expectedRevision, memory.revision);
      memory = { ...memory, profile: body.profile, tabs: body.tabs, sources: body.sources, revision: memory.revision + 1 };
      return json(memory);
    }
    if (url.pathname.endsWith('/v1/profiles/chat/jobs')) {
      assert.equal(request.method(), 'POST');
      starts.push(request.postDataJSON());
      return json({ jobId }, 202);
    }
    if (url.pathname.endsWith(`/v1/profiles/chat/jobs/${jobId}/cancel`)) {
      assert.equal(request.method(), 'POST');
      assert.equal(url.searchParams.get('accountId'), accountId);
      cancellations.push({ at: Date.now() });
      return json({ jobId, status: 'cancelled' });
    }
    if (url.pathname.endsWith(`/v1/profiles/chat/jobs/${jobId}`)) {
      assert.equal(request.method(), 'GET');
      assert.equal(url.searchParams.get('accountId'), accountId);
      const cursor = Number(url.searchParams.get('after'));
      polls.push({ cursor, at: Date.now() });
      if (variant === 'success' && polls.length === 1) return json({ detail: '503 suivi de test, réessayable.' }, 503);
      if (variant === 'abort-retry' && polls.length === 2) return json({ detail: '503 avant arrêt pendant la reprise.' }, 503);
      const batch = polls.length - (variant === 'success' ? 1 : 0);
      if (batch === 1) {
        assert.equal(cursor, 0);
        return json({ status: 'running', events: initialEvents, nextCursor: initialEvents.length });
      }
      assert.equal(cursor, initialEvents.length, 'Le curseur des événements reçus doit être conservé.');
      if (variant === 'success' && batch === 2) return json({ status: 'running', events: [], nextCursor: cursor });
      if (variant === 'success') return json({ status: 'done', events: completedEvents, nextCursor: initialEvents.length + completedEvents.length });
      if (variant === 'event-error') return json({ status: 'failed', events: [{ type: 'error', message: 'Erreur explicite de la fixture.' }], nextCursor: cursor + 1 });
      if (variant === 'failed-status') return json({ status: 'failed', events: [], error: 'Échec du worker de test.', nextCursor: cursor });
      return json({ status: 'running', events: [], nextCursor: cursor });
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json({ detail: 'Unexpected fixture endpoint' }, 501);
  });
  const state = () => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey) || '{}'), key);
  try {
    await page.goto(base + '/app/profiles');
    if (variant === 'success') {
      await waitUntil(() => memoryReads.length === 2, 'La lecture mémoire doit réessayer après le premier 503.');
      assert.ok(memoryReads[1].at - memoryReads[0].at >= 850, 'La reprise mémoire respecte le délai de 1 seconde.');
      assert.equal(await page.getByRole('textbox', { name: 'Message à l’assistant', exact: true }).isDisabled(), true, 'Le dialogue reste bloqué pendant la reprise mémoire.');
      assert.equal(await page.getByRole('textbox', { name: 'Horizon', exact: true }).isDisabled(), true, 'Le profil reste bloqué pendant la reprise mémoire.');
      assert.equal(await page.locator('.pb-body').evaluate(element => element.inert), true);
      assert.equal(writes.length, 0, 'Aucun PUT avant restauration réussie.');
      assert.equal(starts.length, 0, 'Aucun lancement de job avant restauration.');
      releaseMemory();
    }
    await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent.includes('restaurée'));
    await page.locator('.pw-provider').filter({ hasText: /^Bedrock$/ }).waitFor();
    if (variant === 'success') {
      assert.equal(statusReads.length, 2, 'Le statut devient prêt après sa reprise.');
      assert.ok(statusReads[1].at - statusReads[0].at >= 850, 'La reprise du statut respecte le délai de 1 seconde.');
    }
    const retryResponse = variant === 'abort-retry' ? page.waitForResponse(response => response.url().includes(`/chat/jobs/${jobId}?`) && response.request().method() === 'GET' && response.status() === 503) : null;
    await page.getByRole('textbox', { name: 'Message à l’assistant', exact: true }).fill('Compare les deux actifs — test du transport asynchrone.');
    await page.getByRole('button', { name: 'Envoyer le message', exact: true }).click();
    await page.waitForFunction(storageKey => {
      const last = JSON.parse(localStorage.getItem(storageKey) || '{}').messages?.at(-1);
      return last?.text === 'Analyse ' && last.tools?.some(tool => tool.id === 'async-comparison-tool' && tool.status === 'running');
    }, key);
    const running = (await state()).messages.at(-1);
    assert.equal(running.versions.length, 0, 'Un résultat en cours ne doit pas être présenté comme terminé.');
    assert.equal(await page.getByRole('button', { name: 'Arrêter la réponse', exact: true }).isVisible(), true);
    if (aborting) {
      if (retryResponse) await retryResponse;
      const cancelled = page.waitForResponse(response => response.url().includes(`/chat/jobs/${jobId}/cancel`) && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Arrêter la réponse', exact: true }).click();
      await page.waitForFunction(storageKey => JSON.parse(localStorage.getItem(storageKey) || '{}').messages?.at(-1)?.error === 'Génération arrêtée.', key);
      await cancelled;
    } else {
      await page.waitForFunction(({ storageKey, success }) => {
        const last = JSON.parse(localStorage.getItem(storageKey) || '{}').messages?.at(-1);
        return success ? last?.versions?.length > 0 : Boolean(last?.error);
      }, { storageKey: key, success: variant === 'success' });
    }
    await page.getByRole('button', { name: 'Arrêter la réponse', exact: true }).waitFor({ state: 'hidden' });
    const result = await state(), last = result.messages.at(-1);
    assert.equal(starts.length, 1, 'Un seul lancement du job');
    assert.equal(starts[0].accountId, accountId);
    assert.equal(starts[0].workspaceMode, 'profiles');
    assert.equal(last.tools.length, 1, 'Les transitions du même outil ne créent pas de doublon.');
    if (variant === 'success') {
      assert.equal(last.text, 'Analyse terminée.', 'Aucun événement texte n’est rejoué après un lot vide.');
      assert.deepEqual(last.versions, ['Analyse terminée.']);
      assert.equal(last.error, undefined);
      assert.equal(last.tools[0].status, 'done');
      assert.equal(result.tabs.filter(tab => tab.id === 'profile-comparison').length, 1);
      assert.equal(result.sources.filter(source => source.id === citation.id).length, 1);
      assert.equal(result.profile.knowledge, 'Débutant — précision de fixture');
      assert.equal(await page.getByRole('tab', { name: 'Comparer', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('region', { name: 'Mesures sur la période commune' }).count(), 1);
      assert.deepEqual(polls.map(poll => poll.cursor), [0, 0, 3, 3], 'Le 503 ne déplace pas le curseur et ne rejoue aucun événement.');
      assert.ok(polls[1].at - polls[0].at >= 850, 'La reprise du polling respecte le délai de 1 seconde.');
      for (let index = 1; index < polls.length; index++) assert.ok(polls[index].at - polls[index - 1].at >= 650, 'Le polling attend environ 800 ms entre requêtes.');
      await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent.includes('Enregistré sur le serveur'));
      assert.equal(memory.tabs[0].id, 'profile-comparison');
    } else {
      assert.equal(last.text, 'Analyse ', 'Le résultat partiel reste disponible.');
      assert.equal(last.versions.length, 0, 'Une erreur ou un arrêt ne crée pas de version terminée.');
      assert.equal(last.tools[0].status, 'failed');
      assert.equal(result.tabs.length, 0, 'Aucune comparaison inventée sur une erreur.');
      assert.match(last.error, aborting ? /Génération arrêtée/ : variant === 'event-error' ? /Erreur explicite/ : /Échec du worker/);
    }
    assert.equal(cancellations.length, aborting ? 1 : 0);
    if (aborting) {
      const pollCount = polls.length;
      await page.waitForTimeout(1300);
      assert.equal(polls.length, pollCount, 'L’arrêt interrompt le polling suivant.');
    }
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    console.log(`PASS async ${variant}: ${polls.length} polls, ${cancellations.length} cancellation(s), ${memoryReads.length} memory read(s), ${statusReads.length} status read(s), no AWS calls`);
  } finally { releaseMemory(); await context.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const variant of ['success', 'event-error', 'failed-status', 'abort', 'abort-retry']) await check(browser, variant);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
