const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { capture } = require('./browser-capture.cjs');

const base = process.env.WIDGET_WEB_URL || 'http://127.0.0.1:5198';
const output = path.resolve(process.env.WIDGET_OUTPUT || 'docs/agentic/chat-financial-widgets/browser');
const cases = [
  ['portfolio', 'Montre mon portefeuille et son évolution sur un mois dans le chat.'],
  ['heatmap', 'Montre mes positions dans une carte de chaleur interactive sur un jour.'],
  ['allocation', 'Montre où est mon argent dans un graphique de répartition interactif.'],
  ['contributions', 'Montre les gains et pertes apportés par chaque position sur une semaine.'],
  ['sectors', 'Montre les variations par secteur de mon portefeuille sur un mois.'],
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const summaries = [];
  try {
    for (const [view, prompt] of cases) {
      if(process.env.WIDGET_VIEWS&&!process.env.WIDGET_VIEWS.split(',').includes(view))continue;
      const context = await browser.newContext({ viewport: { width: 1518, height: 1036 } });
      await context.addInitScript(() => {
        localStorage.setItem('investoros.demo.active-account.v1', 'robert');
        localStorage.setItem('investoros.sidebar.collapsed', 'true');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/app/assistant');
      const textbox = page.getByRole('textbox', { name: 'Message à l’assistant', exact: true });
      await textbox.waitFor();
      await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Message à l’assistant"]')?.disabled);
      await textbox.fill(prompt);
      await page.getByRole('button', { name: 'Envoyer le message', exact: true }).click();
      await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem('investoros.workspace.v2.robert') || '{}');
        const message = state.messages?.at(-1);
        return message?.error || message?.versions?.length > 0;
      }, undefined, { timeout: 120000 });
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('investoros.workspace.v2.robert') || '{}'));
      const message = state.messages.at(-1);
      fs.writeFileSync(path.join(output, view + '-response.json'), JSON.stringify({ prompt, message }, null, 2));
      assert.ok(!message.error, message.error);
      assert.ok(message.widgets?.some(widget => widget.view === view), 'Expected inline widget ' + view);
      const widget = page.locator('.financial-widget');
      await widget.waitFor();
      assert.equal(await widget.count(), 1);
      const periodButtons = widget.getByRole('group', { name: 'Période des données' }).getByRole('button');
      assert.equal(await periodButtons.count(), 4);
      await periodButtons.nth(3).click();
      assert.equal(await periodButtons.nth(3).getAttribute('aria-pressed'), 'true');
      await periodButtons.nth(view === 'heatmap' ? 0 : view === 'contributions' ? 1 : 2).click();
      await widget.getByRole('button', { name: /^Agrandir / }).click();
      await page.locator('dialog[open]').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      if (view === 'allocation') {
        const items = widget.locator('.fw-allocation-legend button');
        await items.nth(1).click();
        assert.equal(await items.nth(1).getAttribute('aria-pressed'), 'true');
        await widget.getByRole('button', { name: 'Par secteur', exact: true }).click();
        await widget.getByRole('button', { name: 'Par actif', exact: true }).click();
      }
      await page.waitForTimeout(1700);
      const fit = await page.evaluate(() => ({ vertical: document.documentElement.scrollHeight <= innerHeight + 1, horizontal: document.documentElement.scrollWidth <= innerWidth + 1 }));
      assert.ok(fit.vertical && fit.horizontal, JSON.stringify(fit));
      assert.deepEqual(errors, []);
      await page.locator('.pw-messages > div').last().evaluate(element => { element.scrollTop = 0; });
      await page.mouse.move(1400, 80);
      await page.waitForTimeout(250);
      const bounds=await widget.boundingBox();
      const composer=await page.locator('.pw-composer').boundingBox();
      assert.ok(bounds.y>=60&&bounds.y+bounds.height<=composer.y, 'Widget fits above composer: '+JSON.stringify({bounds,composer}));
      const screenshot = await capture(page, 'financial-widget-' + view, { fullPage: false });
      const destination = path.join(output, path.basename(screenshot));
      const temporary = destination + '.tmp';
      fs.copyFileSync(screenshot, temporary);
      fs.renameSync(temporary, destination);
      const summary = { view, prompt, response: message.text, screenshot: destination, errors, fit };
      summaries.push(summary);
      fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summaries, null, 2));
      console.log(JSON.stringify(summary));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
