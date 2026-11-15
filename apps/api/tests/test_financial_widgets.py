"""Arithmetic and missing-data contracts for server-built portfolio widgets."""
from copy import deepcopy
import unittest
from unittest.mock import patch

from investoros_api.profiles.financial_widgets import render_portfolio_widget


def valuation(values, currency='CAD', flows='none'):
    dates = ['2026-10-14', '2026-11-07', '2026-11-13', '2026-11-14']
    return {'currency': currency, 'source': 'Local attributed valuation fixture',
            'cash_flows': flows,
            'points': [{'date': day, 'value': value} for day, value in zip(dates, values)]}


def attributed_portfolio():
    positions = [
        {'id': 'first', 'label': 'First holding', 'value': 720, 'sector': 'Technology',
         'valuation_history': valuation([600, 630, 700, 720])},
        {'id': 'second', 'label': 'Second holding', 'value': 270, 'sector': 'Technology',
         'valuation_history': valuation([300, 300, 280, 270])},
        {'id': 'third', 'label': 'Third holding', 'value': 110, 'sector': 'Energy',
         'valuation_history': valuation([100, 100, 110, 110])},
    ]
    for item in positions:
        item['weight_pct'] = item['value'] / 1100 * 100
    return {'display_name': 'Local arithmetic fixture', 'currency': 'CAD', 'as_of': '2026-11-14',
            'total_value': 1100, 'data_source': 'local_fictional_fixture', 'positions': positions}


def category_portfolio():
    return {'display_name': 'Broad categories fixture', 'currency': 'CAD', 'as_of': '2026-11-14',
            'total_value': 1000, 'data_source': 'local_fictional_fixture', 'positions': [
                {'id': 'global', 'label': 'Actions mondiales', 'weight_pct': 50, 'value': 500},
                {'id': 'bonds', 'label': 'Obligations', 'weight_pct': 30, 'value': 300},
                {'id': 'crypto', 'label': 'Crypto-actifs', 'weight_pct': 20, 'value': 200},
            ]}


