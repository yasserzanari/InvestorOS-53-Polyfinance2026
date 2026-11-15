#!/usr/bin/env python3
"""Live, bounded application-level evaluations; uses real Bedrock and one research run."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import time

CASES = [
    {'name':'goals-specialist','message':'Consulte réellement le spécialiste Objectifs et horizon pour examiner mon objectif de préservation du capital sur 3 ans. Ne lance pas de recherche entreprise.', 'profile':{'objective':'Préserver mon capital','horizon':'3 ans'}, 'skill':'goals-horizon'},
    {'name':'risk-specialist','message':'Consulte réellement le spécialiste Risque et liquidités. Mon profil dit seulement oui pour la capacité de perte : explique pourquoi cela reste inconnu. Ne lance pas de recherche entreprise.', 'profile':{'lossCapacity':'Oui','horizon':'3 ans'}, 'skill':'risk-liquidity'},
    {'name':'scenario-clarification','message':'Je souhaite simuler une baisse de NVDA mais je ne connais pas encore les chocs et jalons. Recherche puis charge le skill approprié et demande-moi les hypothèses nécessaires. Ne calcule pas encore de projection.', 'profile':{},'skill':'conditional-scenarios'},
    {'name':'company-research','message':'Lance une recherche documentaire sur NVDA pour la semaine prochaine : événements, fondamentaux SEC et risques. Pas de projection chiffrée. Recherche puis charge les skills utiles avant le lancement.', 'profile':{},'skill':'company-analysis'},
]


def evaluate(base, case):
    started=time.monotonic()
    body=json.dumps({'accountId':'robert','message':case['message'],'profile':case['profile'],'history':[],'tabs':[]}).encode()
    try:
        with urlopen(Request(base.rstrip('/')+'/v1/profiles/chat',data=body,headers={'Content-Type':'application/json'}),timeout=100) as response:
            events=[json.loads(line) for line in response.read().decode().splitlines() if line.strip()]
        done=any(event['type']=='done' for event in events)
        loaded=[event['output']['id'] for event in events if event['type']=='tool' and event.get('name')=='load_skill' and event.get('status')=='done']
        agents=[event for event in events if event['type']=='agent' and event.get('status')=='done']
        if case['name'].endswith('specialist'):
            skill_ok=any(skill['id']==case['skill'] for agent in agents for skill in agent.get('skills',[]))
        else:skill_ok=case['skill'] in loaded
        if case['name']=='scenario-clarification':
            behavior_ok=any(e['type']=='questions' for e in events) and not any(e['type']=='tool' and e.get('name')=='project_market_scenarios' for e in events)
        elif case['name']=='company-research':
            behavior_ok=any(e['type']=='tool' and e.get('name')=='start_analysis' and e.get('status')=='done' and e.get('output',{}).get('analysis_id') for e in events)
        else:behavior_ok=bool(agents)
        return {'case':case['name'],'passed':done and skill_ok and behavior_ok,'done':done,'skill_ok':skill_ok,'behavior_ok':behavior_ok,'events':events}
    except HTTPError as error:
        return {'case':case['name'],'passed':False,'error':str(error),'duration_seconds':round(time.monotonic()-started,2),'body':error.read().decode()[:300]}
    except Exception as error:
        return {'case':case['name'],'passed':False,'error':str(error)}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',required=True)
    parser.add_argument('--report',type=Path,required=True)
    parser.add_argument('--workers',type=int,choices=[1,2],default=1)
    args=parser.parse_args()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=list(pool.map(lambda case:evaluate(args.base_url,case),CASES))
    args.report.write_text(json.dumps(results,ensure_ascii=False,indent=2))
    for item in results:print(json.dumps({key:value for key,value in item.items() if key!='events'},ensure_ascii=False))
    raise SystemExit(0 if all(item['passed'] for item in results) else 1)
