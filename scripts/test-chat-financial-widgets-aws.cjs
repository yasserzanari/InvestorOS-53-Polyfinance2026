// Exercises the deployed Cognito -> API Gateway -> Lambda -> Bedrock -> widget path.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const {capture}=require('./browser-capture.cjs');
const origin=process.env.WIDGET_AWS_ORIGIN||'https://d10hypspu2l2nc.cloudfront.net';
const api=process.env.WIDGET_AWS_API||'https://2u00myl9n1.execute-api.us-east-1.amazonaws.com';
const secretPath=process.env.INVESTOROS_TEST_ENV_PATH||'apps/api/.env.codex-test.local';
const output=path.resolve('docs/agentic/chat-financial-widgets/aws');
const cases=[['portfolio','Montre mon portefeuille et son évolution sur un mois dans le chat.'],['heatmap','Montre mes positions dans une carte de chaleur sur un jour.'],['allocation','Montre où est mon argent dans un graphique de répartition interactif.'],['contributions','Montre les gains et pertes apportés par chaque position sur une semaine.'],['sectors','Montre les variations par secteur de mon portefeuille sur un mois.']];
let phase='setup';
(async()=>{
 assert.equal(fs.statSync(secretPath).mode&0o077,0,'The test credential file must remain private');
 const secrets=Object.fromEntries(fs.readFileSync(secretPath,'utf8').split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2')]}));
 assert.equal(secrets.COGNITO_TEST_USERNAME,'codex-agent-test-mwhuq4wc');
 assert.ok(secrets.COGNITO_TEST_PASSWORD);
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
 const results=[];
 try{
  const context=await browser.newContext({viewport:{width:1518,height:1036}});
  await context.addInitScript(()=>localStorage.setItem('investoros.demo.active-account.v1','robert'));
  const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  phase='login';await page.goto(origin+'/login');
  await page.getByLabel('Nom d’utilisateur',{exact:true}).fill(secrets.COGNITO_TEST_USERNAME);
  await page.getByLabel('Mot de passe',{exact:true}).fill(secrets.COGNITO_TEST_PASSWORD);
  await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.waitForURL('**/app**');
  phase='protected API';
  const access=await page.evaluate(async api=>{
   const token=Object.entries(sessionStorage).find(([key])=>key.endsWith('.accessToken'))?.[1];if(!token)throw Error('No authenticated test session');
   const checks=[];let skillsVersion;
   for(const route of ['/v1/profiles/status','/v1/profiles/memory/robert','/v1/simulation/assets']){
    const response=await fetch(api+route,{headers:{Authorization:'Bearer '+token}});const body=await response.json();checks.push({route,status:response.status});if(route.endsWith('/status'))skillsVersion=body.skillsVersion;
   }
   const denied=await fetch(api+'/v1/profiles/status');return {checks,unauthenticatedStatus:denied.status,skillsVersion};
  },api);
  assert.ok(access.checks.every(check=>check.status===200),JSON.stringify(access));assert.equal(access.unauthenticatedStatus,401);assert.equal(access.skillsVersion,'1.8.19');
  console.log('Protected API',JSON.stringify(access));
  for(const [view,prompt] of cases){
   phase=view;
   await page.evaluate(()=>{for(const key of ['investoros.workspace.v2.robert','investoros.conversations.v1.robert','investoros.conversations.active.v1.robert'])localStorage.removeItem(key);});
   await page.goto(origin+'/app/assistant');
   const box=page.getByRole('textbox',{name:'Message à l’assistant',exact:true});await box.waitFor();await page.waitForFunction(()=>!document.querySelector('textarea[aria-label="Message à l’assistant"]')?.disabled);
   await box.fill(prompt);await page.getByRole('button',{name:'Envoyer le message',exact:true}).click();
   await page.waitForFunction(()=>{const m=JSON.parse(localStorage.getItem('investoros.workspace.v2.robert')||'{}').messages?.at(-1);return m?.error||m?.role==='assistant'&&m.versions?.length>0;},undefined,{timeout:180000});
   const message=await page.evaluate(()=>JSON.parse(localStorage.getItem('investoros.workspace.v2.robert')).messages.at(-1));
   fs.writeFileSync(path.join(output,view+'-response.json'),JSON.stringify({prompt,message},null,2));
   assert.ok(!message.error,message.error);assert.ok(message.widgets?.some(widget=>widget.view===view),'The deployed agent must emit '+view);
   const rendered=message.widgets.find(widget=>widget.view===view);assert.equal(rendered.persona,'robert');assert.equal(rendered.schemaVersion,1);
   assert.ok(message.tools.some(tool=>tool.name==='render_portfolio_widget'&&tool.status==='done'));
   assert.ok(message.tools.some(tool=>tool.name==='load_skill'&&tool.status==='done'&&tool.output?.id==='portfolio-visual-widgets'&&tool.output?.version==='1.8.19'));
   const widget=page.locator('.financial-widget');await widget.waitFor();
   const controls=widget.getByRole('group',{name:'Période des données'}).getByRole('button');await controls.nth(3).click();assert.equal(await controls.nth(3).getAttribute('aria-pressed'),'true');await controls.nth(view==='heatmap'?0:view==='contributions'?1:2).click();
   await widget.getByRole('button',{name:/^Agrandir /}).click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   await page.locator('.pw-messages > div').last().evaluate(element=>{element.scrollTop=0;});await page.mouse.move(1400,80);await page.waitForTimeout(400);
   const rectangle=await widget.boundingBox();assert.ok(rectangle.width<=700&&rectangle.height<=430,'Compact dimensions '+JSON.stringify(rectangle));
   const fit=await page.evaluate(()=>({vertical:document.documentElement.scrollHeight<=innerHeight+1,horizontal:document.documentElement.scrollWidth<=innerWidth+1}));assert.ok(fit.vertical&&fit.horizontal);assert.deepEqual(errors,[]);
   const screenshot=await capture(page,'aws-financial-widget-'+view,{fullPage:false});
   const result={view,prompt,status:rendered.status,positions:rendered.positions.length,width:rectangle.width,height:rectangle.height,fit,screenshot,modelLoadedSkill:message.tools.some(tool=>tool.name==='load_skill'&&tool.output?.id==='portfolio-visual-widgets'&&tool.actor!=='runtime-bootstrap')};results.push(result);
   fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({origin,api,access,results,errors},null,2));console.log(JSON.stringify(result));
  }
 }finally{await browser.close();}
})().catch(error=>{console.error('AWS widget verification failed during '+phase+': '+(phase==='login'?error.name:error.message));process.exitCode=1});
