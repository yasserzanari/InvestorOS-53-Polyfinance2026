// Authenticated public-site/API check. Reads ignored test credentials; never prints tokens.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const ticker = process.env.SUPPLY_TICKER || 'NVDA';
const origin = process.env.INVESTOROS_DEPLOYED_ORIGIN || 'https://d10hypspu2l2nc.cloudfront.net';
const api = process.env.INVESTOROS_DEPLOYED_API || 'https://2u00myl9n1.execute-api.us-east-1.amazonaws.com';
const version = require('../agent-skills/catalog.json').version;
const secretsFile = process.env.COGNITO_TEST_SECRETS || 'apps/api/.env.codex-test.local';
(async () => {
  const secrets = Object.fromEntries(fs.readFileSync(secretsFile, 'utf8').split(/\r?\n/)
    .filter(line => line.includes('=') && !line.startsWith('#')).map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
    }));
  assert.ok(secrets.COGNITO_TEST_USERNAME && secrets.COGNITO_TEST_PASSWORD);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    await page.goto(origin + '/login');
    await page.getByLabel('Nom d’utilisateur', { exact: true }).fill(secrets.COGNITO_TEST_USERNAME);
    await page.getByLabel('Mot de passe', { exact: true }).fill(secrets.COGNITO_TEST_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.waitForURL('**/app**');
    const result = await page.evaluate(async ({ api, ticker, version }) => {
      const token = Object.entries(sessionStorage).find(([key]) => key.endsWith('.accessToken'))?.[1];
      if (!token) throw Error('Session de test absente.');
      const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      const read = async url => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const response = await fetch(url, { headers });
            if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
          } catch (error) { if (attempt === 3) throw error; }
          await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        }
      };
      const status = await (await read(api + '/v1/profiles/status')).json();
      if (status.skillsVersion !== version) throw Error('Snapshot publié différent du catalogue du checkout.');
      // A creation is never automatically replayed after an uncertain response.
      const launched = await fetch(api + '/v1/profiles/chat/jobs', {
        method: 'POST', headers, body: JSON.stringify({ accountId: 'mateo', workspaceMode: 'assistant', tabs: [],
          message: `Charge supply-chain et appelle inspect_supply_chain pour ${ticker}. Publie le tab dédié avec relations et revenus sourcés. Utilise les listes officielles et documents SEC; aucune recherche start_analysis ni note nécessaire.` }),
      });
      if (!launched.ok) throw Error('Création de tâche : HTTP ' + launched.status);
      const { jobId } = await launched.json();
      const events = [];
      let cursor = 0;
      const deadline = Date.now() + 365000;
      while (Date.now() < deadline) {
        const response = await read(`${api}/v1/profiles/chat/jobs/${jobId}?accountId=mateo&after=${cursor}`);
        if (!response.ok) throw Error('Lecture de tâche : HTTP ' + response.status);
        const state = await response.json();
        events.push(...state.events); cursor = state.nextCursor;
        if (['done', 'failed', 'cancelled'].includes(state.status)) return { version: status.skillsVersion, status: state.status, events };
        await new Promise(resolve => setTimeout(resolve, 900));
      }
      throw Error('Le parcours n’a pas terminé dans le délai autorisé.');
    }, { api, ticker, version });
    if (process.env.SUPPLY_TRACE_PATH) fs.writeFileSync(process.env.SUPPLY_TRACE_PATH, JSON.stringify(result, null, 2));
    assert.equal(result.status, 'done');
    assert.ok(result.events.some(event => event.type === 'done'));
    const errors = result.events.filter(event => event.type === 'error' || event.status === 'failed');
    assert.deepEqual(errors, []);
    const tab = result.events.flatMap(event => event.type === 'workspace' ? event.tabs || [] : []).filter(tab => tab.kind === 'network' && JSON.parse(tab.content).ticker?.toUpperCase() === ticker.toUpperCase()).at(-1);
    assert.ok(tab, 'Le document structuré doit être publié.');
    const data = JSON.parse(tab.content);
    const suppliers = data.entities.filter(entity => entity.kind === 'supplier');
    assert.ok(suppliers.length, 'Aucune relation acceptée pour cette entreprise de vérification.');
    assert.ok(data.evidence.length);
    assert.ok(suppliers.every(entity => entity.quote && entity.evidenceIds.length));
    assert.ok(!suppliers.some(entity => /underwrit|souscripteur|trustee|fiduciaire|obligataire/i.test(entity.detail)));
    const report = { ticker, version: result.version, status: result.status, suppliers: suppliers.length,
      financials: suppliers.filter(entity => entity.financials).length, events: data.events.length, sources: data.evidence.length,
      sourceTitles: data.evidence.map(source => source.title) };
    if (process.env.SUPPLY_REPORT_PATH) fs.writeFileSync(process.env.SUPPLY_REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
