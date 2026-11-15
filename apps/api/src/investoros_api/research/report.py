"""Render dated facts deterministically; retain the model's referenced interpretation."""
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from investoros_api.research.coverage import evidence_content


def number(value, decimals=0):
    return f'{value:,.{decimals}f}'.replace(',', '\u202f').replace('.', ',')


def dated_calendar_items(evidence, window):
    entries = []
    for proof in evidence:
        for event in evidence_content(proof).get('dated_events', []):
            if window['start'] <= event.get('date', '') <= window['end']:
                entries.append((proof, event))
    return entries


def risk_section(evidence, issuer, sections):
    lines, ids = [], []
    if issuer:
        proof,event=issuer[0]
        lines.append(f"Résultats du {event['date']} : leur contenu, les perspectives et les réponses de la direction sont encore inconnus. La publication pourrait modifier les anticipations; aucune direction ni amplitude de variation du cours n’est établie.")
        ids.append(proof['evidence_id'])
    for proof in evidence:
        if proof.get('source_id') != 'nvidia-investor-relations':
            continue
        documents=evidence_content(proof).get('documents',[])
        if any(re.search(r'CEO Transition',d.get('title',''),re.I) and re.search(r'interim|resign|chief executive',d.get('excerpt',''),re.I) for d in documents):
            lines.append('Gouvernance : un communiqué effectivement lu annonce une transition de direction. Cela pourrait créer une incertitude de continuité et d’exécution; surveiller les précisions de la direction plutôt que présumer un effet boursier.')
            ids.append(proof['evidence_id'])
        if any(re.search(r'independent investigation',d.get('excerpt',''),re.I) for d in documents):
            lines.append('L’émetteur annonce aussi une enquête présentée comme indépendante. Ses conclusions et leurs conséquences restent inconnues; il faut suivre les communications et dépôts ultérieurs.')
            ids.append(proof['evidence_id'])
    if not lines:
        return [s for s in sections if re.search(r'risqu|risk|surveill|vigilance',s['title'],re.I)]
    return [{'title':'Risques et points de surveillance', 'text':'Interprétations conditionnelles des preuves collectées :\n'+'\n'.join(lines),
             'evidence_ids':list(dict.fromkeys(ids)), 'origin':'runtime-evidence-checklist'}]


def time24(value):
    match=re.search(r'(\d{1,2}):(\d{2})\s*([ap])\.?m\.?',value,re.I)
    if not match:
        return value
    hour=int(match[1])%12+(12 if match[3].lower()=='p' else 0)
    return f'{hour:02d}:{match[2]}'


def macro_title(value):
    mappings=[('FOMC Minutes','Compte rendu du FOMC'),
              ('Industrial Production','Production industrielle et utilisation des capacités'),
              ('Import and Export Price','Indices américains des prix à l’importation et à l’exportation'),
              ('State Employment','Emploi et chômage par État aux États-Unis')]
    for pattern,label in mappings:
        if pattern in value:
            return label
    return re.sub(r'\s+',' ',value).strip().replace('Watch Live','').replace('Speech -','Discours :').replace('Discussion -','Discussion :')


