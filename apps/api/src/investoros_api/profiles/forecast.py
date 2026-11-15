"""Reproducible empirical bootstrap, with a chronological holdout diagnostic."""
import hashlib
import math
import random
from fastapi import APIRouter, HTTPException
from ..simulation import ScenarioProjectionRequest, history, _quantile

router = APIRouter(prefix='/v1/simulation', tags=['simulation'])


def bootstrap_paths(returns, horizon, seed, count=2000):
    rng = random.Random(seed)
    paths = [[1.0] for _ in range(count)]
    for path in paths:
        for _ in range(horizon):
            path.append(path[-1] * math.exp(rng.choice(returns)))
    return paths


@router.post('/forecast')
def forecast(request: ScenarioProjectionRequest):
    if request.horizonObservations is None:
        raise HTTPException(422, 'Ce modèle utilise des séances; les jours calendaires restent disponibles dans Scénarios.')
    observed = history(request.ticker.upper(), start=None, end=None)
    prices = observed['prices']
    h = request.horizonObservations
    if len(prices) < max(100, h * 5):
        raise HTTPException(422, 'Historique insuffisant pour ajuster et contrôler ce modèle.')
    values = [p['adjustedClose'] for p in prices]
    returns = [math.log(b / a) for a, b in zip(values, values[1:])]
    digest = hashlib.sha256(str((request.ticker.upper(), prices)).encode()).hexdigest()
    seed = int(digest[:16], 16)
    paths = bootstrap_paths(returns, h, seed)
    split = int(len(returns) * .8)
    train = bootstrap_paths(returns[:split], h, seed)
    lower = _quantile([p[-1] for p in train], .1)
    upper = _quantile([p[-1] for p in train], .9)
    realized = [values[i+h] / values[i] for i in range(split, len(values)-h, h)]
    coverage = sum(lower <= x <= upper for x in realized) / len(realized) if realized else None
    branches = []
    for branch in request.branches:
        event_at = branch.eventAfterObservations
        points = []
        for step in range(h+1):
            factor = 1 + branch.shockPct/100 if step >= event_at else 1
            distribution = [values[-1] * p[step] * factor for p in paths]
            points.append({'observations':step,'eventApplied':step>=event_at,
                           'lowerPrice':round(_quantile(distribution,.1),4),
                           'medianPrice':round(_quantile(distribution,.5),4),
                           'upperPrice':round(_quantile(distribution,.9),4)})
        branches.append({**branch.model_dump(exclude_none=True), 'path':points})
    return {'ticker':request.ticker.upper(),'asOf':prices[-1]['date'],'startingPrice':values[-1],
            'currency':observed['currency'],'source':observed['source'],
            'sourceClassification':observed.get('sourceClassification','unknown'),
            'sourceUrl':observed.get('sourceUrl',''),'timeUnit':'observations','horizonObservations':h,
            'branches':branches,'model':'empirical-bootstrap-v1','dataSha256':digest,
            'validation':{'split':'chronological-80-20','trainingReturns':split,'holdoutWindows':len(realized),
                          'horizonObservations':h,'empiricalCoveragePct':round(100*coverage,2) if coverage is not None else None},
            'method':'Bootstrap empirique : 2 000 trajectoires de rendements journaliers log rééchantillonnés avec remise, puis capitalisés. Les bandes montrent les quantiles 10/50/90 à chaque séance. Graine fixe liée aux données. Contrôle chronologique : ajustement sur les premiers 80 % des rendements et couverture mesurée sur des fenêtres non chevauchantes du reste; estimation finale réajustée sur tout l’historique.',
            'limitations':['Modèle de référence stationnaire : pas de régime futur, corrélations temporelles ou effet causal des nouvelles estimés.',
                           'La couverture hors échantillon est un diagnostic historique, pas une probabilité de réussite future.',
                           'Les chocs sont des hypothèses utilisateur et sont appliqués aux mêmes trajectoires; ils ne sont pas prédits.',
                           'Le départ est la dernière clôture du jeu; cinq séances après cette date ne désignent pas automatiquement la semaine civile demandée.']}
