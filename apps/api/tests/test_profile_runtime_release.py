"""Release safety: abort on wrong account and restore API code if worker update fails."""
import hashlib
import io
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
from base64 import b64encode

SCRIPT=Path(__file__).resolve().parents[3]/'scripts/deploy-profile-runtime.py'
class ReleaseSafetyTests(unittest.TestCase):
    def test_wrong_account_never_touches_functions_or_bucket(self):
        with patch('boto3.Session') as session,patch.dict(os.environ,{'EXPECTED_AWS_ACCOUNT_ID':'expected'}):
            session.return_value.client.return_value.get_caller_identity.return_value={'Account':'wrong'}
            with self.assertRaises(SystemExit):runpy.run_path(str(SCRIPT))
            self.assertEqual(session.return_value.client.call_count,1)

    def test_api_anything_worker_failure_restores_both_assistant_functions(self):
        previous=b'old artifact';current=b'new artifact';old_hash=b64encode(hashlib.sha256(previous).digest()).decode()
        class Functions:
            calls=[]
            def get_function(self,FunctionName):
                return {'Code':{'Location':'https://example.org/baseline'},'Configuration':{'CodeSha256':old_hash if not self.calls else b64encode(hashlib.sha256(current).digest()).decode(),'LastUpdateStatus':'Successful'}}
            def update_function_code(self,**kwargs):
                self.calls.append(kwargs)
                if kwargs['FunctionName']=='investoros-dev-research-worker':raise RuntimeError('API Anything worker failed')
            def get_waiter(self,name):return self
            def wait(self,**kwargs):pass
        functions=Functions()
        class Storage:
            def upload_file(self,*args,**kwargs):pass
        class Sts:
            def get_caller_identity(self):return {'Account':'expected'}
        class Session:
            def client(self,name):return {'sts':Sts(),'lambda':functions,'s3':Storage()}[name]
        with tempfile.TemporaryDirectory() as directory,patch('boto3.Session',return_value=Session()),patch.dict(os.environ,{'EXPECTED_AWS_ACCOUNT_ID':'expected'}),patch('urllib.request.urlopen',side_effect=lambda *a,**k:io.BytesIO(previous)):
            root=Path(directory);(root/'apps/api/build').mkdir(parents=True);(root/'apps/api/build/investoros-api.zip').write_bytes(current)
            previous_cwd=Path.cwd()
            try:
                os.chdir(root)
                with self.assertRaisesRegex(RuntimeError,'API Anything worker failed'):runpy.run_path(str(SCRIPT))
            finally:os.chdir(previous_cwd)
        self.assertEqual([call['FunctionName'] for call in functions.calls], [
            'investoros-dev-assistant-simulation', 'investoros-dev-profile-chat-worker',
            'investoros-dev-research-worker', 'investoros-dev-profile-chat-worker',
            'investoros-dev-assistant-simulation',
        ])
        self.assertIn(hashlib.sha256(previous).hexdigest(),functions.calls[-1]['S3Key'])
