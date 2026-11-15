"""Cross-worker leases for shared browser learning, without waiting on other runs."""
from contextlib import contextmanager
import time
import uuid
from botocore.exceptions import ClientError
from investoros_api.research.api_anything import ApiAnythingError


@contextmanager
def learning_lease(table, source_id: str):
    owner = str(uuid.uuid4())
    now = int(time.time())
    try:
        table.update_item(Key={'source_id': source_id},
                          UpdateExpression='SET learning_owner = :owner, learning_until = :until',
                          ConditionExpression='attribute_not_exists(learning_until) OR learning_until < :now',
                          ExpressionAttributeValues={':owner': owner, ':until': now + 600, ':now': now})
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            raise ApiAnythingError('Un autre agent apprend déjà cette source; utilisez le navigateur pendant cet apprentissage.', 'learning_busy') from error
        raise
    try:
        yield
    finally:
        try:
            table.update_item(Key={'source_id': source_id}, UpdateExpression='REMOVE learning_owner, learning_until',
                              ConditionExpression='learning_owner = :owner', ExpressionAttributeValues={':owner': owner})
        except ClientError:
            # A failed cleanup leaves a bounded lease; it must not discard collected evidence.
            pass
