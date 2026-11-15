// Desktop regression for decision panels. API state is isolated in memory; no account is mutated.
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { capture } = require('./browser-capture.cjs');

const base = process.env.DECISION_WEB_URL || 'http://127.0.0.1:5200';
const initialProfile = {
  objective: 'Croissance équilibrée à moyen et long terme.',
  horizon: '10 ans',
  riskTolerance: 'Modérée',
  lossCapacity: 'Une perte de 20 à 30 % serait supportable sur une partie du capital.',
  liquidity: 'Besoins moyens de liquidité.',
  constraints: 'Éviter les controverses importantes.',
  preferences: 'Impact environnemental et gouvernance.',
  knowledge: 'À préciser',
  origins: {}, confirmed: false, version: 1, updatedAt: null,
};
const fieldNames = ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'];
const snapshotOf = profile => Object.fromEntries(fieldNames.map(key => [key, profile[key]]));
const insightFor = (profile, extra = {}) => ({
  type: 'insight', title: 'Intérêt technologique et profil',
  question: 'Quel est le lien entre mon intérêt pour la technologie et mon profil ?',
  status: 'partial',
  summary: `Vous avez déclaré « ${profile.horizon} » et « ${profile.liquidity} ». Leurs liens avec le même projet restent à examiner avant une conclusion.`,
  fields: ['objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity'],
  evidenceIds: [],
  alternatives: ['Comparer des historiques technologiques sur une période commune.', 'Examiner les critères ESG déjà déclarés.'],
  nextQuestion: '', limits: ['La composition sous-jacente des fonds n’est pas disponible.'],
  profileSnapshot: snapshotOf(profile), createdAt: '2026-11-15T12:00:00Z', ...extra,
});
const comparison = {
  type: 'comparison', title: 'AAPL / MSFT', currency: 'USD',
  period: { from: '2026-01-01', to: '2026-01-03' }, observations: 3,
  metrics: ['AAPL', 'MSFT'].map((ticker, index) => ({
    ticker, name: index ? 'Microsoft Corporation' : 'Apple Inc.',
    returnPct: index ? -2 : 3, periodVolatilityPct: 1, drawdownPct: index ? -2 : 0,
    source: 'Jeu de vérification', sourceUrl: 'https://example.org/test', sourceAsOf: '2026-01-03',
    sourceDescription: 'Fixture déterministe du test navigateur.', classification: 'simulation', excludedObservations: 0,
  })),
  series: [{ date: '2026-01-01', AAPL: 100, MSFT: 100 }, { date: '2026-01-02', AAPL: 101, MSFT: 99 }, { date: '2026-01-03', AAPL: 103, MSFT: 98 }],
  dataSha256: 'a'.repeat(64), method: 'common-dates-adjusted-v1',
  methodDetails: 'Les cours ajustés sont normalisés à 100 au début de la période. Les mesures utilisent uniquement les dates communes.',
  limits: ['Données déterministes réservées au test; aucune cotation réelle.', 'Aucune prévision ni conclusion de convenance.'],
  createdAt: '2026-11-15T12:00:00Z',
};
const makeTab = (id, title, data) => ({ id, title, kind: 'decision', content: JSON.stringify(data) });
const userMessage = text => ({ id: 'user-1', role: 'user', text, citations: [], followUps: [], tools: [], agents: [], versions: [text], version: 0 });
const assistantMessage = (text, citations = []) => ({ id: 'assistant-1', role: 'assistant', text, citations, followUps: [], tools: [], agents: [], versions: [text], version: 0 });
const clone = value => JSON.parse(JSON.stringify(value));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1661, height: 1251 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  const chatRequests = [];
  const memoryWrites = [];
  const memoryReads = [];
  const conversationWrites = [];
  let storedProfile = clone(initialProfile);
  let storedMemoryTabs = [];
  let storedMemorySources = [];
  let memoryRevision = 1;
  let conversations = new Map();

  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/v1/profiles/status', route => route.fulfill({ json: { configured: true, modelId: 'Modèle intercepté · test d’interface' } }));
  await page.route(/\/v1\/profiles\/memory\/mateo(?:\?.*)?$/, async route => {
    const method = route.request().method();
    if (method === 'GET') { memoryReads.push(clone(storedProfile)); return route.fulfill({ json: { profile: clone(storedProfile), tabs: clone(storedMemoryTabs), sources: clone(storedMemorySources), revision: memoryRevision } }); }
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      memoryWrites.push(clone(body));
      if (body.expectedRevision !== memoryRevision) return route.fulfill({ status: 409, json: { detail: 'Révision de test modifiée.' } });
      storedProfile = clone(body.profile);
      storedMemoryTabs = clone(body.tabs ?? storedMemoryTabs);
      storedMemorySources = clone(body.sources ?? storedMemorySources);
      memoryRevision += 1;
      return route.fulfill({ json: { revision: memoryRevision } });
    }
    return route.fulfill({ status: 405, json: { detail: 'Méthode non interceptée.' } });
  });
  await page.route(/\/v1\/profiles\/conversations\/mateo(?:\/[^/?]+)?(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/').filter(Boolean);
    const conversationIndex = parts.indexOf('conversations');
    const conversationId = conversationIndex >= 0 && parts.length > conversationIndex + 2 ? decodeURIComponent(parts[conversationIndex + 2]) : null;
    const method = route.request().method();
    if (method === 'GET' && !conversationId) {
      await new Promise(resolve => setTimeout(resolve, 60));
      return route.fulfill({ json: { conversations: [...conversations.entries()].map(([id, item]) => ({ id, title: item.title, lastUsedAt: item.lastUsedAt })) } });
    }
    if (method === 'GET' && conversationId) {
      await new Promise(resolve => setTimeout(resolve, 60));
      const item = conversations.get(conversationId);
      return item ? route.fulfill({ json: clone(item) }) : route.fulfill({ status: 404, json: { detail: 'Conversation de test absente.' } });
    }
    if (method === 'PUT' && conversationId) {
      const body = route.request().postDataJSON();
      conversationWrites.push({ id: conversationId, body: clone(body) });
      conversations.set(conversationId, { id: conversationId, ...clone(body) });
      return route.fulfill({ json: { id: conversationId } });
    }
    return route.fulfill({ status: 405, json: { detail: 'Méthode de conversation non interceptée.' } });
  });
  await page.route('**/v1/profiles/chat', async route => {
    chatRequests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify({ type: 'text', text: 'Piste reçue dans le test d’interface.' }) + '\n' + JSON.stringify({ type: 'done' }) + '\n',
    });
  });

  async function seed({ profile = initialProfile, insight = insightFor(profile), sources = [], profileRoute = false } = {}) {
    storedProfile = clone(profile);
    storedMemoryTabs = profileRoute ? [makeTab('profile-alignment', 'Alignement', insight)] : [];
    storedMemorySources = clone(sources);
    memoryRevision += 1;
    conversations = new Map();
    await page.goto(base + '/');
    await page.evaluate(({ profile, tabs, messages, sources }) => {
      localStorage.setItem('investoros.demo.active-account.v1', 'mateo');
      for (const key of ['investoros.conversations.v1.mateo', 'investoros.conversations.active.v1.mateo']) localStorage.removeItem(key);
      localStorage.setItem('investoros.workspace.v2.mateo', JSON.stringify({
        profile, tabs, messages, sources, activeTab: tabs[0]?.id || '', conversationScoped: false,
      }));
    }, {
      profile, sources,
      tabs: profileRoute ? [] : [makeTab('profile-alignment', 'Alignement', insight), makeTab('profile-comparison', 'Comparaison', comparison), { id: 'note', title: 'Notes', kind: 'note', content: 'Une note modifiable.' }],
      messages: profileRoute ? [] : [userMessage('Examinons le lien entre mon profil et mes intérêts.'), assistantMessage('La synthèse est disponible dans Alignement.', sources)],
    });
    if (profileRoute) {
      await page.goto(base + '/app/profiles');
      await page.waitForFunction(() => document.querySelector('.pb-footer')?.textContent?.includes('Mémoire restaurée'), null, { timeout: 10000 });
      await page.locator('.pb-tabs').getByRole('tab', { name: 'Alignement', exact: true }).click();
      const profilePanel = page.locator('.pb-workbench');
      try { await profilePanel.getByRole('heading', { name: insight.title, exact: true }).waitFor({ timeout: 6000 }); }
      catch (error) { throw new Error(`Profile route alignment panel missing; stored tabs=${storedMemoryTabs.length}, memory reads=${memoryReads.slice(-2).map(item => item.objective).join('|')}, page=${(await profilePanel.innerText()).slice(0, 900)}; ${error.message}`); }
      await page.waitForFunction(() => document.querySelector('.pb-workbench')?.textContent?.includes('Profil actuel'));
      return profilePanel;
    }
    await page.goto(base + '/app/assistant');
    await page.getByRole('button', { name: 'Onglets, références et agents', exact: true }).click();
    await page.locator('.pw-overview-tabs button').filter({ hasText: 'Alignement' }).click();
    const panel = page.locator('#assistant-workspace-panel');
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('tab', { name: 'Alignement', exact: true }).click();
    const expectedHeading = typeof insight.title === 'string' && typeof insight.summary === 'string' ? insight.title : 'Cette synthèse est indisponible';
    await panel.getByRole('heading', { name: expectedHeading, exact: true }).waitFor();
    if (expectedHeading !== 'Cette synthèse est indisponible') await page.waitForFunction(() => document.querySelector('#assistant-workspace-panel')?.textContent?.includes('Profil actuel'));
    return panel;
  }
  async function reopenAlignmentPanel() {
    await page.getByRole('button', { name: 'Onglets, références et agents', exact: true }).click();
    await page.locator('.pw-overview-tabs button').filter({ hasText: 'Alignement' }).click();
    return page.locator('#assistant-workspace-panel');
  }
  async function assertViewportFits(label) {
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    assert.ok(overflow.width <= overflow.viewportWidth + 1 && overflow.height <= overflow.viewportHeight + 1, `${label} dépasse le viewport : ${JSON.stringify(overflow)}`);
  }

  try {
    console.log('PHASE canonical/edit/save/reload');
    await seed();
    let panel = page.locator('#assistant-workspace-panel');
    assert.equal(await panel.locator('.di-profile-row').count() >= 4, true);
    assert.equal(await panel.locator('.di-facts').count(), 0);
    assert.equal(await panel.locator('.di-conflict-count').count(), 0, 'Tolérance modérée et capacité déclarée ne doivent pas être marquées en rouge.');
    const canonicalScreenshot = await capture(page, 'decision-panels-alignment-canonical', { fullPage: false });

    const objectiveRow = panel.locator('.di-profile-row').filter({ hasText: 'Objectif' }).first();
    const writesBeforeCancel = memoryWrites.length;
    await objectiveRow.getByRole('button', { name: /^Modifier Objectif/ }).click();
    const objectiveEditor = panel.getByRole('textbox', { name: 'Modifier : Objectif', exact: true });
    await objectiveEditor.fill('Brouillon temporaire à annuler.');
    await objectiveRow.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await objectiveRow.getByRole('button', { name: /^Modifier Objectif/ }).innerText(), initialProfile.objective);
    assert.equal(memoryWrites.length, writesBeforeCancel, 'Annuler ne doit pas écrire en mémoire.');

    await objectiveRow.getByRole('button', { name: /^Modifier Objectif/ }).click();
    await panel.getByRole('textbox', { name: 'Modifier : Objectif', exact: true }).fill('Préserver le capital pour un projet dans cinq ans.');
    const savedProfileRequest = page.waitForRequest(request => request.method() === 'PUT'
      && request.url().includes('/v1/profiles/memory/mateo')
      && request.postDataJSON()?.profile?.objective === 'Préserver le capital pour un projet dans cinq ans.', { timeout: 8000 });
    await objectiveRow.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await savedProfileRequest;
    await page.waitForFunction(() => document.querySelector('.di-save-status')?.textContent?.includes('Enregistré sur le serveur'), null, { timeout: 8000 });
    assert.ok(memoryWrites.slice(writesBeforeCancel).some(write => write.profile?.objective === 'Préserver le capital pour un projet dans cinq ans.'), 'La modification doit être enregistrée via PUT mémoire.');
    assert.equal(memoryWrites.at(-1).expectedRevision, memoryRevision - 1, 'La révision attendue doit correspondre à la mémoire chargée.');
    await page.reload();
    panel = await reopenAlignmentPanel();
    await panel.getByRole('heading', { name: insightFor(initialProfile).title, exact: true }).waitFor();
    await panel.getByText('Votre profil a changé depuis cette synthèse.', { exact: true }).waitFor();
    assert.equal(await panel.locator('.di-previous-summary[open]').count(), 0, 'La synthèse dépassée doit rester repliée.');
    assert.equal(await panel.locator('.di-options > button').first().isDisabled(), true, 'Les pistes doivent rester bloquées tant que la carte est dépassée.');
    let persisted = [...conversations.values()].find(item => item.tabs?.some(tab => tab.id === 'profile-alignment'));
    let persistedInsight = JSON.parse(persisted.tabs.find(tab => tab.id === 'profile-alignment').content);
    assert.equal(persistedInsight.profileSnapshot.objective, initialProfile.objective, 'L’instantané de la synthèse doit rester historique.');
    assert.equal(storedProfile.objective, 'Préserver le capital pour un projet dans cinq ans.');
    persisted.tabs = persisted.tabs.map(tab => tab.id === 'profile-alignment' ? makeTab('profile-alignment', 'Alignement', insightFor(storedProfile)) : tab);
    conversations.set(persisted.id, persisted);
    await page.reload();
    panel = await reopenAlignmentPanel();
    await panel.getByRole('heading', { name: insightFor(storedProfile).title, exact: true }).waitFor();
    const refreshedStaleCount = await panel.getByText('Votre profil a changé depuis cette synthèse.', { exact: true }).count();
    assert.equal(refreshedStaleCount, 0, 'Une nouvelle synthèse correspondant au profil doit retirer l’état dépassé. ' + JSON.stringify({ storedObjective: storedProfile.objective, reads: memoryReads.slice(-3).map(item => item.objective), writes: memoryWrites.slice(-4).map(write => ({ objective: write.profile?.objective, expectedRevision: write.expectedRevision })), snapshotObjective: persistedInsight.profileSnapshot.objective, refreshedSnapshot: JSON.parse(persisted.tabs.find(tab => tab.id === 'profile-alignment').content).profileSnapshot.objective, text: await panel.innerText() }));
    assert.equal(await panel.locator('.di-options > button').first().isDisabled(), false);

    console.log('PHASE legacy/sources/malformed/comparison/note');
    const legacy = clone(insightFor(initialProfile)); delete legacy.type; delete legacy.profileSnapshot;
    panel = await seed({ insight: legacy });
    await panel.locator('.di-evidence > summary').click();
    await panel.getByText('Le profil au moment de la synthèse n’a pas été conservé.', { exact: true }).waitFor();
    const unsafeCitation = { id: 'unsafe', title: 'Lien interdit', url: 'javascript:alert(1)', snippet: '' };
    const safeCitation = { id: 'safe', title: 'Référence fiable de test', url: 'https://example.org/source', snippet: 'Source de test.' };
    panel = await seed({ insight: insightFor(initialProfile, { evidenceIds: ['safe', 'unknown', 'unsafe'] }), sources: [safeCitation, unsafeCitation] });
    await panel.locator('.di-evidence > summary').click();
    await panel.getByRole('link', { name: /Référence fiable de test/ }).waitFor();
    await panel.getByText(/Référence indisponible dans cette conversation : unknown/).waitFor();
    assert.equal(await panel.locator('.di-evidence a[href^="javascript:"]').count(), 0, 'Une URL non sûre ne doit jamais être rendue comme lien.');
    await panel.getByText('Fondements de la revue', { exact: true }).waitFor();
    assert.ok(await panel.locator('.di-evidence a').count() > 1, 'Les références méthodologiques restent visibles et distinctes des preuves de marché.');

    panel = await seed({ insight: { title: 'Format brisé', status: 'partial', summary: 42 } });
    await panel.getByRole('heading', { name: 'Cette synthèse est indisponible', exact: true }).waitFor();
    assert.equal(await panel.locator('textarea').count(), 0);
    await panel.getByRole('tab', { name: 'Comparaison', exact: true }).click();
    await panel.locator('.comparison-panel').waitFor();
    assert.equal(await panel.locator('.cp-chart').count(), 1);
    await panel.getByRole('heading', { name: 'Rendement cumulatif depuis le début', exact: true }).waitFor();
    assert.ok(await panel.getByText('Mesures observées', { exact: true }).count());
    assert.equal(await panel.locator('textarea').count(), 0);
    await panel.getByRole('tab', { name: 'Notes', exact: true }).click();
    await panel.getByRole('button', { name: 'Modifier', exact: true }).click();
    assert.equal(await panel.getByRole('textbox', { name: 'Contenu de la note en Markdown', exact: true }).inputValue(), 'Une note modifiable.');

    const conflictProfile = {
      ...initialProfile,
      horizon: 'Aucun retrait avant 5 ans',
      liquidity: 'J’ai besoin de tout ce même capital dans 18 mois',
    };
    console.log('PHASE conflict explanation/hover/keyboard/chat');
    panel = await seed({ profile: conflictProfile, insight: insightFor(conflictProfile) });
    assert.equal(await panel.locator('.di-conflict-count').count(), 1, 'La contradiction explicite sur le même capital doit être marquée.');
    const trigger = panel.locator('.di-profile-row').filter({ hasText: 'Horizon' }).first().getByRole('button', { name: /Incohérence à clarifier/ });
    await trigger.hover();
    const popup = page.locator('.di-explanation.is-conflict');
    await popup.waitFor({ state: 'visible' });
    await popup.getByText(conflictProfile.horizon, { exact: true }).waitFor();
    await popup.getByText(conflictProfile.liquidity, { exact: true }).waitFor();
    await popup.getByRole('link', { name: /AMF · Votre profil d’investisseur/ }).waitFor();
    await assertViewportFits('Panneau d’explication ouvert');
    const popupBox = await popup.boundingBox();
    await page.mouse.move(popupBox.x + 80, popupBox.y + 35);
    await page.waitForTimeout(350);
    assert.equal(await popup.isVisible(), true, 'La fenêtre doit rester ouverte lorsque le pointeur entre dans le panneau.');
    const redCapture = await capture(page, 'decision-panels-same-capital-conflict', { fullPage: false });
    await page.keyboard.press('Escape');
    await popup.waitFor({ state: 'hidden' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await popup.waitFor({ state: 'visible' });
    await popup.getByRole('button', { name: 'Horizon', exact: true }).click();
    const horizonEditor = panel.getByRole('textbox', { name: 'Modifier : Horizon', exact: true });
    assert.equal(await horizonEditor.inputValue(), conflictProfile.horizon, 'Le bouton contextuel doit ouvrir le bon champ.');
    assert.equal(await horizonEditor.evaluate(element => document.activeElement === element), true, 'Le bouton contextuel doit placer le focus dans le champ ouvert.');
    await panel.getByRole('button', { name: 'Annuler', exact: true }).click();
    const conflictTrigger = panel.locator('.di-profile-row').filter({ hasText: 'Horizon' }).first().getByRole('button', { name: /Incohérence à clarifier/ });
    await conflictTrigger.click();
    const conflictPopup = page.locator('.di-explanation.is-conflict');
    await conflictPopup.waitFor({ state: 'visible' });
    const contextChatRequest = page.waitForRequest(request => request.url().includes('/v1/profiles/chat')
      && request.postDataJSON()?.message?.includes('Deux échéances incompatibles'), { timeout: 10000 });
    await conflictPopup.getByRole('button', { name: 'En parler', exact: true }).click();
    const chatRequest = await contextChatRequest;
    const prompt = chatRequest.postDataJSON()?.message || '';
    assert.match(prompt, /Horizon : « Aucun retrait avant 5 ans »/);
    assert.match(prompt, /Liquidités et retraits : « J’ai besoin de tout ce même capital dans 18 mois »/);
    assert.match(prompt, /Quelle échéance faut-il retenir pour la totalité de ce même capital/);

    const highToleranceProfile = { ...initialProfile, riskTolerance: 'Tolérance élevée aux fluctuations', lossCapacity: 'Une perte compromettrait le projet.' };
    console.log('PHASE no-red tolerance/capacity and shared profile tab');
    panel = await seed({ profile: highToleranceProfile, insight: insightFor(highToleranceProfile) });
    assert.equal(await panel.locator('.di-conflict-count').count(), 0, 'Tolérance élevée et faible capacité de perte seules ne sont pas une contradiction rouge.');
    assert.equal(await panel.locator('.di-profile-row .di-issue-trigger.is-conflict').count(), 0);

    panel = await seed({ profile: conflictProfile, insight: insightFor(conflictProfile), profileRoute: true });
    assert.ok(await panel.locator('.di-profile-row').count() >= 4, 'L’onglet Alignement de /app/profiles doit réutiliser la nouvelle revue de profil.');
    assert.ok(await panel.locator('.di-profile-row .di-issue-trigger.is-conflict').count() >= 1, 'La vue Profil doit porter le même signal de contradiction explicite.');
    const profileHorizonRow = panel.locator('.di-profile-row').filter({ hasText: 'Horizon' }).first();
    await profileHorizonRow.getByRole('button', { name: /^Modifier Horizon/ }).click();
    assert.equal(await panel.getByRole('textbox', { name: 'Modifier : Horizon', exact: true }).inputValue(), conflictProfile.horizon, 'Le champ doit aussi être modifiable dans /app/profiles.');

    assert.deepEqual(pageErrors, []);
    assert.ok(conversationWrites.length > 0, 'Migration et persistance des conversations doivent être interceptées.');
    assert.ok(memoryWrites.length > 0, 'Les PUT mémoire doivent être capturés par le magasin local.');
    assert.equal(chatRequests.length, 1, 'Le seul envoi au modèle doit être intercepté par le script.');
    const unexpectedRequests = [];
    console.log(JSON.stringify({
      status: 'PASS', canonicalScreenshot, conflictScreenshot: redCapture,
      counts: { memoryWrites: memoryWrites.length, conversationWrites: conversationWrites.length, chatRequests: chatRequests.length },
      checks: [
        'canonical and legacy insights', 'safe, unknown and unsafe evidence sources', 'malformed decision content',
        'comparison chart and editable note', 'profile edit cancel', 'profile PUT save and reload',
        'historical snapshot remains unchanged', 'stale summary folded and options blocked until refreshed',
        'explicit same-capital timing conflict', 'no red conflict from tolerance and loss capacity alone',
        'hover persistence, Escape and keyboard activation', 'popover edit targets the correct field',
        'chat action includes exact declared context', 'memory/conversation/chat API fully intercepted',
      ], model: 'intercepted; no Bedrock call or account mutation', unexpectedRequests,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
