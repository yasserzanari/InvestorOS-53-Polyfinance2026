const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const profile = { objective: 'Test', horizon: '', riskTolerance: '', lossCapacity: '', liquidity: '', constraints: '', preferences: '', knowledge: '', origins: {}, confirmed: false, version: 1, updatedAt: null };
const message = (id, text) => ({ id, role: 'user', text, citations: [], followUps: [], tools: [], agents: [], versions: [], version: 0 });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const analysisId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/v1/profiles/status', route => route.fulfill({ json: { configured: false } }));
    await page.route('**/v1/profiles/memory/*', route => route.request().method() === 'GET'
      ? route.fulfill({ json: { revision: 7, profile, tabs: [{ id: 'shared-profile', title: 'Profil partagé', kind: 'profile', content: '' }], sources: [] } })
      : route.fulfill({ json: { revision: 8, profile: route.request().postDataJSON().profile, tabs: [{ id: 'shared-profile', title: 'Profil partagé', kind: 'profile', content: '' }], sources: [] } }));
    await page.route('**/v1/profiles/research/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.fulfill({ json: { analysis_id: analysisId, status: 'completed', events: [] } }).catch(() => {});
    });
    await page.goto(base);
    await page.evaluate(({ profile, a, b, analysisId }) => {
      localStorage.clear();
      const tabs = [{ id: 'profile', title: 'Profil', kind: 'profile', content: '' }, { id: 'a-note', title: 'Notes A', kind: 'note', content: 'Contenu A' }];
      const researchRuns = [{ analysis_id: analysisId, status: 'running' }];
      localStorage.setItem('investoros.workspace.v2.mateo', JSON.stringify({ profile, tabs, messages: [a], researchRuns }));
      localStorage.setItem('investoros.conversations.active.v1.mateo', 'a');
      localStorage.setItem('investoros.conversations.v1.mateo', JSON.stringify([
        { id: 'a', title: 'Conversation A', lastUsedAt: Date.now(), messages: [a] },
        { id: 'b', title: 'Conversation B', lastUsedAt: Date.now(), messages: [b], tabs: [{ id: 'b-note', title: 'Notes B', kind: 'note', content: 'Contenu B' }], researchRuns: [], activeTab: 'b-note' },
        { id: 'legacy', title: 'Ancien chat', lastUsedAt: Date.now(), messages: [b] },
      ]));
    }, { profile, a: message('a-message', 'Conversation A'), b: message('b-message', 'Conversation B'), analysisId });
    await page.goto(`${base}/app/assistant`);
    const showTab = async title => {
      const tab = title ? page.getByRole('tab', { name: title, exact: true }) : null;
      if (tab && await tab.count()) return;
      const button = page.getByRole('button', { name: 'Onglets, références et agents', exact: true });
      if (!(await button.count())) {
        if (tab) await tab.waitFor();
        return;
      }
      await button.click();
      const overview = page.getByRole('region', { name: 'Résumé de la conversation' });
      if (title) await overview.locator('.pw-overview-tabs li').filter({ hasText: title }).getByRole('button').click();
      else await overview.getByRole('button', { name: 'Ouvrir l’espace de travail', exact: true }).click();
    };
    const open = async title => {
      await page.getByRole('button', { name: 'Historique', exact: true }).click();
      await page.getByRole('region', { name: 'Historique des conversations' }).getByRole('button', { name: title }).click();
    };
    await showTab('Notes A');
    await page.getByRole('tab', { name: 'Notes A', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Profil', exact: true }).count(), 0, 'Legacy mandatory profile removed');
    await open('Conversation B');
    await page.getByRole('tab', { name: 'Notes B', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Notes A', exact: true }).count(), 0);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('investoros.workspace.v2.mateo')).researchRuns.length), 0, 'Old research polling must not modify the new chat');
    await page.getByRole('textbox', { name: 'Contenu de l’onglet', exact: true }).fill('Modification B');
    await page.reload();
    await showTab('Notes B');
    assert.equal(await page.getByRole('textbox', { name: 'Contenu de l’onglet', exact: true }).inputValue(), 'Modification B');
    await open('Conversation A');
    await page.getByRole('tab', { name: 'Notes A', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Contenu de l’onglet', exact: true }).inputValue(), 'Contenu A');
    await page.getByRole('button', { name: 'Nouvelle conversation', exact: true }).click();
    await showTab();
    assert.equal(await page.getByRole('tab').count(), 0, 'New conversation starts without inherited tabs');
    await page.getByRole('button', { name: 'Ouvrir le profil', exact: true }).click();
    await page.getByRole('tab', { name: 'Profil', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fermer Profil', exact: true }).click();
    assert.equal(await page.getByRole('tab').count(), 0, 'Profile is optional and closable');
    await page.getByRole('button', { name: 'Ajouter des notes', exact: true }).click();
    await page.getByRole('textbox', { name: 'Titre de l’onglet', exact: true }).fill('Notes C');
    await open('Conversation B');
    await page.getByRole('tab', { name: 'Notes B', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Notes C', exact: true }).count(), 0);
    await open('Ancien chat');
    assert.equal(await page.getByRole('tab').count(), 0, 'History without a workspace must not borrow another conversation’s tabs');
    assert.deepEqual(errors, []);
    console.log('PASS: conversation tabs, legacy migration, optional profile, reload persistence, research isolation and immediate switching');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
