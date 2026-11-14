import assert from 'node:assert/strict';
import test from 'node:test';
import { assessProfile } from './profile-consistency.ts';
const base = { objective: 'Préparer une retraite', horizon: '15 ans', riskTolerance: 'Élevée', lossCapacity: 'Faibles conséquences', liquidity: 'Aucun retrait important prévu à court terme', constraints: 'Aucune connue', preferences: 'Aucune préférence', knowledge: 'Quelques notions' };
test('negative withdrawal plan does not conflict with a long horizon',()=> assert.equal(assessProfile(base).issues.length,0));
test('partially unknown answers are incomplete',()=> {const result=assessProfile({...base,liquidity:'Besoins de liquidité à préciser.',knowledge:'À préciser'});assert.equal(result.completed,6);assert.deepEqual(result.issues.map(i=>i.severity),['missing','missing']);});
test('short horizon and explicitly high tolerance produce a review prompt',()=>assert.ok(assessProfile({...base,horizon:'1 à 3 ans'}).issues.some(i=>i.id==='short-horizon-high-risk')));
test('negative high-risk wording is not treated as high tolerance',()=>assert.equal(assessProfile({...base,horizon:'2 ans',riskTolerance:'Je ne tolère pas de fortes variations'}).issues.length,0));
test('near-term withdrawal requires clarification when horizon is long',()=>assert.ok(assessProfile({...base,liquidity:'Je dois retirer ce capital dans deux ans'}).issues.some(i=>i.id==='long-horizon-short-liquidity')));
test('inability to absorb a loss is not read as high capacity',()=>assert.ok(assessProfile({...base,lossCapacity:'Je ne peux pas supporter une perte importante'}).issues.some(i=>i.id==='tolerance-loss-capacity')));
test('moderate tolerance and unknown loss capacity do not fabricate conflict',()=>{const r=assessProfile({...base,riskTolerance:'Modérée',lossCapacity:'À préciser'});assert.equal(r.issues.filter(i=>i.severity==='warning').length,0);});

test('more than three years is not parsed as a short horizon',()=>assert.equal(assessProfile({...base,horizon:'Plus de 3 ans'}).issues.length,0));
