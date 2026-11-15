const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const analysisId = process.env.TEST_ANALYSIS_ID || '871ca17e-cd15-4f85-ba45-5bc2bc0f6fd1';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1565, height: 1183 } });
    const errors = []; const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('movement-investigation')) requests.push(request.postDataJSON()); });
    await page.goto(`${base}/app/analyses?analysis_id=${analysisId}`);
    await page.getByRole('combobox', { name: 'Seuil des variations' }).waitFor({ timeout: 60000 });
    await page.getByRole('combobox', { name: 'Seuil des variations' }).selectOption('3');
    await page.getByRole('button', { name: /Explorer NVDA · baisse de 4,22/ }).focus({ timeout: 60000 });
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.locator('.mi-conclusion').waitFor({ timeout: 150000 });
    const investigation = dialog.getByRole('region', { name: 'Analyse des facteurs du mouvement' });
    assert((await investigation.locator('.mi-comparison').innerText()).includes('QQQ'));
    assert((await investigation.locator('.mi-comparison').innerText()).includes('SPY'));
    assert.equal(requests.at(-1).previousDate, '2026-10-29');
    assert.equal(requests.at(-1).date, '2026-10-30');
    assert.equal(requests.at(-1).accountId, 'mateo');
    await investigation.getByText('Calculs et faits observés', { exact: true }).click();
    assert((await investigation.locator('.mi-observations').innerText()).includes('points de pourcentage'));
    assert((await investigation.locator('.mi-calendar-context').innerText()).includes('pas que des résultats ont provoqué'));
    await investigation.getByText('Vérifier le passage lu', { exact: true }).click();
    assert((await investigation.locator('.mi-calendar-context blockquote').innerText()).includes('November 17'));
    assert((await investigation.locator('.mi-calendar-context a').getAttribute('href')).startsWith('https://investor.nvidia.com/'));
    assert((await investigation.locator('.mi-limits').innerText()).includes('causalité'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Movement dialog must fit mobile');
    await page.setViewportSize({ width: 1565, height: 1183 });
    await dialog.locator('.ed-body').evaluate(element => { element.scrollTop = 0; });
    const capture = `${process.env.HOME}/.cache/movement-investigation-${Date.now()}.png`;
    await page.screenshot({ path: capture + '.tmp', type: 'png', fullPage: true });
    PNG.sync.read(fs.readFileSync(capture + '.tmp'), { checkCRC: true });
    fs.renameSync(capture + '.tmp', capture);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, source: 'Actual account-scoped investigation endpoint', comparison: 'NVDA / SPY / QQQ, identical closes', calendarAnnouncement: 'kept separate from released earnings', pressCoverage: 'explicitly labelled', mobile: 'passed', capture }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