def grounded_report(sections: list[dict], evidence: list[dict], window: dict | None) -> tuple[list[dict], list[dict]]:
    if not window:
        return sections, []
    result, claims = [], []
    entries = dated_calendar_items(evidence, window)
    issuer = [(proof,event) for proof,event in entries if proof.get('source_id') == 'nvidia-investor-relations']
    if issuer:
        lines, ids = [], []
        for proof, event in issuer:
            line = f"{event['date']} : événement de résultats NVIDIA annoncé dans le calendrier officiel."
            if event.get('call_time_pt'):
                instant = datetime.fromisoformat(event['date']+'T'+event['call_time_pt']).replace(tzinfo=ZoneInfo('America/Los_Angeles'))
                line += f" Conférence à {instant.astimezone(ZoneInfo('America/New_York')):%H:%M} à New York ({event['call_time_pt']} heure du Pacifique)."
            if event.get('release_time_pt'):
                instant = datetime.fromisoformat(event['date']+'T'+event['release_time_pt']).replace(tzinfo=ZoneInfo('America/Los_Angeles'))
                line += f" Publication des résultats annoncée vers {instant.astimezone(ZoneInfo('America/New_York')):%H:%M} à New York ({event['release_time_pt']} heure du Pacifique)."
            lines.append(line)
            ids.append(proof['evidence_id'])
            claims.append({'text':line,'claim_type':'scheduled_event','evidence_ids':[proof['evidence_id']],'confidence':'supported'})
        result.append({'title':'Catalyseurs datés de la semaine','text':'\n'.join(lines), 'evidence_ids':list(dict.fromkeys(ids))})
    financial = [proof for proof in evidence if proof.get('source_id') == 'sec-companyfacts']
    if financial:
        lines, ids = [], []
        for proof in financial:
            content = evidence_content(proof)
            lines.append(f"Entreprise : {content.get('entity', 'entreprise identifiée dans la preuve SEC')}.")
            for key, label in [('quarterly_financials','Dernier trimestre publié'),('annual_financials','Dernier exercice annuel publié')]:
                rows = content.get(key, [])
                if not rows:
                    continue
                lines.append(label + ' :')
                for row in rows:
                    period = f"du {row['period_start']} au {row['period_end']}" if row.get('period_start') else f"au {row['period_end']}"
                    lines.append(f"{row['label']} : {number(row['value'])} {row['unit']}, {period}; {row['form']} déposé le {row['filed']}.")
            ids.append(proof['evidence_id'])
        result.append({'title':'Fondamentaux publiés, périodes et unités','text':'\n'.join(lines)+
                       '\nCes chiffres publiés décrivent des périodes passées; les résultats à venir ne sont pas encore connus.', 'evidence_ids':ids})
    # Evidence-specific conditional interpretations; never a market prediction.
    result.extend(risk_section(evidence,issuer,sections))
    macro = [(proof,event) for proof,event in entries if proof.get('source_id') in {'fed-calendar','bls-calendar'}]
    relevant = [(proof,event) for proof,event in macro if re.search(r'FOMC|Industrial Production|Chairman|Import|Export|Employment|Artificial Intelligence',event.get('title',''),re.I)]
    selected = sorted(relevant or macro,key=lambda pair:(pair[1]['date'],time24(pair[1].get('time',''))))[:8]
    if selected:
        lines, ids = [], []
        for proof, event in selected:
            title = macro_title(event['title'])
            line = f"{event['date']} {time24(event.get('time',''))} : {title}"
            lines.append(line)
            ids.append(proof['evidence_id'])
            claims.append({'text':line,'claim_type':'scheduled_event','evidence_ids':[proof['evidence_id']],'confidence':'supported'})
        result.append({'title':'Calendrier macroéconomique à surveiller','text':'\n'.join(lines)+
                       '\nHoraires du calendrier américain. Le contenu futur de ces publications et la réaction des marchés restent inconnus.',
                       'evidence_ids':list(dict.fromkeys(ids))})
    for proof in evidence:
        if proof.get('source_id') != 'alphaforge-starter':
            continue
        content=evidence_content(proof)
        if 'annualized_volatility_pct' not in content:
            continue
        period=content.get('period', {})
        result.append({'title':'Repères historiques du jeu de simulation',
                       'text':f"Période {period.get('start',period.get('from',''))} à {period.get('end',period.get('to',''))} : volatilité annualisée de {number(content['annualized_volatility_pct'],2)} %, repli maximal de {number(content['maximum_drawdown_pct'],2)} %. Ces calculs proviennent du jeu AlphaForge de simulation, pas d’une cotation en direct ni d’une prévision pour la semaine.",
                       'evidence_ids':[proof['evidence_id']]})
    # Keep incompleteness visible when a required evidence category is absent.
    return result or sections, claims
