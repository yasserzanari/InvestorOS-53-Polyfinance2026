"""Exercise the real Bedrock loop and configured portfolio; never deploy or write data."""
import argparse
import hashlib
import json
from pathlib import Path
import time

from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat


CASES = [
    ('portfolio', '1M', 'Affiche mon portefeuille en carte interactive dans le chat, avec son évolution sur un mois.'),
    ('heatmap', '1D', 'Montre mes positions dans une carte de chaleur interactive dans le chat, sur un jour.'),
    ('allocation', '1M', 'Montre où est mon argent dans un graphique de répartition interactif dans le chat, sur un mois.'),
    ('contributions', '1W', 'Affiche dans le chat les gains et pertes apportés par chaque position de mon portefeuille, sur une semaine.'),
    ('sectors', '1M', 'Affiche les variations par secteur de mon portefeuille dans une carte interactive dans le chat, sur un mois.'),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--account', choices=['amira', 'mateo', 'robert'], default='robert')
    parser.add_argument('--output', default='docs/agentic/chat-financial-widgets/live')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    summaries = []
    for view, period, prompt in CASES:
        started = time.monotonic()
        events = list(run_chat(ChatRequest(message=prompt, accountId=args.account)))
        (output / (view + '.json')).write_text(json.dumps(events, ensure_ascii=False, indent=2))
        errors = [event for event in events if event['type'] == 'error']
        widgets = [event['widget'] for event in events if event['type'] == 'financial_widget']
        tools = [event for event in events if event['type'] == 'tool' and event['status'] == 'done']
        checks = {
            'completed': bool(events and events[-1]['type'] == 'done' and not errors),
            'correctWidget': any(w.get('view') == view and w.get('period') == period and w.get('persona') == args.account for w in widgets),
            'toolExecuted': any(t['name'] == 'render_portfolio_widget' for t in tools),
            'skillIntegrity': any(t['name'] == 'load_skill' and t.get('output', {}).get('id') == 'portfolio-visual-widgets'
                and hashlib.sha256(t['output']['content'].encode()).hexdigest() == t['output'].get('sha256') for t in tools),
            'serverAccountOnly': all(set(t.get('input', {})) <= {'view', 'period'} for t in tools if t['name'] == 'render_portfolio_widget'),
            'bedrockUsage': any(event['type'] == 'done' and event.get('usage', {}).get('inputTokens', 0) > 0 for event in events),
        }
        summary = {'view': view, 'elapsedSeconds': round(time.monotonic() - started, 2), 'checks': checks,
                   'modelLoadedSkill': any(t['name'] == 'load_skill' and t.get('output', {}).get('id') == 'portfolio-visual-widgets' and t.get('actor') != 'runtime-bootstrap' for t in tools),
                   'widgetStatus': [w.get('status') for w in widgets],
                   'errors': [{'code': e.get('code'), 'message': e.get('message')} for e in errors]}
        summaries.append(summary)
        (output / 'summary.json').write_text(json.dumps(summaries, ensure_ascii=False, indent=2))
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    if not all(all(item['checks'].values()) for item in summaries):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
