// Re-render genuine saved tool results to verify persistence, interaction and visual refinements.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const {capture}=require('./browser-capture.cjs');
const base=process.env.WIDGET_WEB_URL||'http://127.0.0.1:5199';
const source=path.resolve(process.env.WIDGET_SOURCE||'docs/agentic/chat-financial-widgets/browser-example');
const output=path.resolve('docs/agentic/chat-financial-widgets/review');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
 const results=[];
 try{for(const view of ['portfolio','heatmap','allocation','contributions','sectors']){
  const input=JSON.parse(fs.readFileSync(path.join(source,view+'-response.json')));
  const context=await browser.newContext({viewport:{width:1518,height:1036}});
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/app/assistant');
  await p.evaluate(async({prompt,message})=>{
   const {initialProfiles}=await import('/src/features/profiles/profile-model.ts');
   localStorage.setItem('investoros.demo.active-account.v1','robert');
   localStorage.setItem('investoros.workspace.v2.robert',JSON.stringify({profile:initialProfiles.robert,tabs:[],conversationScoped:true,messages:[{id:'review-prompt',role:'user',text:prompt,tools:[],agents:[],citations:[],followUps:[],versions:[],version:0},message]}));
  },input);
  await p.reload();await p.locator('.financial-widget').waitFor();await p.waitForTimeout(900);
  const widget=p.locator('.financial-widget');
  if(view==='portfolio'){
   await widget.getByRole('button',{name:/Voir les .* positions/}).click();
   const detail=p.locator('dialog[open]');await detail.waitFor();
   await detail.locator('.fw-position-row').nth(1).click();assert.equal(await detail.locator('.fw-position-inspect').count(),1);
   assert.equal(await detail.locator('.fw-position-row').count(),input.message.widgets[0].positions.length);
   await p.keyboard.press('Escape');
   const bounds=await widget.locator('.recharts-wrapper').boundingBox();await p.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.5);
  }
  if(view==='heatmap'){
   const map=widget.locator('.fw-position-heatmap [role=group][tabindex]');await map.focus();await p.keyboard.press('ArrowRight');assert.ok((await widget.locator('.fw-position-heatmap [role=status]').innerText()).includes('MSFT'));await p.keyboard.press('Enter');await p.keyboard.press('Escape');assert.equal(await widget.locator('.fw-position-heatmap [role=status]').count(),0);
   await widget.getByRole('button',{name:'Montant',exact:true}).click();await widget.getByRole('button',{name:'Variation',exact:true}).click();
  }
  if(view==='allocation'){await widget.getByRole('button',{name:'Par secteur',exact:true}).click();assert.ok((await widget.locator('.fw-allocation-legend').innerText()).includes('Technologies'));await widget.getByRole('button',{name:'Par actif',exact:true}).click();}
  if(view==='sectors'){
   const bar=widget.locator('.fw-sector-track > i').first();
   await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);
   assert.ok(parseFloat(await bar.evaluate(e=>getComputedStyle(e).transitionDuration))<.001);
   await p.emulateMedia({reducedMotion:'no-preference'});
  }
  await widget.locator('.fw-provenance summary').click();
  const sourceDetails=widget.locator('.fw-provenance-details');await sourceDetails.scrollIntoViewIfNeeded();
  assert.ok((await sourceDetails.innerText()).includes('Méthode'));
  await widget.locator('.fw-provenance summary').click();
  await p.locator('.pw-messages > div').last().evaluate(element=>{element.scrollTop=0;});
  await p.mouse.move(1400,80);
  await p.waitForTimeout(250);
  const root=await widget.boundingBox();const composer=await p.locator('.pw-composer').boundingBox();
  const dimensions=await p.evaluate(()=>({vertical:document.documentElement.scrollHeight<=innerHeight+1,horizontal:document.documentElement.scrollWidth<=innerWidth+1}));
  const typography=await widget.locator('h2').evaluate(e=>({weight:getComputedStyle(e).fontWeight,size:getComputedStyle(e).fontSize}));
  const screenshot=await capture(p,'widget-final-'+view,{fullPage:false});
  assert.deepEqual(errors,[]);assert.ok(dimensions.vertical&&dimensions.horizontal);assert.ok(root.y>=60&&root.y+root.height<=composer.y);assert.ok(root.width<=700&&root.height<=430, 'Compact chat card: '+JSON.stringify(root));
  const result={view,screenshot,widgetTop:root.y,widgetWidth:root.width,widgetHeight:root.height,widgetBottom:root.y+root.height,composerTop:composer.y,fullyVisible:root.y+root.height<=composer.y,typography,errors};results.push(result);console.log(JSON.stringify(result));
  await context.close();
 }}finally{await browser.close();fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
