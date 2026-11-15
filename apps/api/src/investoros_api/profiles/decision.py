"""Typed profile workspace and deterministic comparisons shared by tools and HTTP."""
from datetime import date, datetime, timezone
import hashlib
import json
import math
import re
import statistics
from typing import Annotated, Literal
import unicodedata
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

def _normalized_insight_text(value: str) -> str:
    plain = ''.join(character for character in unicodedata.normalize('NFKD', value.casefold())
                    if not unicodedata.combining(character))
    return ' '.join(re.findall(r'\w+', plain))


def profile_declarations(profile: dict) -> dict[str, dict[str, str]]:
    """Describe text availability, never financial truth or a measured risk level.

    Only empty values and whole-answer placeholders are unknown. A qualitative
    declaration remains available even when its exact monetary value is absent.
    """
    placeholders = {'', 'oui', 'non', 'yes', 'no', 'oui non', 'yes no', 'n a', 'na', 'n d',
                    'a preciser', 'a definir', 'a confirmer', 'a renseigner', 'a completer', 'a determiner',
                    'inconnu', 'inconnue', 'unknown', 'unspecified', 'not provided', 'not specified',
                    'non renseigne', 'non renseignee', 'non precise', 'non precisee',
                    'non declare', 'non declaree', 'non defini', 'non definie', 'non connu', 'non connue',
                    'je ne sais pas', 'pas renseigne', 'pas renseignee', 'pas encore renseigne',
                    'a preciser par l utilisateur', 'a preciser avec l utilisateur',
                    'aucune contrainte declaree', 'aucune preference declaree'}
    labels = {'objective': ('objectif',), 'horizon': ('horizon',),
              'riskTolerance': ('tolerance aux fluctuations', 'tolerance au risque'),
              'lossCapacity': ('capacite financiere a absorber une perte', 'capacite a absorber une perte',
                               'capacite financiere', 'capacite de perte', 'capacite'),
              'liquidity': ('liquidites et retraits', 'liquidites'),
              'constraints': ('contraintes',), 'preferences': ('preferences',),
              'knowledge': ('connaissances financieres', 'connaissances')}
    result = {}
    for key in sorted(PROFILE_FIELDS):
        value = profile.get(key, '')
        value = value if isinstance(value, str) else ''
        normalized = _normalized_insight_text(value)
        candidates = [normalized, *[normalized[len(label):].strip() for label in labels[key]
                                    if normalized.startswith(label + ' ')]]
        only_unspecified_amount = re.fullmatch(
            r'(?:je ne sais pas|j ignore) (?:combien|quel montant|quelle somme|quel niveau de perte)'
            r'(?: je (?:peux|pourrais))? (?:perdre|absorber|supporter)'
            r'(?: sans compromettre (?:mon|ce|le) projet)?', normalized)
        result[key] = {'state': 'unknown' if any(candidate in placeholders for candidate in candidates) or only_unspecified_amount else 'declared',
                       'value': value}
    return result


_CAPACITY_UNDECLARED = re.compile(
    r'\b(?:(?:la|votre|sa) )?capacite(?: financiere)?'
    r'(?: (?:a|d|de) (?:absorber|supporter) (?:une |des |les? )?pertes?| de perte)? '
    r'(?:(?:reste|demeure|est|semble) (?:encore |toujours )?(?:inconnue|non renseignee|non declaree|non precisee)'
    r'|n (?:a|avait) pas ete (?:explicitement )?(?:renseignee|declaree|precisee|indiquee|fournie)'
    r'|n est pas (?:encore |explicitement )?(?:renseignee|declaree|precisee|connue))\b'
    r'|\b(?:(?:the|your) )?(?:financial )?(?:loss capacity|capacity to (?:absorb|bear) (?:a loss|losses)) '
    r'(?:(?:is|remains) (?:unknown|unspecified|not (?:provided|stated|specified))'
    r'|has not been (?:explicitly )?(?:provided|stated|specified))\b'
)


def _denies_declared_loss_capacity(text: str) -> bool:
    # This catches observed assertions of missing declarations, not every way
    # to discuss uncertainty. Quantification and future market risk stay distinct.
    for clause in re.split(r'[.!?;\n]+', text):
        normalized = _normalized_insight_text(clause)
        for match in _CAPACITY_UNDECLARED.finditer(normalized):
            prefix, suffix = normalized[:match.start()], normalized[match.end():]
            if re.search(r'\b(?:si|if|future) $', prefix):
                continue
            quantified_subject = re.search(
                r'(?:montant|quantification|seuil|pourcentage|niveau chiffre|valeur chiffree|exact amount)'
                r'(?: exact|precis|chiffre|maximal)? (?:de|d|pour|of) (?:la |votre |sa |your )?$', prefix)
            quantified_scope = re.match(
                r' (?:en (?:montant|euros?|dollars?|pourcentage|valeur chiffree)'
                r'|quantitativement|sous forme chiffree|in (?:dollars|monetary terms|percentage))\b', suffix)
            if not quantified_subject and not quantified_scope:
                return True
    return False


