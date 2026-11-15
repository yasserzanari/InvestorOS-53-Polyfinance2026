"""Local visual review with an explicit paper portfolio and real Bedrock tool calls.

Uses the authorized AlphaForge pack; changes no AWS portfolio, profile or deployment.
The example is intentionally separate from the configured account portfolio.
"""
import argparse
import copy
import csv
from datetime import date
import os
from pathlib import Path


def build_example(directory: Path):
    tickers = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'JPM', 'XOM']
    allocations = [28, 22, 20, 12, 10, 8]
    universe = {row['ticker']: row for row in csv.DictReader((directory / 'assets_universe.csv').open())}
    prices = {ticker: {} for ticker in tickers}
    for row in csv.DictReader((directory / 'prices_daily.csv').open()):
        if row['ticker'] in prices and row['currency'] == 'USD':
            prices[row['ticker']][row['date']] = float(row['adj_close'])
    common = sorted(set.intersection(*(set(series) for series in prices.values())))
    end = date.fromisoformat(common[-1])
    cutoff = end.replace(year=end.year - 1)
    start = max(day for day in common if date.fromisoformat(day) <= cutoff)
    days = [day for day in common if day >= start]
    positions = []
    source = 'Modèle illustratif à unités constantes · cours ajustés Yahoo Finance du paquet AlphaForge'
    translations = {'Information Technology': 'Technologies', 'Financials': 'Finance', 'Energy': 'Énergie', 'Consumer Discretionary': 'Consommation'}
    for ticker, weight in zip(tickers, allocations):
        values = [{'date': day, 'value': 82400 * weight / 100 * prices[ticker][day] / prices[ticker][start]} for day in days]
        positions.append({'id': 'example-' + ticker.lower(), 'label': universe[ticker]['name'], 'ticker': ticker,
                          'sector': translations.get(universe[ticker]['sector'], universe[ticker]['sector']),
                          'value': values[-1]['value'],
                          'valuation_history': {'currency': 'USD', 'source': source, 'cash_flows': 'none', 'points': values}})
    total = sum(position['value'] for position in positions)
    for position in positions:
        position['weight_pct'] = position['value'] / total * 100
    return {'display_name': 'Exemple illustratif · 6 actions US', 'currency': 'USD', 'as_of': days[-1],
            'total_value': total, 'source': source, 'data_source': 'illustrative_model_from_adjusted_prices', 'positions': positions}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8015)
    args = parser.parse_args()
    if os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
        raise SystemExit('This preview must run locally.')
    os.environ.setdefault('AWS_REGION', 'us-east-1')
    os.environ.setdefault('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-6')
    os.environ.setdefault('PROFILE_MEMORY_DB', '/var/tmp/investoros-widget-example-memory.sqlite3')
    os.environ['SIMULATION_DATA_DIR'] = str(args.data_dir.resolve())
    from investoros_api.profiles import financial_widgets, portfolio
    example = build_example(args.data_dir)
    def selected_example(client=None, persona='mateo'):
        return {**copy.deepcopy(example), 'profile_id': 'illustrative-' + persona}
    financial_widgets.load_demo_portfolio = selected_example
    portfolio.load_demo_portfolio = selected_example
    import uvicorn
    from investoros_api.main import app
    print('Local illustrative portfolio; real Bedrock; no AWS account portfolio changes.', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=args.port)


if __name__ == '__main__':
    main()
