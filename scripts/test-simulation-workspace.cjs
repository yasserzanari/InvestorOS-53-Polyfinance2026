const { chromium } = require(require.resolve('@playwright/test', { paths: [require('node:path').join(__dirname, '../apps/web')] }));
const assert = require('node:assert/strict');
const { capture } = require('./browser-capture.cjs');
const base = process.env.INVESTOROS_TEST_URL || 'http://127.0.0.1:5175';
const analysisId = process.env.INVESTOROS_TEST_ANALYSIS_ID;
if (!analysisId) throw new Error('INVESTOROS_TEST_ANALYSIS_ID must identify a completed NVDA analysis for Mateo.');
const cacheKey = `investoros.analysis.simulation.v1.mateo.${analysisId}`;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1757, height: 1183 } });
    const errors = []; const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST') requests.push({ url: request.url(), body: request.postDataJSON() }); });
    const workspace = page.locator('.sw-root');
    async function settled() {
      await workspace.getByText('Trajectoires actualisées', { exact: true }).waitFor({ timeout: 60000 });
      return page.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey);
    }
    function ratio(result, id, expected) {
      const reference = result.branches.find(branch => branch.id === 'reference');
      const branch = result.branches.find(branch => branch.id === id);
      assert(Math.abs(branch.path.at(-1).medianPrice / reference.path.at(-1).medianPrice - expected) < 0.00001);
      assert(Math.abs(branch.path.at(-1).lowerPrice / reference.path.at(-1).lowerPrice - expected) < 0.00001);
      return branch;
    }
    await page.goto(`${base}/app/assistant?analysis_id=${encodeURIComponent(analysisId)}`);
    await page.getByRole('heading', { name: 'NVDA · explorer l’analyse' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Simulations', exact: true }).click();
    let result = await settled();
    assert.equal(result.model, 'empirical-bootstrap-v1');
    assert.equal(result.horizonObservations, 5);
    assert.equal(result.branches.length, 1);
    assert.equal(await page.locator('.rr-root').count(), 0, 'Research report should not duplicate the simulation workspace');
    assert.equal(await workspace.locator('.recharts-line-curve').count(), 1);
    assert.equal(await workspace.locator('.recharts-area-area').count(), 1);

    await workspace.getByRole('button', { name: 'Ajouter un scénario', exact: false }).click();
    await settled();
    await workspace.getByRole('textbox', { name: 'Nom du scénario' }).fill('Résultats décevants');
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('-8');
    result = await settled();
    const downId = result.branches[1].id;
    ratio(result, downId, 0.92);
    assert.equal(result.branches[1].title, 'Résultats décevants');
    await workspace.getByRole('slider', { name: 'Moment d’application', exact: true }).fill('3');
    result = await settled();
    assert.equal(result.branches[1].eventAfterObservations, 3);
    assert.equal(result.branches[1].path[2].medianPrice, result.branches[0].path[2].medianPrice);
    assert(result.branches[1].path[3].medianPrice < result.branches[0].path[3].medianPrice);

    const options = await workspace.getByRole('combobox', { name: 'Événement associé' }).locator('option').all();
    assert(options.length > 1);
    await workspace.getByRole('combobox', { name: 'Événement associé' }).selectOption(await options[1].getAttribute('value'));
    result = await settled();
    assert(result.branches[1].sourceUrl.startsWith('https://'));
    await workspace.locator('.sw-event').click();
    await page.locator('.aj-dialog[open]').waitFor();
    assert((await page.locator('.aj-dialog[open] a').first().getAttribute('href')).startsWith('https://'));
    await page.getByRole('button', { name: 'Fermer la fiche', exact: true }).click();

    await workspace.getByRole('button', { name: 'Ajouter un scénario', exact: false }).click();
    await settled();
    await workspace.getByRole('textbox', { name: 'Nom du scénario' }).fill('Demande plus forte');
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('5');
    result = await settled();
    const upId = result.branches[2].id;
    ratio(result, upId, 1.05);
    assert.equal(await workspace.locator('.recharts-line-curve').count(), 3);
    const plot = workspace.locator('.sw-chart .recharts-wrapper');
    const plotBox = await plot.boundingBox();
    await page.mouse.move(plotBox.x + plotBox.width * 0.6, plotBox.y + plotBox.height * 0.5);
    await workspace.locator('.sw-tooltip').waitFor();
    assert.match(await workspace.locator('.sw-tooltip').innerText(), /Résultats décevants/);
    await workspace.getByRole('button', { name: '20 séances', exact: true }).click();
    result = await settled();
    assert.equal(result.horizonObservations, 20);
    assert.equal(result.branches[0].path.length, 21);
    ratio(result, downId, 0.92); ratio(result, upId, 1.05);
    const desktop = await capture(page, 'investoros-simulations-comparison');

    await workspace.getByRole('button', { name: /^Données et méthode ·/ }).click();
    await page.locator('.source-details-dialog[open]').waitFor();
    assert.match(await page.locator('.source-details-dialog[open]').innerText(), /2 000 trajectoires/);
    await page.getByRole('button', { name: 'Fermer les sources', exact: true }).click();
    await workspace.locator('.sw-details').last().locator('summary').click();
    await workspace.getByRole('button', { name: 'Explorer le jalon 20', exact: true }).click();
    await page.locator('.aj-dialog[open]').waitFor();
    assert.match(await page.locator('.aj-dialog[open]').innerText(), /Médiane conditionnelle/);
    await page.getByRole('button', { name: 'Fermer la fiche', exact: true }).click();
    await workspace.locator('.sw-details').last().locator('summary').click();

    // Fault injection checks a real request's recovery and prevents accepting mismatched results.
    await page.route('**/v1/simulation/forecast', route => route.fulfill({ status: 503, body: 'Test-only outage' }));
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('6');
    await workspace.getByRole('alert').waitFor();
    assert.match(await workspace.getByRole('alert').innerText(), /503/);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).branches.at(-1).shockPct, cacheKey), 5);
    assert.equal(await workspace.getByText('Trajectoires actualisées', { exact: true }).count(), 0);
    await page.unroute('**/v1/simulation/forecast');
    await workspace.getByRole('button', { name: 'Réessayer', exact: false }).click();
    result = await settled(); ratio(result, upId, 1.06);

    await page.route('**/v1/simulation/forecast', async route => {
      const response = await route.fetch();
      const body = await response.json(); body.horizonObservations = 5;
      await route.fulfill({ json: body });
    });
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('7');
    await workspace.getByRole('alert').waitFor();
    assert.match(await workspace.getByRole('alert').innerText(), /ne correspond pas/);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).branches.at(-1).shockPct, cacheKey), 6);
    await page.unroute('**/v1/simulation/forecast');
    await workspace.getByRole('button', { name: 'Réessayer', exact: false }).click();
    await settled();

    // The first in-flight request is intentionally delayed; its aborted response must not win.
    let firstStarted;
    const started = new Promise(resolve => { firstStarted = resolve; });
    await page.route('**/v1/simulation/forecast', async route => {
      const body = route.request().postDataJSON();
      if (body.branches.at(-1).shockPct !== 8) return route.continue();
      const response = await route.fetch(); firstStarted();
      await new Promise(resolve => setTimeout(resolve, 1400));
      try { await route.fulfill({ response }); } catch { /* The UI cancels the outdated request. */ }
    });
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('8');
    await started;
    await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).fill('9');
    result = await settled(); ratio(result, upId, 1.09);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).branches.at(-1).shockPct, cacheKey), 9);
    await page.unroute('**/v1/simulation/forecast');

    await page.reload();
    await page.getByRole('button', { name: 'Onglets, références et agents', exact: true }).click();
    await page.locator('.pw-overview-tabs').getByRole('button', { name: /Résultats de recherche/ }).click();
    await page.getByRole('heading', { name: 'NVDA · explorer l’analyse' }).waitFor();
    await page.getByRole('button', { name: 'Simulations', exact: true }).click();
    result = await settled();
    assert.equal(result.branches.length, 3); assert.equal(result.horizonObservations, 20);
    ratio(result, upId, 1.09);
    await workspace.locator('.sw-scenario').filter({ hasText: 'Demande plus forte' }).click();
    await workspace.getByRole('button', { name: 'Supprimer Demande plus forte', exact: true }).click();
    result = await settled(); assert.equal(result.branches.length, 2);

    await page.getByRole('button', { name: 'Événements', exact: true }).click();
    await page.locator('.aj-events>button').first().click();
    await page.getByRole('button', { name: 'Tester un scénario', exact: true }).click();
    await settled();
    assert.equal(await workspace.getByRole('textbox', { name: 'Nom du scénario' }).inputValue(), 'Résultats décevants');
    assert.equal(await workspace.getByRole('spinbutton', { name: 'Variation testée (%)' }).inputValue(), '-8');

    await page.setViewportSize({ width: 390, height: 844 });
    await workspace.locator('.sw-scenario').filter({ hasText: 'Résultats décevants' }).click();
    await workspace.getByRole('slider', { name: 'Ajuster la variation', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    result = await settled(); ratio(result, downId, 0.925);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Mobile page overflow');
    await workspace.scrollIntoViewIfNeeded();
    const mobile = await capture(page, 'investoros-simulations-mobile');
    assert.equal(requests.filter(request => /\/profiles\/research(?:\?|$)/.test(request.url)).length, 0, 'Simulation must not launch a new research run');
    await page.setViewportSize({ width: 1431, height: 1056 });
    await page.goto(`${base}/app/analyses?analysis_id=${encodeURIComponent(analysisId)}`);
    await page.getByRole('button', { name: 'Simulations', exact: true }).click();
    result = await settled();
    assert.equal(result.horizonObservations, 20);
    assert.equal(await page.locator('.ad-report').count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'passed', actualBootstrap: true, referenceAndTwoHypotheses: true, eventSource: true, shockAndTiming: true, horizon: true, sourceAndPointDialogs: true, outageRetryAndWrongResultRejection: true, staleRequestCancellation: true, persistenceAndRemoval: true, mobileKeyboard: true, errors, captures: [desktop, mobile] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
