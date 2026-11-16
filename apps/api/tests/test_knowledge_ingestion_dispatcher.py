import json
import os
import unittest
from unittest.mock import patch

from botocore.exceptions import ClientError

from investoros_api.knowledge import ingestion_dispatcher as dispatcher


def s3_record(key, *, event_name="ObjectCreated:Put", sequencer="001ABC", version_id=None):
    obj = {"key": key, "sequencer": sequencer}
    if version_id:
        obj["versionId"] = version_id
    return {
        "eventSource": "aws:s3",
        "eventName": event_name,
        "s3": {"bucket": {"name": "private-documents"}, "object": obj},
    }


class KnowledgeIngestionDispatcherTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "KNOWLEDGE_INGESTION_STATE_MACHINE_ARN": "arn:aws:states:us-east-1:123456789012:stateMachine:knowledge-sync",
            "KNOWLEDGE_BASE_ID": "kb-123",
            "KNOWLEDGE_DATA_SOURCE_ID": "ds-456",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_document_upload_checks_sidecar_and_dispatches_repeatably(self):
        head_calls = []
        s3 = type("S3", (), {"head_object": lambda _self, **kwargs: head_calls.append(kwargs)})()
        starts = []
        stepfunctions = type("SFN", (), {"start_execution": lambda self, **kwargs: starts.append(kwargs)})()
        record = s3_record("documents/account/market/ACME/id/report%20Q1.pdf")

        result = dispatcher._dispatch(record, s3, stepfunctions)

        self.assertEqual(result, "dispatched")
        self.assertEqual(head_calls, [{"Bucket": "private-documents", "Key": "documents/account/market/ACME/id/report Q1.pdf.metadata.json"}])
        payload = json.loads(starts[0]["input"])
        self.assertEqual(payload["knowledgeBaseId"], "kb-123")
        self.assertEqual(payload["dataSourceId"], "ds-456")
        self.assertEqual(payload["key"], "documents/account/market/ACME/id/report Q1.pdf")
        self.assertEqual(payload["clientToken"], payload["eventId"][:64])
        self.assertEqual(starts[0]["name"], "upload-" + payload["eventId"])

    def test_sidecar_event_is_acknowledged_without_a_second_ingestion(self):
        s3 = type("S3", (), {"head_object": lambda *_args, **_kwargs: self.fail("unexpected metadata check")})()
        stepfunctions = type("SFN", (), {"start_execution": lambda *_args, **_kwargs: self.fail("unexpected execution")})()

        result = dispatcher._dispatch(s3_record("documents/account/report.pdf.metadata.json"), s3, stepfunctions)

        self.assertEqual(result, "metadata_sidecar_ignored")

    def test_document_event_retries_if_metadata_sidecar_has_not_arrived(self):
        def missing(**_kwargs):
            raise ClientError({"Error": {"Code": "404", "Message": "Not found"}}, "HeadObject")
        s3 = type("S3", (), {"head_object": staticmethod(missing)})()
        stepfunctions = type("SFN", (), {"start_execution": lambda *_args, **_kwargs: self.fail("must wait for sidecar")})()

        with self.assertRaisesRegex(RuntimeError, "sidecar has not arrived"):
            dispatcher._dispatch(s3_record("documents/account/report.pdf"), s3, stepfunctions)

    def test_event_already_dispatched_is_idempotent(self):
        s3 = type("S3", (), {"head_object": lambda *_args, **_kwargs: {}})()
        def duplicate(**_kwargs):
            raise ClientError({"Error": {"Code": "ExecutionAlreadyExists", "Message": "Exists"}}, "StartExecution")
        stepfunctions = type("SFN", (), {"start_execution": staticmethod(duplicate)})()

        result = dispatcher._dispatch(s3_record("documents/account/report.pdf"), s3, stepfunctions)

        self.assertEqual(result, "already_dispatched")

    def test_handler_reports_failed_sqs_item_for_retry(self):
        s3 = type("S3", (), {"head_object": lambda *_args, **_kwargs: {}})()
        def unavailable(**_kwargs):
            raise RuntimeError("Step Functions unavailable")
        stepfunctions = type("SFN", (), {"start_execution": staticmethod(unavailable)})()
        event = {"Records": [{"messageId": "m-1", "body": json.dumps({"Records": [s3_record("documents/a.pdf")]})}]}

        with patch.object(dispatcher, "_clients", return_value=(s3, stepfunctions)):
            result = dispatcher.handler(event, None)

        self.assertEqual(result, {"batchItemFailures": [{"itemIdentifier": "m-1"}]})

    def test_handler_ignores_s3_test_events(self):
        with patch.object(dispatcher, "_clients", return_value=(object(), object())) as clients:
            result = dispatcher.handler({"Records": [{"messageId": "m-1", "body": json.dumps({"Service": "Amazon S3 TestEvent"})}]}, None)
        clients.assert_called_once()
        self.assertEqual(result, {"batchItemFailures": []})


if __name__ == "__main__":
    unittest.main()