def validate_profile_claims(texts: list[str], profile: dict) -> None:
    """Check known declaration-denial phrases, without validating financial truth."""
    if (profile_declarations(profile)['lossCapacity']['state'] == 'declared'
            and any(_denies_declared_loss_capacity(text) for text in texts)):
        raise ValueError('lossCapacity contient déjà une déclaration du profil. Reprends cette réponse qualitative; ne la présente pas comme inconnue ou non renseignée. Une quantification monétaire manquante doit être indiquée séparément.')


class InsightInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=600)
    status: Literal['tension', 'clarification', 'information', 'partial'] = Field(description='clarification exige nextQuestion; tension et partial exigent une piste ciblée ou une question. information peut se suffire à elle-même.')
    summary: str = Field(min_length=1, max_length=800, description='Constat concret lié aux faits du profil et aux faits/chiffres effectivement retournés par les outils, ou inconnue précise qui limite la conclusion. Énoncer le résultat, sans annoncer « Voici les constats… » ni recopier la question. Ne pas inventer de risque mesuré ou de convenance.')
    fields: list[Literal['objective','horizon','riskTolerance','lossCapacity','liquidity','constraints','preferences','knowledge']] = Field(min_length=1,max_length=8)
    evidenceIds: list[str] = Field(default_factory=list,max_length=10)
    alternatives: list[Annotated[str, Field(min_length=1, max_length=300)]] = Field(default_factory=list,max_length=4, description='Jusqu’à quatre pistes courtes de discussion, ciblées sur le constat et respectant les contraintes explicites du profil. Aucune instruction d’achat, de vente ou de réallocation. Requise avec tension/partial si nextQuestion est vide.')
    nextQuestion: str = Field(default='',max_length=400, description='Une question précise terminée par ?, sur une inconnue qui changerait réellement l’analyse; obligatoire pour clarification. Éviter les invitations génériques comme « Voulez-vous en savoir plus ? ».')
    limits: list[str] = Field(default_factory=list,max_length=5)

    @model_validator(mode='after')
    def validate_useful_content(self):
        # Reject observed empty scaffolding, not the semantic truth of a finding.
        summary = _normalized_insight_text(self.summary)
        generic_summaries = {'contexte a preciser', 'interpretation conditionnelle', 'analyse du profil',
                             'synthese des constats', 'les constats sont disponibles', 'voici les constats',
                             'voir les details', 'constat a preciser'}
        announcement = re.match(r'^(?:voici|je presente|je vais presenter|nous presentons)\s+(?:(?:les?|des?|vos?)\s+)?(?:constats?|compromis|inconnues?|resultats?|points?|analyse|synthese)\b', summary)
        sentences = [sentence for sentence in re.split(r'[.!?]+(?:\s+|$)', self.summary) if sentence.strip()]
        if (len(summary.split()) < 2 or summary in generic_summaries or summary == _normalized_insight_text(self.question)
                or (announcement and ':' not in self.summary and len(sentences) == 1)):
            raise ValueError('summary doit énoncer un constat concret ou une inconnue précise, pas annoncer le contenu ni recopier la question.')
        generic_followups = {'en savoir plus', 'discuter', 'continuer', 'examiner les options',
                             'voulez vous en savoir plus', 'souhaitez vous en savoir plus',
                             'avez vous des questions', 'pouvez vous preciser', 'a preciser'}
        if self.nextQuestion and (not self.nextQuestion.endswith('?')
                                  or len(_normalized_insight_text(self.nextQuestion).split()) < 2
                                  or _normalized_insight_text(self.nextQuestion) in generic_followups):
            raise ValueError('nextQuestion doit poser une question ciblée sur une inconnue utile, terminée par ?.')
        if any(len(_normalized_insight_text(alternative).split()) < 2
               or _normalized_insight_text(alternative) in generic_followups for alternative in self.alternatives):
            raise ValueError('alternatives doit proposer des pistes ciblées sur le constat, pas une invitation générique.')
        if self.status == 'clarification' and not self.nextQuestion:
            raise ValueError('nextQuestion est obligatoire pour une carte clarification : préciser l’inconnue qui changerait l’analyse.')
        if self.status in {'tension', 'partial'} and not self.alternatives and not self.nextQuestion:
            raise ValueError('Une carte tension ou partial doit proposer au moins une piste ciblée dans alternatives ou une nextQuestion utile.')
        return self


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
            'sourceAsOf':h.get('sourceAsOf'),
            'sourceDescription':h.get('sourceDescription'),
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
    validate_profile_claims([args.summary, *args.limits], profile)
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
