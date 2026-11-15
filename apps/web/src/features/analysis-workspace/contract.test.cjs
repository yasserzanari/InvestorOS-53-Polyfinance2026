const {test, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, filename);
const {parseAnalysisResult, getAvailableViews, canonicalResultJSON} = require('./schema.ts');
const {sampleAnalysis} = require('./sample.ts');
const {saveResult, readResults, resultStorageIssues, resultFromTool} = require('./storage.ts');
const clone = value => structuredClone(value);
class MemoryStorage {
  constructor(){ this.items = new Map(); this.onWrite=null; }
  get length(){ return this.items.size; }
  key(index){ return [...this.items.keys()][index] ?? null; }
  getItem(key){ return this.items.get(key) ?? null; }
  setItem(key,value){ this.items.set(key,value); this.onWrite?.(key,value); }
  removeItem(key){ this.items.delete(key); }
}
beforeEach(()=>{ global.window=Object.assign(new EventTarget(),{localStorage:new MemoryStorage()}); });
test('illustrative sample activates all five views and remains account scoped',()=>{
  assert.deepEqual(getAvailableViews(parseAnalysisResult(sampleAnalysis)),['chronology','propagation','scenarios','dependencies','simulator']);
  saveResult('mateo',sampleAnalysis);
  assert.equal(readResults('mateo').length,1);
  assert.equal(readResults('amira').length,0);
  assert.throws(()=>saveResult('amira',sampleAnalysis),/autre compte/);
});
test('dates reject calendar overflow, midnight rollover and invalid offsets; accept timezone crossings',()=>{
  for(const date of ['0000-01-01','2026-02-30','2026-11-14T24:00:00Z','2026-11-14T10:00:00+00:99','2026-11-14T10:00:00.0001Z']){
    assert.throws(()=>parseAnalysisResult({...sampleAnalysis,asOf:date}),/Date ISO/);
  }
  assert.equal(parseAnalysisResult({...sampleAnalysis,asOf:'2026-11-14T00:30:00+05:00'}).asOf,'2026-11-14T00:30:00+05:00');
});
test('invalid versions, unsafe URLs, self edges and broken references fail',()=>{
  const mutations=[
    value=>{value.resultVersion=Number.MAX_SAFE_INTEGER+1;},
    value=>{value.entities[0].latitude=NaN;},
    value=>{value.entities[0].longitude=undefined;},
    value=>{value.relations[0].target=value.relations[0].source;},
    value=>{value.relations[0].source='missing';},
    value=>{value.events[0].evidenceIds=['example-network','example-network'];},
    value=>{value.evidence[0].url='https://example.org:abc/path';},
    value=>{value.evidence[0].url='javascript:alert(1)';},
    value=>{value.evidence[0].url='https:example.org';},
    value=>{value.evidence[0].url='https://example.org/with space';},
  ];
  for(const mutate of mutations){const value=clone(sampleAnalysis);mutate(value);assert.throws(()=>parseAnalysisResult(value));}
});
test('scenarios and simulation references are numerically consistent',()=>{
  const mutations=[
    value=>{value.scenarios[1].cost+=1;},
    value=>{value.scenarios[1].series[0].value+=1;},
    value=>{value.scenarios[1].series[1].day=0;},
    value=>{value.scenarios[1].series[0].lower=-1;},
    value=>{value.scenarios[1].kind='base';},
    value=>{value.simulation.baselineServicePct=75;},
    value=>{value.simulation.maxClosureDays=91;},
    value=>{value.status='partial';value.limitations=[];},
  ];
  for(const mutate of mutations){const value=clone(sampleAnalysis);mutate(value);assert.throws(()=>parseAnalysisResult(value));}
});
test('optional nulls normalize and whitespace identifiers never do',()=>{
  const value=clone(sampleAnalysis);value.entities[0].country=null;
  assert.equal(parseAnalysisResult(value).entities[0].country,undefined);
  assert.throws(()=>parseAnalysisResult({...sampleAnalysis,analysisId:' identity '}));
  assert.throws(()=>parseAnalysisResult({...sampleAnalysis,analysisId:'identity\n'}));
  assert.throws(()=>parseAnalysisResult({...sampleAnalysis,asOf:'2026-11-14\n'}));
  assert.throws(()=>parseAnalysisResult({...sampleAnalysis,currency:'USD\n'}));
});
test('canonical equality accepts reordered object properties and rejects changed version payloads',()=>{
  const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reverse(item)])):value;
  assert.equal(canonicalResultJSON(sampleAnalysis),canonicalResultJSON(reverse(sampleAnalysis)));
  saveResult('mateo',sampleAnalysis);
  saveResult('mateo',reverse(sampleAnalysis));
  assert.equal(readResults('mateo').length,1);
  assert.throws(()=>saveResult('mateo',{...sampleAnalysis,title:'Changed same version'}),/version existe/);
});
test('saving 25 distinct results never evicts an older linked version',()=>{
  for(let index=0;index<25;index++)saveResult('mateo',{...sampleAnalysis,analysisId:`result-${index}`});
  const results=readResults('mateo');
  assert.equal(results.length,25);assert.ok(results.find(item=>item.analysisId==='result-0'));
});
test('legacy results stay readable and quota failures do not remove data',()=>{
  window.localStorage.setItem('investoros.analysis-results.v1.mateo',JSON.stringify([sampleAnalysis]));
  assert.equal(readResults('mateo').length,1);
  window.localStorage.setItem=()=>{throw new Error('QuotaExceededError');};
  assert.throws(()=>saveResult('mateo',{...sampleAnalysis,resultVersion:2}),/aucun résultat existant/);
  assert.equal(readResults('mateo')[0].resultVersion,1);
});
test('a concurrent conflicting save is detected without overwriting its content',()=>{
  const storage=window.localStorage;
  storage.onWrite=(key)=>{
    storage.onWrite=null;
    storage.items.set(`${key}-competing`,JSON.stringify({savedAt:Date.now(),result:{...sampleAnalysis,title:'Competing immutable content'}}));
  };
  assert.throws(()=>saveResult('mateo',sampleAnalysis),/autre fenêtre/);
  assert.equal(readResults('mateo').length,1);
  assert.equal(readResults('mateo')[0].title,'Competing immutable content');
});
test('malformed records are reported and valid records remain accessible',()=>{
  saveResult('mateo',sampleAnalysis);
  window.localStorage.setItem('investoros.analysis-result.v2.mateo.bad','{broken');
  assert.equal(readResults('mateo').length,1);
  assert.ok(resultStorageIssues('mateo').some(issue=>issue.kind==='invalid'));
  assert.equal(resultFromTool({visualization:sampleAnalysis}).analysisId,sampleAnalysis.analysisId);
  assert.equal(resultFromTool({visualization:{bad:true}}),null);
});
test('oversized input is rejected before being saved',()=>{
  const value=clone(sampleAnalysis);value.summary='x'.repeat(1_500_001);
  assert.throws(()=>saveResult('mateo',value),/1,5 Mo/);
  assert.equal(readResults('mateo').length,0);
});

test('unrelated concurrent saves are retained and the current-window event carries its account',()=>{
  let account='';window.addEventListener('investoros:analysis-results',event=>{account=event.detail.accountId;});
  const storage=window.localStorage;
  storage.onWrite=key=>{
    storage.onWrite=null;
    storage.items.set(`${key}-other`,JSON.stringify({savedAt:Date.now(),result:{...sampleAnalysis,analysisId:'another-analysis'}}));
  };
  saveResult('mateo',sampleAnalysis);
  assert.equal(readResults('mateo').length,2);assert.equal(account,'mateo');
});
