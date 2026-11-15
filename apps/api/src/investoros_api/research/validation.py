"""Reject precise disclosure dates absent from the cited evidence."""
import json
import re
from datetime import date
from investoros_api.research.coverage import evidence_content

_MONTHS = {name:index for index,names in enumerate([
    (),('janvier','january','jan'),('février','february','feb'),('mars','march','mar'),
    ('avril','april','apr'),('mai','may'),('juin','june','jun'),('juillet','july','jul'),
    ('août','august','aug'),('septembre','september','sep','sept'),('octobre','october','oct'),
    ('novembre','november','nov'),('décembre','december','dec')]) for name in names}
_NAMES='|'.join(sorted(_MONTHS,key=len,reverse=True))


def dates_in(text):
    text=text.casefold()
    dates=set(re.findall(r'\b20\d{2}-\d{2}-\d{2}\b',text))
    for pattern,order in [(rf'\b(\d{{1,2}})\s+({_NAMES})\.?\s*,?\s+(20\d{{2}})\b','day'),
                          (rf'\b({_NAMES})\.?\s+(\d{{1,2}}),?\s+(20\d{{2}})\b','month')]:
        for match in re.finditer(pattern,text):
            day,month,year=(match[1],match[2],match[3]) if order=='day' else (match[2],match[1],match[3])
            try:dates.add(date(int(year),_MONTHS[month],int(day)).isoformat())
            except ValueError:continue
    return dates


def validate_disclosure_dates(result, evidence):
    indexed={proof['evidence_id']:proof for proof in evidence}
    claims=[]
    rejected=0
    for claim in result.get('claims',[]):
        stated=dates_in(claim.get('text','')) if claim.get('claim_type')=='issuer_disclosure' else set()
        cited=[indexed[key] for key in claim.get('evidence_ids',[]) if key in indexed]
        available=set()
        for proof in cited:
            content=evidence_content(proof)
            bodies=[doc.get('excerpt','') for doc in content.get('documents',[]) if isinstance(doc,dict)]
            if not bodies and content.get('passage'):
                bodies=[content['passage']]
            available.update(dates_in('\n'.join(bodies)))
        if stated and not stated <= available:
            rejected+=1
        else:
            claims.append(claim)
    if not rejected:
        return result
    return {**result,'claims':claims,'rejected_claims_count':result.get('rejected_claims_count',0)+rejected,
            'cautions':[*result.get('cautions',[]),'Des constats du modèle ont été écartés : leurs dates ne figurent pas dans les preuves citées.']}
