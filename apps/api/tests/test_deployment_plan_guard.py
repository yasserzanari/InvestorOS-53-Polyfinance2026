import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('deployment_plan',Path(__file__).resolve().parents[3]/'scripts/check-deployment-plan.py')
guard=importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
class DeploymentPlanTests(unittest.TestCase):
    def artifact(self):
        return {'address':'aws_s3_object.api_package','change':{'actions':['delete','create'],'replace_paths':[['key']], 'before':{'bucket':'same','key':'assistant-simulation/api-'+'a'*64+'.zip'},'after':{'bucket':'same','key':'assistant-simulation/api-'+'b'*64+'.zip'}}}
    def test_expected_versioned_zip_rotation_allowed(self):
        self.assertEqual(len(guard.validate({'resource_changes':[self.artifact()]})),1)
    def test_other_deletes_and_replacements_blocked(self):
        for address in ['aws_dynamodb_table.memory','aws_lambda_function.api','aws_s3_bucket.data']:
            item=self.artifact();item['address']=address
            with self.assertRaises(ValueError):guard.validate({'resource_changes':[item]})
    def test_bucket_move_arbitrary_key_or_other_path_blocked(self):
        for patch in [{'bucket':'other'},{'key':'private-data.csv'},{'key':None}]:
            item=self.artifact();item['change']['after'].update(patch)
            with self.assertRaises(ValueError):guard.validate({'resource_changes':[item]})
        item=self.artifact();item['change']['replace_paths']=[['bucket']]
        with self.assertRaises(ValueError):guard.validate({'resource_changes':[item]})
    def test_delete_only_never_allowed(self):
        item=self.artifact();item['change']['actions']=['delete']
        with self.assertRaises(ValueError):guard.validate({'resource_changes':[item]})
