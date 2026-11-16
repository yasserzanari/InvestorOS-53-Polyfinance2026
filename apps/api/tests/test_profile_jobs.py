import copy
import json
import os
import types
import unittest
from unittest.mock import Mock, patch
from uuid import UUID

from botocore.exceptions import ClientError
from fastapi import HTTPException

from investoros_api.profiles import jobs
from investoros_api.profiles.models import ChatRequest


class ConditionalFailure(ClientError):
    def __init__(self):
        super().__init__({'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'changed'}}, 'UpdateItem')


def matches(condition, item):
    expression = condition.get_expression()
    operator, values = expression['operator'], expression['values']
    if operator == 'AND':
        return all(matches(value, item) for value in values)
    name = values[0].name
    if operator == 'attribute_not_exists':
        return name not in item
    if operator == '=':
        return item.get(name) == values[1]
    if operator == 'IN':
        return item.get(name) in values[1]
    raise AssertionError(operator)


class Table:
    """Native DynamoDB-shaped fixture with conditional-write behavior."""
    def __init__(self):
        self.items = {}
        self.writes = []
        self.on_write = None
        self.meta = types.SimpleNamespace(client=types.SimpleNamespace(
            exceptions=types.SimpleNamespace(ConditionalCheckFailedException=ConditionalFailure)))

    def put_item(self, Item, ConditionExpression):
        key = Item['job_id']
        if not matches(ConditionExpression, self.items.get(key, {})):
            raise ConditionalFailure()
        self.items[key] = copy.deepcopy(Item)
        return {}

    def get_item(self, Key, ConsistentRead):
        assert ConsistentRead
        item = self.items.get(Key['job_id'])
        return {'Item': copy.deepcopy(item)} if item else {}

    def update_item(self, Key, UpdateExpression, ConditionExpression,
                    ExpressionAttributeNames, ExpressionAttributeValues):
        key = Key['job_id']
        item = self.items.get(key, {})
        if not matches(ConditionExpression, item):
            raise ConditionalFailure()
        for assignment in UpdateExpression.removeprefix('SET ').split(', '):
            name, value = assignment.split(' = ')
            item[ExpressionAttributeNames.get(name, name)] = ExpressionAttributeValues[value]
        self.writes.append(copy.deepcopy(item))
        if self.on_write:
            self.on_write(copy.deepcopy(item))
        return {}


class ProfileJobTests(unittest.TestCase):
    def setUp(self):
        self.table = Table()
        self.queue = Mock()
        self.queue.send_message.return_value = {'MessageId': 'message-1'}
        self.env = patch.dict(os.environ, {'PROFILE_CHAT_JOBS_TABLE': 'jobs',
                                         'PROFILE_CHAT_QUEUE_URL': 'https://sqs.us-east-1.amazonaws.com/123/jobs',
                                         'AWS_REGION': 'us-east-1'})
        self.env.start()
        self.table_patch = patch.object(jobs, '_table', return_value=self.table)
        self.sqs_patch = patch.object(jobs, '_sqs', return_value=self.queue)
        self.table_patch.start()
        self.sqs_patch.start()
        self.addCleanup(self.env.stop)
        self.addCleanup(self.table_patch.stop)
        self.addCleanup(self.sqs_patch.stop)

    def start(self, **kwargs):
        http_request = types.SimpleNamespace(scope={'aws.event': {'requestContext': {'authorizer': {'jwt': {'claims': {'sub': 'test-user'}}}}}})
        result = jobs.start_job(ChatRequest(message='Compare les historiques', accountId='robert', **kwargs), http_request)
        event = json.loads(self.queue.send_message.call_args.kwargs['MessageBody'])
        return result['jobId'], event

    def read(self, job_id, after=0, account='robert'):
        return jobs.read_job(UUID(job_id), account, after)

    def test_start_queues_without_persisting_prompt_or_token(self):
        job_id, event = self.start(profile={'horizon': '18 mois'})
        record = self.table.items[job_id]
        self.assertEqual(record['status'], 'queued')
        self.assertEqual(record['expiresAt'] - record['createdAt'], 3600)
        self.assertEqual(event['request']['profile'], {'horizon': '18 mois'})
        self.assertNotIn('request', record)
        self.assertNotIn('authorization', event)
        self.assertRegex(event['principalHash'], r'^[0-9a-f]{64}$')
        self.assertEqual(self.queue.send_message.call_args.kwargs['QueueUrl'], 'https://sqs.us-east-1.amazonaws.com/123/jobs')

    def test_worker_scopes_principal_hash_to_research_calls(self):
        from investoros_api.profiles.research_bridge import _principal_hash
        principal = 'b' * 64
        with jobs._event_stream(ChatRequest(message='question suffisamment longue'), principal):
            self.assertEqual(_principal_hash.get(), principal)
        self.assertEqual(_principal_hash.get(), '')

    def test_missing_configuration_is_explicit_not_mock_fallback(self):
        with patch.dict(os.environ, {'PROFILE_CHAT_QUEUE_URL': ''}):
            with self.assertRaises(HTTPException) as error:
                jobs.start_job(ChatRequest(message='Bonjour'), types.SimpleNamespace(scope={}))
        self.assertEqual(error.exception.status_code, 503)
        self.assertFalse(self.table.items)

    def test_existing_lambda_transport_works_before_sqs_migration(self):
        worker=Mock();worker.invoke.return_value={'StatusCode':202}
        with patch.dict(os.environ,{'PROFILE_CHAT_QUEUE_URL':'','PROFILE_CHAT_WORKER_FUNCTION':'existing-worker'}),patch.object(jobs,'_lambda',return_value=worker):
            response=jobs.start_job(ChatRequest(message='Déclaration fictive'),types.SimpleNamespace(scope={}))
        self.assertIn(response['jobId'],self.table.items)
        self.assertEqual(worker.invoke.call_args.kwargs['FunctionName'],'existing-worker')
        self.assertEqual(worker.invoke.call_args.kwargs['InvocationType'],'Event')
        self.queue.send_message.assert_not_called()

    def test_legacy_worker_rejection_never_claims_a_queued_success(self):
        worker=Mock();worker.invoke.return_value={'StatusCode':500}
        with patch.dict(os.environ,{'PROFILE_CHAT_QUEUE_URL':'','PROFILE_CHAT_WORKER_FUNCTION':'existing-worker'}),patch.object(jobs,'_lambda',return_value=worker):
            with self.assertRaises(HTTPException) as error:jobs.start_job(ChatRequest(message='Déclaration fictive'),types.SimpleNamespace(scope={}))
        self.assertEqual(error.exception.status_code,503)
        self.assertTrue(all(item['status']=='failed' for item in self.table.items.values()))

    def test_request_size_is_bounded_before_creating_job(self):
        history = [{'role': 'user' if i % 2 == 0 else 'assistant', 'content': 'x' * 12000} for i in range(20)]
        with self.assertRaises(HTTPException) as error:
            self.start(history=history)
        self.assertEqual(error.exception.status_code, 413)
        self.assertFalse(self.table.items)
        self.queue.send_message.assert_not_called()

    def test_queue_failure_does_not_leave_queued_job(self):
        self.queue.send_message.side_effect = ClientError({'Error': {'Code': 'AccessDeniedException', 'Message': 'private role data'}}, 'SendMessage')
        with self.assertRaises(HTTPException) as error:
            self.start()
        self.assertEqual(error.exception.status_code, 503)
        record = next(iter(self.table.items.values()))
        self.assertEqual(record['status'], 'failed')
        self.assertNotIn('private role data', json.dumps(record))

    def test_queue_must_acknowledge_the_job(self):
        self.queue.send_message.return_value = {}
        with self.assertRaises(HTTPException):
            self.start()
        self.assertEqual(next(iter(self.table.items.values()))['status'], 'failed')

    def test_wrong_account_and_expired_jobs_are_not_disclosed(self):
        job_id, _ = self.start()
        with self.assertRaises(HTTPException) as error:
            self.read(job_id, account='amira')
        self.assertEqual(error.exception.status_code, 404)
        self.table.items[job_id]['expiresAt'] = 1
        with self.assertRaises(HTTPException) as error:
            self.read(job_id)
        self.assertEqual(error.exception.status_code, 404)

    def test_poll_cursor_returns_only_new_append_only_events(self):
        job_id, event = self.start()
        events = [{'type': 'tool', 'name': 'compare_profile_instruments', 'status': 'running'},
                  {'type': 'text', 'delta': 'Données '}, {'type': 'text', 'delta': 'observées.'},
                  {'type': 'done'}]
        with patch.object(jobs, 'run_chat', return_value=iter(events)):
            self.assertEqual(jobs.execute_job(event)['status'], 'done')
        result = self.read(job_id, after=1)
        self.assertEqual(result['events'], [{'type': 'text', 'delta': 'Données observées.'}, {'type': 'done'}])
        self.assertEqual(result['nextCursor'], 3)
        self.assertEqual(result['status'], 'done')
        self.assertIsNone(result['error'])
        self.assertEqual(self.read(job_id, after=3)['events'], [])

    def test_duplicate_lambda_delivery_does_not_run_model_twice(self):
        _, event = self.start()
        with patch.object(jobs, 'run_chat', return_value=iter([{'type': 'done'}])) as model:
            jobs.execute_job(event)
            self.assertEqual(jobs.execute_job(event)['status'], 'ignored')
        model.assert_called_once()

    def test_mismatched_worker_account_is_rejected_before_model(self):
        job_id, event = self.start()
        event['request']['accountId'] = 'amira'
        with patch.object(jobs, 'run_chat') as model:
            self.assertEqual(jobs.execute_job(event)['status'], 'failed')
        model.assert_not_called()
        self.assertEqual(self.read(job_id)['error']['code'], 'job_failed')

    def test_model_exception_is_terminal_and_sanitized(self):
        job_id, event = self.start()
        with patch.object(jobs, 'run_chat', side_effect=RuntimeError('SECRET internal details')):
            self.assertEqual(jobs.execute_job(event)['status'], 'failed')
        self.assertNotIn('SECRET', json.dumps(self.read(job_id)))
        self.assertEqual(self.read(job_id)['error']['code'], 'job_failed')

    def test_oversized_result_keeps_verified_progress_and_explicit_error(self):
        job_id, event = self.start()
        events = [{'type': 'profile_view', 'view': 'comparison'},
                  {'type': 'workspace', 'tabs': [{'content': 'x' * jobs.MAX_EVENT_BYTES}]}, {'type': 'done'}]
        with patch.object(jobs, 'run_chat', return_value=iter(events)):
            self.assertEqual(jobs.execute_job(event)['status'], 'failed')
        result = self.read(job_id)
        self.assertEqual(result['events'][0], events[0])
        self.assertEqual(result['error']['code'], 'result_too_large')
        self.assertNotIn('done', [entry['type'] for entry in result['events']])

    def test_incomplete_iterator_is_not_reported_as_success(self):
        job_id, event = self.start()
        with patch.object(jobs, 'run_chat', return_value=iter([{'type': 'text', 'delta': 'Partiel'}])):
            self.assertEqual(jobs.execute_job(event)['status'], 'failed')
        self.assertEqual(self.read(job_id)['error']['code'], 'job_failed')

    def test_worker_error_event_is_preserved_and_terminal(self):
        job_id, event = self.start()
        error = {'type': 'error', 'code': 'tool_failed', 'message': 'Le calcul n’a pas abouti.'}
        with patch.object(jobs, 'run_chat', return_value=iter([error, {'type': 'done'}])):
            self.assertEqual(jobs.execute_job(event)['status'], 'failed')
        self.assertEqual(self.read(job_id)['events'], [error])

    def test_stalled_jobs_become_terminal_and_cannot_resume(self):
        job_id, event = self.start()
        self.table.items[job_id]['deadlineAt'] = 1
        result = self.read(job_id)
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['error']['code'], 'job_timeout')
        with patch.object(jobs, 'run_chat') as model:
            self.assertEqual(jobs.execute_job(event)['status'], 'ignored')
        model.assert_not_called()

    def test_cancelled_queued_job_never_starts(self):
        job_id, event = self.start()
        self.assertEqual(jobs.cancel_job(UUID(job_id), 'robert')['status'], 'cancelled')
        with patch.object(jobs, 'run_chat') as model:
            self.assertEqual(jobs.execute_job(event)['status'], 'ignored')
        model.assert_not_called()
        self.assertEqual(self.read(job_id)['error']['code'], 'cancelled')

    def test_cancellation_after_running_event_prevents_next_tool_operation(self):
        job_id, event = self.start()
        performed = []
        def stream(_request):
            yield {'type': 'tool', 'name': 'compare_profile_instruments', 'status': 'running'}
            performed.append('calculation')
            yield {'type': 'done'}
        def cancel_after_progress(item):
            entries = json.loads(item['eventsJson'])
            if item['status'] == 'running' and entries:
                self.table.on_write = None
                jobs.cancel_job(UUID(job_id), 'robert')
        self.table.on_write = cancel_after_progress
        with patch.object(jobs, 'run_chat', side_effect=stream):
            self.assertEqual(jobs.execute_job(event)['status'], 'superseded')
        self.assertEqual(performed, [])
        self.assertEqual(self.read(job_id)['status'], 'cancelled')

    def test_cancel_checks_owner_and_does_not_change_finished_job(self):
        job_id, event = self.start()
        with self.assertRaises(HTTPException) as error:
            jobs.cancel_job(UUID(job_id), 'amira')
        self.assertEqual(error.exception.status_code, 404)
        with patch.object(jobs, 'run_chat', return_value=iter([{'type': 'done'}])):
            jobs.execute_job(event)
        self.assertEqual(jobs.cancel_job(UUID(job_id), 'robert')['status'], 'done')

    def test_storage_access_failure_is_503_without_secret_details(self):
        job_id, _ = self.start()
        with patch.object(self.table, 'get_item', side_effect=ClientError(
            {'Error': {'Code': 'AccessDeniedException', 'Message': 'SECRET'}}, 'GetItem')):
            with self.assertRaises(HTTPException) as error:
                self.read(job_id)
        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn('SECRET', str(error.exception.detail))

    def test_sqs_handler_acknowledges_a_completed_job(self):
        payload = {'source': jobs.WORKER_SOURCE, 'jobId': str(UUID(int=1)), 'request': {}}
        record = {'messageId': 'm-1', 'eventSource': 'aws:sqs', 'body': json.dumps(payload)}
        with patch.object(jobs, 'execute_job', return_value={'jobId': payload['jobId'], 'status': 'done'}):
            self.assertEqual(jobs.handle_sqs_event({'Records': [record]}), {'batchItemFailures': []})

    def test_sqs_handler_returns_failed_records_for_redrive(self):
        payload = {'source': jobs.WORKER_SOURCE, 'jobId': str(UUID(int=1)), 'request': {}}
        record = {'messageId': 'm-1', 'eventSource': 'aws:sqs', 'body': json.dumps(payload)}
        with patch.object(jobs, 'execute_job', side_effect=RuntimeError('transient storage failure')):
            self.assertEqual(jobs.handle_sqs_event({'Records': [record]}),
                             {'batchItemFailures': [{'itemIdentifier': 'm-1'}]})


if __name__ == '__main__':
    unittest.main()