class FinancialWidgetArithmeticTests(unittest.TestCase):
    def render(self, portfolio, view='contributions', period='1M', price_history=None):
        with patch('investoros_api.profiles.financial_widgets.load_demo_portfolio',
                   return_value=deepcopy(portfolio)) as load, \
                patch('investoros_api.profiles.financial_widgets.simulation.history',
                      return_value=price_history) as history:
            result = render_portfolio_widget(persona='robert', view=view, period=period)
        load.assert_called_once_with(persona='robert')
        return result, history

    def test_static_categories_allow_allocation_without_imagined_tickers_or_returns(self):
        source = category_portfolio()
        result, history = self.render(source, view='allocation')
        history.assert_not_called()
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['totalValue'], 1000)
        self.assertEqual([p['label'] for p in result['positions']],
                         ['Actions mondiales', 'Obligations', 'Crypto-actifs'])
        self.assertEqual([p['weightPct'] for p in result['positions']], [50, 30, 20])
        self.assertTrue(all(p['ticker'] is None and p['sector'] is None for p in result['positions']))
        self.assertEqual(result['sectors'], [{'id': 'sector-1', 'label': 'Non renseigné',
                                              'value': 1000, 'weightPct': 100}])
        for period in result['periods'].values():
            self.assertEqual(period['status'], 'ready')
            self.assertEqual(period['points'], [])
            self.assertIsNone(period['changeValue'])
            self.assertIsNone(period['changePct'])
            for position in period['positions']:
                self.assertIsNone(position['changePct'])
                self.assertIsNone(position['changeValue'])
                self.assertIsNone(position['contributionPct'])
            self.assertIsNone(period['sectors'][0]['changePct'])

    def test_unknown_sectors_stay_unknown_and_missing_variation_is_null(self):
        for view, status in [('portfolio', 'partial'), ('heatmap', 'unavailable'),
                             ('contributions', 'unavailable'), ('sectors', 'partial')]:
            with self.subTest(view=view):
                result, history = self.render(category_portfolio(), view=view)
                history.assert_not_called()
                self.assertEqual(result['status'], status)
                self.assertEqual(result['sectors'][0]['label'], 'Non renseigné')
                selected = result['periods']['1M']
                self.assertIsNone(selected['changeValue'])
                self.assertIsNone(selected['changePct'])
                self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))

    def test_attributed_valuations_reconcile_totals_contributions_and_beginning_weights(self):
        source = attributed_portfolio()
        original = deepcopy(source)
        result, history = self.render(source)
        history.assert_not_called()
        self.assertEqual(source, original)
        self.assertEqual(result['status'], 'ready')
        selected = result['periods']['1M']
        self.assertEqual((selected['start'], selected['end']), ('2026-10-14', '2026-11-14'))
        self.assertEqual([p['value'] for p in selected['points']], [1000, 1030, 1090, 1100])
        self.assertEqual(selected['changeValue'], 100)
        self.assertEqual(selected['changePct'], 10)
        self.assertTrue(selected['cashFlowsKnownAbsent'])
        self.assertTrue(selected['valuationsReconciled'])
        items = selected['positions']
        self.assertEqual([p['changeValue'] for p in items], [120, -30, 10])
        self.assertEqual([p['changePct'] for p in items], [20, -10, 10])
        self.assertEqual([p['startWeightPct'] for p in items], [60, 30, 10])
        self.assertEqual([p['contributionPct'] for p in items], [12, -3, 1])
        self.assertEqual(sum(p['changeValue'] for p in items), selected['changeValue'])
        self.assertAlmostEqual(sum(p['contributionPct'] for p in items), selected['changePct'])
        self.assertNotEqual(result['positions'][0]['weightPct'], items[0]['startWeightPct'])
        self.assertEqual(result, self.render(source)[0])

    def test_sector_return_uses_beginning_values_instead_of_end_weights_or_simple_mean(self):
        result, _ = self.render(attributed_portfolio(), view='sectors')
        self.assertEqual(result['status'], 'ready')
        selected = result['periods']['1M']
        names = {sector['id']: sector['label'] for sector in result['sectors']}
        changes = {names[sector['id']]: sector for sector in selected['sectors']}
        self.assertEqual(changes['Technology']['changeValue'], 90)
        self.assertEqual(changes['Technology']['changePct'], 10)
        self.assertEqual(changes['Energy']['changeValue'], 10)
        self.assertEqual(changes['Energy']['changePct'], 10)
        self.assertNotEqual(changes['Technology']['changePct'], (20 - 10) / 2)

    def test_daily_window_uses_last_observation_pair_and_sparse_year_stays_unavailable(self):
        result, _ = self.render(attributed_portfolio(), period='1D')
        selected = result['periods']['1D']
        self.assertEqual((selected['start'], selected['end']), ('2026-11-13', '2026-11-14'))
        self.assertEqual(selected['changeValue'], 10)
        self.assertAlmostEqual(selected['changePct'], 10 / 1090 * 100, places=4)
        self.assertEqual(sum(p['changeValue'] for p in selected['positions']), 10)
        self.assertEqual(result['periods']['1Y']['status'], 'unavailable')
        self.assertIsNone(result['periods']['1Y']['changePct'])

    def test_explicit_total_history_conflict_blocks_all_contributions(self):
        source = attributed_portfolio()
        source['valuation_history'] = valuation([900, 1030, 1090, 1100])
        result, _ = self.render(source)
        selected = result['periods']['1M']
        self.assertFalse(selected['valuationsReconciled'])
        self.assertEqual(selected['changeValue'], 200)
        self.assertEqual(selected['status'], 'unavailable')
        self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))
        self.assertTrue(all(p['changePct'] is None for p in selected['sectors']))

    def test_unknown_cash_flows_block_returns_attribution_even_when_values_reconcile(self):
        source = attributed_portfolio()
        source['positions'][0]['valuation_history']['cash_flows'] = 'unknown'
        result, _ = self.render(source)
        selected = result['periods']['1M']
        self.assertTrue(selected['valuationsReconciled'])
        self.assertFalse(selected['cashFlowsKnownAbsent'])
        self.assertEqual(selected['changeValue'], 100)
        self.assertEqual(selected['status'], 'unavailable')
        self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))
        self.assertTrue(all(p['changePct'] is None for p in selected['sectors']))

    def test_mismatched_valuation_currency_does_not_synthesize_fx(self):
        source = attributed_portfolio()
        source['positions'][0]['valuation_history']['currency'] = 'USD'
        result, history = self.render(source)
        history.assert_not_called()
        selected = result['periods']['1M']
        self.assertEqual(selected['status'], 'unavailable')
        self.assertIsNone(selected['changeValue'])
        self.assertIsNone(selected['positions'][0]['changePct'])
        self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))

    def test_invalid_or_sparse_valuation_observations_cannot_support_attribution(self):
        cases = {
            'duplicate': lambda h: h['points'].append(deepcopy(h['points'][0])),
            'negative': lambda h: h['points'][0].update(value=-1),
            'nan': lambda h: h['points'][0].update(value=float('nan')),
            'infinite': lambda h: h['points'][0].update(value=float('inf')),
            'boolean': lambda h: h['points'][0].update(value=True),
            'invalid_date': lambda h: h['points'][0].update(date='not-a-date'),
            'missing_source': lambda h: h.update(source=''),
            'one_observation': lambda h: h.update(points=h['points'][-1:]),
            'inconsistent_latest_value': lambda h: h['points'][-1].update(value=400),
        }
        for name, corrupt in cases.items():
            with self.subTest(name=name):
                source = attributed_portfolio()
                corrupt(source['positions'][0]['valuation_history'])
                result, history = self.render(source)
                history.assert_not_called()
                selected = result['periods']['1M']
                self.assertEqual(selected['status'], 'unavailable')
                self.assertIsNone(selected['positions'][0]['changePct'])
                self.assertIsNone(selected['positions'][0]['changeValue'])
                self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))

    def test_no_common_valuation_dates_prevents_fabricated_total_or_contributions(self):
        source = attributed_portfolio()
        source['positions'][1]['valuation_history']['points'] = [
            {'date': '2026-11-01', 'value': 300}, {'date': '2026-11-14', 'value': 270}]
        source['positions'][2]['valuation_history']['points'] = [
            {'date': '2026-11-02', 'value': 100}, {'date': '2026-11-14', 'value': 110}]
        result, _ = self.render(source)
        selected = result['periods']['1M']
        self.assertEqual(selected['points'], [])
        self.assertIsNone(selected['changeValue'])
        self.assertTrue(all(p['contributionPct'] is None for p in selected['positions']))

    def test_adjusted_price_returns_never_become_dollar_contributions(self):
        source = category_portfolio()
        for index, position in enumerate(source['positions']):
            position['ticker'] = ['AAA', 'BBB', 'CCC'][index]
            position['sector'] = 'Declared sector'
        prices = {'currency': 'CAD', 'source': 'Local adjusted-price fixture',
                  'sourceClassification': 'observations', 'prices': [
                      {'date': '2026-10-14', 'adjustedClose': 100},
                      {'date': '2026-11-14', 'adjustedClose': 120}]}
        result, history = self.render(source, view='heatmap', price_history=prices)
        self.assertEqual(history.call_count, 3)
        selected = result['periods']['1M']
        self.assertEqual(selected['status'], 'ready')
        self.assertIsNone(selected['changeValue'])
        self.assertIsNone(selected['changePct'])
        for item in selected['positions']:
            self.assertEqual(item['changeBasis'], 'adjusted_price_history')
            self.assertEqual(item['changePct'], 20)
            self.assertIsNone(item['changeValue'])
            self.assertIsNone(item['contributionPct'])
        self.assertTrue(all(item['changePct'] is None for item in selected['sectors']))
        prices['currency'] = 'USD'
        mismatch, _ = self.render(source, view='heatmap', price_history=prices)
        self.assertEqual(mismatch['status'], 'unavailable')
        self.assertTrue(all(p['changePct'] is None for p in mismatch['periods']['1M']['positions']))

    def test_invalid_portfolio_values_and_duplicate_ids_are_rejected(self):
        cases = {
            'negative_value': lambda p: p['positions'][0].update(value=-1),
            'nan_value': lambda p: p['positions'][0].update(value=float('nan')),
            'boolean_weight': lambda p: p['positions'][0].update(weight_pct=True),
            'duplicate_id': lambda p: p['positions'][1].update(id=p['positions'][0]['id']),
            'inconsistent_weights': lambda p: (
                p['positions'][0].update(weight_pct=40), p['positions'][1].update(weight_pct=40)),
        }
        for name, corrupt in cases.items():
            with self.subTest(name=name):
                source = category_portfolio()
                corrupt(source)
                with self.assertRaises(ValueError):
                    self.render(source)


if __name__ == '__main__':
    unittest.main()
