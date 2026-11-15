import assert from 'node:assert/strict';
import test from 'node:test';
import { assessProfile, isProfileFieldMissing } from './profile-consistency.ts';
const base = { objective: 'Préparer une retraite', horizon: '15 ans', riskTolerance: 'Élevée', lossCapacity: 'Faibles conséquences', liquidity: 'Aucun retrait important prévu à court terme', constraints: 'Aucune connue', preferences: 'Aucune préférence', knowledge: 'Quelques notions' };

test('known declarations stay known even when an amount remains unspecified', () => {
  assert.equal(isProfileFieldMissing('Je ne peux pas absorber une perte compromettant le projet ; montant à préciser.'), false);
  assert.equal(isProfileFieldMissing('À préciser.'), true);
  const result = assessProfile({ ...base, knowledge: 'À préciser' });
  assert.equal(result.completed, 7);
  assert.deepEqual(result.issues.map(issue => issue.kind), ['missing']);
});

test('a high tolerance and limited loss capacity request clarification, without invalidating either declaration', () => {
  const result = assessProfile({ ...base, lossCapacity: 'Je ne peux pas absorber une perte qui compromettrait le projet' });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].kind, 'clarification');
  assert.equal(result.issues[0].severity, 'warning');
  assert.equal(result.completed, 8);
});

test('short/long labels and arbitrary three/eight-year cutoffs do not infer a contradiction', () => {
  for (const horizon of ['18 mois', '1 à 3 ans', '8 ans', 'Long terme', '18 mois pour le projet et 3–5 ans pour une autre épargne']) {
    assert.equal(assessProfile({ ...base, horizon }).issues.filter(issue => issue.kind === 'conflict').length, 0);
  }
  assert.equal(assessProfile({ ...base, liquidity: 'Besoin de liquidités dans 18 mois' }).issues.filter(issue => issue.kind === 'conflict').length, 0);
});

test('an explicit same-capital timing conflict is preserved by the shared adapter', () => {
  const result = assessProfile({ ...base, horizon: 'Aucun retrait avant 5 ans', liquidity: 'J’ai besoin de tout ce même capital dans 18 mois' });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].kind, 'conflict');
  assert.deepEqual(result.issues[0].fields, ['horizon', 'liquidity']);
  assert.equal(result.completed, 8);
});

test('a separate reserve or negated withdrawal cannot produce a same-capital conflict', () => {
  for (const liquidity of ['Tout ce capital vient d’une réserve séparée dans 18 mois', 'Je ne dois pas retirer tout ce capital dans 18 mois']) {
    assert.equal(assessProfile({ ...base, horizon: 'Aucun retrait avant 5 ans', liquidity }).issues.filter(issue => issue.kind === 'conflict').length, 0);
  }
  assert.equal(assessProfile(base).issues.length, 0);
});
