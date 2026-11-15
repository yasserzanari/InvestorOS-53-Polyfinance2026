const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5175';
const profile = { objective: '', horizon: '', riskTolerance: '', lossCapacity: '', liquidity: '', constraints: '', preferences: '', knowledge: '', origins: {}, confirmed: false, version: 1, updatedAt: null };
const ndjson = (...events) => events.map(event => JSON.stringify(event)).join('\n') + '\n';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/v1/profiles/status', route => route.fulfill({ json: { configured: false } }));
    await page.route('**/v1/profiles/memory/*', route => route.request().method() === 'GET'
      ? route.fulfill({ json: { revision: 1, profile, tabs: [], sources: [] } })
      : route.fulfill({ json: { revision: 2, profile: route.request().postDataJSON().profile, tabs: [], sources: [] } }));
    await page.route('**/v1/profiles/chat', async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (requests.length === 1) {
        const request = {
          id: 'plan-approval-1',
          title: 'Valider le plan d’analyse',
          description: 'Analyse de NVDA pour la semaine à venir.',
          purpose: 'plan_approval',
          questions: [{
            id: 'launch-plan', label: 'Souhaites-tu lancer ce plan ?', kind: 'single_choice',
            required: true, allowOther: false,
            options: [
              { id: 'launch', label: 'Oui, lancer ce plan' },
              { id: 'modify', label: 'Modifier le plan' },
            ],
          }],
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson; charset=utf-8',
          body: ndjson(
            { type: 'plan', plan: { title: 'Analyse NVDA pour la semaine à venir', steps: [
              { id: 'calendar', title: 'Vérifier le calendrier officiel et les annonces confirmées.' },
              { id: 'documents', title: 'Examiner les publications récentes et les fondamentaux datés utiles.' },
              { id: 'risks', title: 'Mettre en regard les risques, éléments contraires et informations manquantes.' },
              { id: 'summary', title: 'Restituer les faits sourcés et les points à suivre, sans prévoir le cours.' },
            ] } },
            { type: 'text', delta: 'Je te propose ce plan pour comprendre les principaux éléments à surveiller pour NVDA la semaine à venir :\n\n1. Vérifier le calendrier officiel et les annonces confirmées.\n2. Examiner les publications récentes et les fondamentaux datés utiles.\n3. Mettre en regard les risques, éléments contraires et informations manquantes.\n4. Restituer les faits sourcés et les points à suivre, sans prévoir le cours.\n' },
            { type: 'questions', request },
            { type: 'done' },
          ),
        });
      } else if (requests.length === 2) {
        await route.fulfill({ status: 200, contentType: 'application/x-ndjson; charset=utf-8', body: ndjson({ type: 'text', delta: 'Le plan est validé. Je lance la recherche cadrée.' }, { type: 'done' }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson; charset=utf-8',
          body: ndjson(
            { type: 'text', delta: 'Le dépôt annuel confirme ce point [1].' },
            { type: 'sources', citations: [{ id: 'sec-10k', index: 1, title: 'Rapport annuel', url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000010/nvda-20260125.htm', snippet: 'Dépôt annuel de l’émetteur.' }] },
            { type: 'done' },
          ),
        });
      }
    });

    await page.goto(base);
    await page.evaluate(profile => {
      localStorage.clear();
      localStorage.setItem('investoros.workspace.v2.mateo', JSON.stringify({ profile, tabs: [], messages: [], researchRuns: [] }));
    }, profile);
    await page.goto(`${base}/app/assistant`);
    const composer = page.getByPlaceholder('Posez votre question…');
    await composer.fill('Analyse NVDA pour la semaine à venir.');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();

    await page.getByText('Vérifier le calendrier officiel et les annonces confirmées.', { exact: false }).waitFor();
    const questionCard = page.locator('.pw-plan-card[data-plan-state="awaiting-approval"]');
    await questionCard.getByRole('button', { name: 'Confirmer et lancer le plan de recherche' }).waitFor();
    assert.equal(requests.length, 1, 'Aucun second chat request ne doit partir avant le choix de la personne.');
    await questionCard.getByRole('button', { name: 'Confirmer et lancer le plan de recherche' }).click();

    await page.getByText('Confirmation envoyée', { exact: true }).waitFor();
    assert.equal(requests.length, 2, 'La validation explicite doit reprendre la conversation.');
    assert.equal(requests[1].questionRequest.purpose, 'plan_approval');
    assert.equal(requests[1].questionAnswer.answers[0].questionId, 'launch-plan');
    assert.deepEqual(requests[1].questionAnswer.answers[0].selectedOptionIds, ['launch']);
    const answerWithoutSources = page.locator('.pw-answer').last();
    assert.equal(await answerWithoutSources.getByRole('button', { name: /Références utilisées/ }).count(), 0, 'Aucune référence ne doit être affichée sans citation reçue.');

    await composer.fill('Montre-moi une réponse avec une source.');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    const citedAnswer = page.locator('.pw-answer').last();
    const references = citedAnswer.getByRole('button', { name: 'Références utilisées 1' });
    await references.waitFor();
    await references.click();
    await citedAnswer.getByRole('link', { name: /Rapport annuel/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: visible analysis plan, explicit approval, structured payload, and references shown only when cited');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
