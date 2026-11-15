"""Typed profile workspace and deterministic comparisons shared by tools and HTTP."""
from datetime import date, datetime, timezone
import hashlib
import json
import math
import statistics
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .models import PROFILE_FIELDS
from ..simulation import history

View = Literal['profile', 'alignment', 'comparison', 'scenarios', 'evidence', 'memory', 'documents']

class CompareInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    tickers: list[str] = Field(min_length=2, max_length=3)
    startDate: date | None = None
    endDate: date | None = None

    @model_validator(mode='after')
    def validate_query(self):
        self.tickers = [t.strip().upper() for t in self.tickers]
        if len(set(self.tickers)) != len(self.tickers) or any(not t or len(t)>16 for t in self.tickers):
            raise ValueError('Choisissez deux ou trois symboles distincts.')
        if self.startDate and self.endDate and self.startDate > self.endDate:
            raise ValueError('La date de début doit précéder la fin.')
        return self

class InsightInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=600)
    status: Literal['tension', 'clarification', 'information', 'partial']
    summary: str = Field(min_length=1, max_length=800)
    fields: list[Literal['objective','horizon','riskTolerance','lossCapacity','liquidity','constraints','preferences','knowledge']] = Field(min_length=1,max_length=8)
    evidenceIds: list[str] = Field(default_factory=list,max_length=10)
    alternatives: list[str] = Field(default_factory=list,max_length=4)
    nextQuestion: str = Field(default='',max_length=400)
    limits: list[str] = Field(default_factory=list,max_length=5)


def compare_instruments(query: CompareInput) -> dict:
    try:
        histories = [history(t, start=query.startDate, end=query.endDate) for t in query.tickers]
    except HTTPException as exc:
        raise ValueError(str(exc.detail)) from exc
    currencies = {h['currency'] for h in histories}
    if len(currencies) != 1:
        raise ValueError('Devises différentes : choisir des instruments de même devise. Aucune conversion silencieuse.')
    maps = [{p['date']: p['adjustedClose'] for p in h['prices']} for h in histories]
    dates = sorted(set.intersection(*(set(m) for m in maps)))
    if len(dates) < 3:
        raise ValueError('Il faut au moins trois observations communes pour comparer.')
    metrics=[]
    for ticker, h, prices in zip(query.tickers, histories, maps):
        values=[prices[d] for d in dates]
        returns=[b/a-1 for a,b in zip(values,values[1:])]
        peak=values[0]; drawdown=0
        for v in values:
            peak=max(peak,v); drawdown=min(drawdown,v/peak-1)
        metrics.append({'ticker':ticker,'name':h['asset']['name'],
            'returnPct':round(100*(values[-1]/values[0]-1),4),
            'periodVolatilityPct':round(statistics.stdev(returns)*100,4),
            'drawdownPct':round(drawdown*100,4),
            'excludedObservations':len(prices)-len(dates),
            'classification':h.get('sourceClassification','unknown'),
            'source':h['source'],'sourceUrl':h.get('sourceUrl') or f'https://finance.yahoo.com/quote/{ticker}/history/'})
    digest=hashlib.sha256(json.dumps([query.tickers,dates,[[m[d] for d in dates] for m in maps]]).encode()).hexdigest()
    stride=max(1,math.ceil(len(dates)/90))
    display=sorted(set(range(0,len(dates),stride))|{len(dates)-1})
    return {'type':'comparison','title':' / '.join(query.tickers),'currency':next(iter(currencies)),
        'period':{'from':dates[0],'to':dates[-1]},'observations':len(dates),'metrics':metrics,
        'series':[{'date':dates[i],**{t:round(m[dates[i]]/m[dates[0]]*100,4) for t,m in zip(query.tickers,maps)}} for i in display],
        'dataSha256':digest,'method':'common-dates-adjusted-v1',
        'methodDetails':'Rendement : dernier/premier − 1. Repli : minimum(valeur/plus haut passé − 1). Variabilité : écart-type échantillonnal des rendements entre observations communes, non annualisé. Courbes en base 100; échantillonnées uniquement pour l’affichage.',
        'limits':['Historique descriptif, sans prévision ni verdict de convenance.',
                  'Intersection des dates, sans remplissage. Les intervalles communs peuvent avoir des durées différentes, notamment pour les cryptos.',
                  'Pas de composition sous-jacente, de frais ni de conversion FX. Aucun risque de portefeuille déduit des seules volatilités.'],
        'createdAt':datetime.now(timezone.utc).isoformat()}


def insight_tab(args: InsightInput, profile: dict, evidence_ids: set[str]) -> dict:
    if not set(args.evidenceIds) <= evidence_ids:
        raise ValueError('Une preuve citée n’a pas été reçue dans ce tour. Lire les sources avant de les relier.')
    payload={**args.model_dump(),'type':'insight','profileSnapshot':profile,
             'createdAt':datetime.now(timezone.utc).isoformat(),'classification':'interpretation'}
    return {'id':'profile-alignment','title':'Alignement','kind':'decision','content':json.dumps(payload,ensure_ascii=False)}


def research_evidence_references(output: dict) -> tuple[set[str], list[dict]]:
    """Register received evidence, not bare claim references or proof of semantic support."""
    received=set(); citations=[]
    items=output.get('evidence',[])
    if not isinstance(items,list):
        return received,citations
    for item in items[:80]:
        if not isinstance(item,dict) or not isinstance(item.get('evidence_id'),str) or not item['evidence_id']:
            continue
        identifier=item['evidence_id']; received.add(identifier)
        url=item.get('url')
        if not isinstance(url,str) or not url.startswith(('https://','http://')):
            continue
        content=item.get('content')
        if isinstance(content,str):
            try:content=json.loads(content)
            except (ValueError,TypeError):content={'excerpt':content}
        content=content if isinstance(content,dict) else {}
        excerpt=content.get('excerpt') or content.get('scope') or item.get('limits') or 'Référence reçue; consulter le contenu et ses limites avant de conclure.'
        if not isinstance(excerpt,str):excerpt='Métadonnées de preuve reçues; contenu à examiner.'
        citations.append({'id':identifier,'title':str(item.get('source_name') or item.get('source_id') or 'Document de recherche')[:500],
                          'url':url[:2000],'snippet':excerpt[:1200]})
    return received,citations
