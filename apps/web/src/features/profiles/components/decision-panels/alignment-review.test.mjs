import assert from 'node:assert/strict';
import test from 'node:test';
import { assessAlignment, FINANCIAL_REFERENCES, isAlignmentFieldMissing } from './alignment-review.ts';

const base = {
  objective: 'Préparer un projet et la retraite', horizon: '5 ans', riskTolerance: 'Modérée',
  lossCapacity: 'Une baisse ne compromet pas mes besoins essentiels',
  liquidity: 'Aucun retrait prévu', constraints: 'Aucune contrainte connue',
  preferences: 'Aucune préférence déclarée', knowledge: 'Quelques notions',
};
const conflicts = changes => assessAlignment({ ...base, ...changes }).filter(issue => issue.kind === 'conflict');
const explicit = {
  horizon: 'Aucun retrait avant 5 ans',
  liquidity: 'J’ai besoin de tout ce même capital dans 18 mois',
};

test('live agent phrasing of emotional tolerance produces clarification, never red', () => {
  for (const riskTolerance of ['Tolérance émotionnelle élevée aux fluctuations', 'Tolérance au risque : élevée', 'Tolérance aux fluctuations élevée']) {
    const issues = assessAlignment({ ...base, riskTolerance, lossCapacity: 'Je ne peux pas absorber une perte qui compromettrait ce projet' });
    assert.ok(issues.some(issue => issue.id === 'tolerance-loss-capacity' && issue.kind === 'clarification'), riskTolerance);
    assert.equal(issues.some(issue => issue.kind === 'conflict'), false);
  }
  assert.equal(assessAlignment({ ...base, riskTolerance: 'Tolérance émotionnelle non élevée', lossCapacity: 'Je ne peux pas absorber une perte' }).some(issue => issue.id === 'tolerance-loss-capacity'), false);
});

test('only explicit earlier need for all of the same locked capital is a conflict', () => {
  const issues = conflicts(explicit);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].fields, ['horizon', 'liquidity']);
  assert.ok(issues[0].sourceIds.includes('amf-profile'));
  assert.match(issues[0].description, /5 ans/);
  assert.match(issues[0].description, /18 mois/);
});

test('months and years use the same duration, including decimal years', () => {
  for (const [horizon, liquidity] of [
    ['Ce capital est bloqué pendant 60 mois', 'La totalité de ce capital est nécessaire dans 2 ans'],
    ['Pas de retrait avant cinq ans', 'J’ai besoin de toute cette épargne dans deux ans'],
    ['Cette épargne est immobilisée pour 2 ans', 'J’ai besoin de toute cette épargne dans 18 mois'],
    ['Aucun retrait avant 1,5 an', 'Tout ce capital est nécessaire dans 12 mois'],
    ['Aucun retrait possible avant 5 ans', 'Tout ce capital est nécessaire dans 18 mois'],
  ]) assert.equal(conflicts({ horizon, liquidity }).length, 1, horizon);
});

test('equal or later deadlines are not a conflict, without a statutory short/long cutoff', () => {
  for (const months of [60, 61, 120]) {
    assert.equal(conflicts({ horizon: 'Aucun retrait avant 5 ans',
      liquidity: `Tout ce capital est nécessaire dans ${months} mois` }).length, 0);
  }
  assert.equal(conflicts({ horizon: 'Aucun retrait avant 18 mois',
    liquidity: 'Tout ce capital est nécessaire dans 1,5 an' }).length, 0);
  assert.equal(conflicts({ horizon: 'Aucun retrait avant 18 mois',
    liquidity: 'Tout ce capital est nécessaire dans 17 mois' }).length, 1);
});

test('a long horizon by itself is not a claim that the capital is unavailable', () => {
  for (const horizon of ['5 ans', '15 ans et plus', 'Long terme', '18 mois', '3 ans', '8 ans']) {
    assert.equal(conflicts({ ...explicit, horizon }).length, 0, horizon);
  }
});

test('small withdrawals and an unspecified capital cannot establish a contradiction', () => {
  for (const liquidity of [
    'J’ai besoin de 5 % de ce capital dans 18 mois',
    'Je dois retirer une petite partie de ce capital dans 18 mois',
    'J’ai besoin de liquidités dans 18 mois',
    'Tout mon argent pourrait être nécessaire dans 18 mois',
  ]) assert.equal(conflicts({ ...explicit, liquidity }).length, 0, liquidity);
});

test('separate capital or a separate reserve prevents any inferred same-capital conflict', () => {
  for (const liquidity of [
    'J’ai besoin de toute cette épargne séparée dans 18 mois',
    'Tout ce capital est nécessaire dans 18 mois, mais il vient d’un autre compte',
    'Une réserve distincte couvre les retraits dans 18 mois',
    'J’ai besoin de la totalité de cette somme dans 18 mois pour un autre projet',
  ]) assert.equal(conflicts({ ...explicit, liquidity }).length, 0, liquidity);
});

test('ranges, secondary dates and multiple projects do not use the first number', () => {
  for (const horizon of [
    '18 mois pour les travaux et 3–5 ans pour la retraite',
    'Aucun retrait avant 3 à 5 ans',
    'Capital bloqué pendant 5 ans ; réserve pour travaux dans 18 mois',
    'Aucun retrait avant 5 ans ou 18 mois selon le projet',
  ]) assert.equal(conflicts({ ...explicit, horizon }).length, 0, horizon);
  for (const liquidity of [
    'Tout ce capital est nécessaire dans 18 mois et dans 3 à 5 ans',
    'Tout ce capital est nécessaire dans 12 à 18 mois',
  ]) assert.equal(conflicts({ ...explicit, liquidity }).length, 0, liquidity);
});

