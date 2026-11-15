const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const base=process.env.WIDGET_WEB_URL||'http://127.0.0.1:5199';
const output=path.resolve('docs/agentic/chat-financial-widgets/controls');
const storageKey='investoros.workspace.v2.robert';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1518,height:1036}});
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/app/assistant');
  const input=JSON.parse(fs.readFileSync('docs/agentic/chat-financial-widgets/final/portfolio-response.json'));
  await p.evaluate(async({prompt,message})=>{
   const {initialProfiles}=await import('/src/features/profiles/profile-model.ts');
   localStorage.setItem('investoros.demo.active-account.v1','robert');
   localStorage.setItem('investoros.workspace.v2.robert',JSON.stringify({profile:initialProfiles.robert,tabs:[],conversationScoped:true,messages:[{id:'controls-prompt',role:'user',text:prompt,tools:[],agents:[],citations:[],followUps:[],versions:[],version:0},message]}));
  },input);
  await p.reload();await p.locator('.financial-widget').waitFor();
  await p.locator('.financial-widget').getByRole('button',{name:'1A',exact:true}).click();
  const read=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  assert.equal((await read()).messages.at(-1).widgets[0].period,'1Y');
  await p.reload();await p.locator('.financial-widget').waitFor();
  assert.equal(await p.locator('.financial-widget').getByRole('button',{name:'1A',exact:true}).getAttribute('aria-pressed'),'true');
  const prompt='Affiche les contributions de chaque position sur la période que je viens de sélectionner.';
  await p.getByRole('textbox',{name:'Message à l’assistant',exact:true}).fill(prompt);
  await p.getByRole('button',{name:'Envoyer le message',exact:true}).click();
  await p.waitForFunction(key=>{const m=JSON.parse(localStorage.getItem(key)).messages.at(-1);return m.error||m.role==='assistant'&&m.text&&m.versions.length>0;},storageKey,{timeout:120000});
  const response=(await read()).messages.at(-1);
  assert.ok(!response.error,response.error);
  const call=response.tools.find(tool=>tool.name==='render_portfolio_widget'&&tool.status==='done');
  assert.ok(call,'The model executed the requested tool');
  assert.equal(call.input.view,'contributions');assert.equal(call.input.period,'1Y');
  fs.writeFileSync(path.join(output,'selected-period-response.json'),JSON.stringify({prompt,response},null,2));
  await p.locator('select.account-switcher').selectOption('amira');
  await p.waitForTimeout(350);assert.equal(await p.locator('.financial-widget').count(),0);
  await p.locator('select.account-switcher').selectOption('robert');
  await p.waitForTimeout(350);assert.equal(await p.locator('.financial-widget').count(),2);
  await p.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));for(const m of state.messages){if(m.widgets)m.widgets=m.widgets.map(w=>({...w,kind:'broken'}));if(m.widgetVersions)m.widgetVersions=m.widgetVersions.map(items=>items.map(w=>({...w,kind:'broken'})));}localStorage.setItem(key,JSON.stringify(state));},storageKey);
  await p.reload();await p.getByRole('alert').first().waitFor();assert.equal(await p.locator('.financial-widget').count(),0);assert.deepEqual(errors,[]);
  const result={periodPersisted:true,modelUsedSelectedPeriod:call.input.period,accountIsolation:true,invalidCacheReported:true,errors};
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
