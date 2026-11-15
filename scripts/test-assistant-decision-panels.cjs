// Deterministic presentation and action checks. Memory/model responses are intercepted; no account data is changed.
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { capture } = require('./browser-capture.cjs');
const base = process.env.DECISION_WEB_URL || 'http://127.0.0.1:5200';
const profile = { objective: 'Croissance équilibrée à moyen et long terme.', horizon: '10 ans', riskTolerance: 'Modérée', lossCapacity: 'Une perte de 20 à 30 % serait supportable sur une partie du capital.', liquidity: 'Besoins moyens de liquidité.', constraints: 'Éviter les controverses importantes.', preferences: 'Impact environnemental et gouvernance.', knowledge: 'À préciser', origins: {}, confirmed: false, version: 1, updatedAt: null };
const snapshot = Object.fromEntries(['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'].map(key => [key, profile[key]]));
const insight = { type: 'insight', title: 'Intérêt tech et capacité de perte', question: 'Quel est le lien entre mon intérêt pour la technologie et mon profil ?', status: 'partial', summary: 'Vous indiquez qu’une perte de 20 à 30 % sur une partie de votre capital serait supportable. Avec un horizon de 10 ans et une tolérance modérée, une exposition à la technologie reste une piste à discuter. La composition de vos positions doit encore être examinée.', fields: ['horizon', 'riskTolerance', 'lossCapacity', 'preferences'], evidenceIds: [], alternatives: ['Explorer l’historique de titres technologiques pour observer leurs variations.', 'Examiner les engagements environnementaux et la gouvernance des entreprises.', 'Vérifier l’exposition technologique déjà présente dans les actions mondiales.'], nextQuestion: '', limits: ['La composition sous-jacente des actions mondiales n’est pas disponible.', 'La capacité de perte déclarée ne mesure pas le risque du portefeuille.'], profileSnapshot: snapshot, createdAt: '2026-11-15T12:00:00Z' };
const comparison = { type: 'comparison', title: 'Actif A / Actif B · essai d’interface', currency: 'USD', period: { from: '2026-01-01', to: '2026-01-03' }, observations: 3, metrics: ['A', 'B'].map((ticker, i) => ({ ticker, name: `Actif ${ticker}`, returnPct: i ? -2 : 3, periodVolatilityPct: 1, drawdownPct: i ? -2 : 0, source: 'Jeu de vérification', sourceUrl: 'https://example.org/test', classification: 'simulation', excludedObservations: 0 })), series: [{ date: '2026-01-01', A: 100, B: 100 }, { date: '2026-01-02', A: 101, B: 99 }, { date: '2026-01-03', A: 103, B: 98 }], dataSha256: 'a'.repeat(64), methodDetails: 'Courbes en base 100. Données déterministes réservées au test d’interface.', limits: ['Aucune cotation réelle dans ce jeu de vérification.'], createdAt: '2026-11-15T12:00:00Z' };
const tab = data => ({ id: 'profile-alignment', title: 'Alignement', kind: 'decision', content: JSON.stringify(data) });
const message = (role, text) => ({ id: role, role, text, tools: [], agents: [], citations: [], followUps: [], versions: [text], version: 0 });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1661, height: 1251 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/v1/profiles/memory/mateo', route => route.fulfill({ json: { profile, tabs: [], sources: [], revision: 1 } }));
  await page.route('**/v1/profiles/status', route => route.fulfill({ json: { configured: true, modelId: 'Interface test · model intercepted' } }));
  await page.route('**/v1/profiles/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'text', text: 'Piste reçue dans le test d’interface.' }) + '\n' + JSON.stringify({ type: 'done' }) + '\n' });
  });
  async function seed(data, extraSources = []) {
    await page.evaluate(({ profile, tabs, messages, sources }) => {
      localStorage.setItem('investoros.demo.active-account.v1', 'mateo');
      for (const key of ['investoros.conversations.v1.mateo', 'investoros.conversations.active.v1.mateo']) localStorage.removeItem(key);
      localStorage.setItem('investoros.workspace.v2.mateo', JSON.stringify({ profile, tabs, messages, sources, activeTab: tabs[0].id, conversationScoped: true }));
    }, { profile, tabs: [tab(data), { id: 'profile-comparison', title: 'Comparaison', kind: 'decision', content: JSON.stringify(comparison) }, { id: 'note', title: 'Notes', kind: 'note', content: 'Une note modifiable.' }], messages: [message('user', 'Examinons le lien entre mon profil et mon intérêt pour la technologie.'), message('assistant', 'Aperçu de vérification de l’interface. Le constat est présenté dans l’onglet Alignement, avec les points à vérifier et les pistes à explorer.')], sources: extraSources });
    await page.goto(base + '/app/assistant');
    await page.getByRole('button', { name: 'Onglets, références et agents', exact: true }).click();
    await page.locator('.pw-overview-tabs button').filter({ hasText: 'Alignement' }).click();
    await page.locator('#assistant-workspace-panel').waitFor({ state: 'visible' });
  }
  try {
    await page.goto(base + '/app/assistant');
    await seed(insight);
    await page.getByRole('heading', { name: insight.title, exact: true }).waitFor();
    const panel = page.locator('#assistant-workspace-panel');
    assert.equal(await panel.locator('textarea').count(), 0);
    assert.equal(await panel.locator('.di-facts > div').count(), 4);
    assert.equal(await panel.locator('.di-options > button').count(), 3);
    await page.getByText('Sources & contexte', { exact: false }).click();
    await panel.getByText('Aucune preuve externe liée', { exact: false }).waitFor();
    await page.getByText('Sources & contexte', { exact: false }).click();
    const fit = await page.evaluate(() => ({ vertical: document.documentElement.scrollHeight <= innerHeight + 1, horizontal: document.documentElement.scrollWidth <= innerWidth + 1 }));
    assert.ok(fit.vertical && fit.horizontal);
    const screenshot = await capture(page, 'assistant-alignment-structured', { fullPage: false });
    await panel.locator('.di-options > button').first().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('investoros.workspace.v2.mateo') || '{}').messages?.some(message => message.role === 'user' && message.text.includes('Examinons cette piste')), undefined, { timeout: 10000 });
    assert.match(requests[0].message, /Explorer l’historique/);
    const legacy = { ...insight }; delete legacy.type; delete legacy.profileSnapshot;
    await seed(legacy); await panel.getByText('Profil actuel', { exact: true }).waitFor();
    await seed({ ...insight, profileSnapshot: { ...snapshot, horizon: '5 ans' } });
    await panel.getByText('Votre profil a changé', { exact: false }).waitFor();
    assert.equal(await panel.locator('.di-options > button').first().isDisabled(), true);
    await seed({ ...insight, evidenceIds: ['missing', 'unsafe'] }, [{ id: 'unsafe', title: 'Unsafe test link', url: 'javascript:alert(1)', snippet: '' }]);
    await page.getByText('Sources & contexte', { exact: false }).click();
    assert.equal(await panel.locator('.di-evidence a').count(), 0);
    await seed({ title: 'Malformed', status: 'partial', summary: 42 });
    await panel.getByRole('heading', { name: 'Cette synthèse est indisponible' }).waitFor();
    assert.equal(await panel.locator('textarea').count(), 0);
    await panel.getByRole('tab', { name: 'Comparaison', exact: true }).click();
    await panel.locator('.comparison-panel').waitFor();
    assert.equal(await panel.locator('textarea').count(), 0);
    await panel.getByRole('tab', { name: 'Notes', exact: true }).click();
    await panel.getByRole('button', { name: 'Modifier', exact: true }).click();
    assert.equal(await panel.getByRole('textbox', { name: 'Contenu de la note en Markdown', exact: true }).inputValue(), 'Une note modifiable.');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'PASS', screenshot, fit, checks: ['canonical insight', 'legacy missing snapshot', 'stale profile', 'discussion action', 'unsafe and missing sources', 'malformed data', 'comparison', 'editable notes'], model: 'intercepted; no Bedrock call or account mutation' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