test('uncertain and hypothetical time claims abstain instead of producing red', () => {
  for (const horizon of [
    'Capital peut-être bloqué pendant 5 ans',
    'Si ce capital est bloqué pendant 5 ans',
    'Capital bloqué pendant environ 5 ans',
    'Aucun retrait avant 5 ans, à confirmer',
    'Aucun retrait avant 5 ans, sauf urgence',
  ]) assert.equal(conflicts({ ...explicit, horizon }).length, 0, horizon);
  for (const liquidity of [
    'Je pourrais avoir besoin de tout ce capital dans 18 mois',
    'J’aurais besoin de tout ce capital dans 18 mois',
    'J’ai potentiellement besoin de tout ce capital dans 18 mois',
    'Si tout ce capital est nécessaire dans 18 mois',
    'Tout ce capital serait nécessaire dans 18 mois',
    'Tout ce capital est nécessaire dans environ 18 mois',
    'Tout ce capital est nécessaire dans 18 mois, à préciser',
  ]) assert.equal(conflicts({ ...explicit, liquidity }).length, 0, liquidity);
});

test('negated need or negated lock cannot become a positive time contradiction', () => {
  for (const liquidity of [
    'Je n’ai pas besoin de tout ce capital dans 18 mois',
    'Tout ce capital ne doit pas être retiré dans 18 mois',
    'Aucun besoin de retirer tout ce capital dans 18 mois',
    'Pas de retrait de tout ce capital dans 18 mois',
  ]) assert.equal(conflicts({ ...explicit, liquidity }).length, 0, liquidity);
  assert.equal(conflicts({ ...explicit, horizon: 'Ce capital n’est pas bloqué pendant 5 ans' }).length, 0);
});

test('high tolerance and inability to bear a loss is amber even without a numerical loss limit', () => {
  const issues = assessAlignment({ ...base, riskTolerance: 'Fluctuations élevées',
    lossCapacity: 'Je ne peux pas absorber une perte qui compromettrait mon projet' });
  const issue = issues.find(item => item.id === 'tolerance-loss-capacity');
  assert.equal(issue?.kind, 'clarification');
  assert.deepEqual(issue?.fields, ['riskTolerance', 'lossCapacity']);
  assert.ok(issue?.sourceIds.includes('ciro-kyc'));
  assert.equal(issues.some(item => item.kind === 'conflict'), false);
  assert.equal(issues.some(item => item.id === 'missing-lossCapacity'), false);
});

test('tolerance negations and harmless loss consequences do not manufacture a tension', () => {
  for (const [riskTolerance, lossCapacity] of [
    ['Je ne supporte pas les fortes fluctuations', 'Je ne peux pas absorber une perte'],
    ['Élevée', 'Une baisse a de faibles conséquences sur mon projet'],
    ['Élevée', 'Je peux absorber une perte sans compromettre mon projet'],
    ['Faible à modérée', 'Je ne peux pas absorber une perte'],
    ['Élevée à confirmer', 'Je ne peux pas absorber une perte'],
  ]) assert.equal(assessAlignment({ ...base, riskTolerance, lossCapacity })
    .some(item => item.id === 'tolerance-loss-capacity'), false);
});

test('missing answers stay missing but a stated qualitative constraint is not erased', () => {
  const issues = assessAlignment({ ...base, knowledge: 'À préciser', liquidity: '', lossCapacity: 'Je ne peux pas perdre le capital de mon projet ; montant à préciser' });
  assert.deepEqual(issues.filter(item => item.kind === 'missing').map(item => item.id),
    ['missing-liquidity', 'missing-knowledge']);
  assert.equal(assessAlignment({ ...base, lossCapacity: 'À préciser' }).find(item => item.id === 'missing-lossCapacity')?.kind, 'missing');
});

test('the shared missing-field predicate is conservative for qualitative declarations', () => {
  for (const value of [undefined, '', 'À préciser.', 'Besoins de liquidité à préciser', 'Capacité de perte : inconnue']) {
    assert.equal(isAlignmentFieldMissing(value), true, String(value));
  }
  for (const value of ['Je ne peux pas perdre le capital nécessaire au projet',
    'Je peux absorber une baisse, mais le montant exact reste à préciser',
    'Horizon de 18 mois pour les travaux et 3 à 5 ans pour la retraite', 'Aucune contrainte connue']) {
    assert.equal(isAlignmentFieldMissing(value), false, value);
  }
});

test('all issue sources resolve to the cited primary references', () => {
  const issues = assessAlignment({ ...base, ...explicit, riskTolerance: 'Élevée',
    lossCapacity: 'Je ne peux pas supporter une perte', knowledge: '' });
  for (const issue of issues) {
    assert.ok(issue.question.trim());
    assert.ok(issue.fields.length);
    for (const id of issue.sourceIds) {
      assert.equal(FINANCIAL_REFERENCES[id].id, id);
      assert.match(FINANCIAL_REFERENCES[id].url, /^https:\/\/(?:www\.ciro\.ca|lautorite\.qc\.ca)\//);
      assert.ok(FINANCIAL_REFERENCES[id].principle);
    }
  }
  assert.equal(FINANCIAL_REFERENCES['ciro-kyc'].url, 'https://www.ciro.ca/media/15051/download');
});
