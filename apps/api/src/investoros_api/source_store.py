"""Durable source preferences for the local demo server, isolated by demo account."""
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import boto3
from investoros_api.demo_contexts import context_for

router = APIRouter(prefix="/v1/simulation/source-workspace", tags=["sources"])
Account = Literal['amira', 'mateo', 'robert']


class SourceWorkspace(BaseModel):
    hidden_sources: list[str] = Field(default_factory=list)
    learning_job: str | None = None
    selected: str = Field(default='x', pattern=r'^[a-z0-9-]{1,50}$')
    query: str = Field(default='', max_length=16)
    profile: dict | None = None
    authorized: list[dict] = Field(default_factory=list)
    searches: list[dict] = Field(default_factory=list)


def connection():
    path = Path(os.getenv('SOURCE_WORKSPACE_DB', str(Path.home() / '.local/share/investoros/sources.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.execute('CREATE TABLE IF NOT EXISTS workspaces (account TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    return db


@router.get('/{account}')
def read_workspace(account: Account):
    if os.getenv('SOURCE_WORKSPACE_TABLE'):
        item = boto3.client('dynamodb').get_item(TableName=os.environ['SOURCE_WORKSPACE_TABLE'],
            Key={'account_id':{'S':context_for(account)['account_id']}},
            ProjectionExpression='source_workspace', ConsistentRead=True).get('Item', {})
        return json.loads(item['source_workspace']['S']) if 'source_workspace' in item else SourceWorkspace().model_dump()
    with connection() as db:
        row = db.execute('SELECT payload FROM workspaces WHERE account=?', (account,)).fetchone()
    return json.loads(row[0]) if row else SourceWorkspace().model_dump()


@router.put('/{account}')
def write_workspace(account: Account, workspace: SourceWorkspace):
    ids = set()
    for profile in workspace.authorized:
        username = profile.get('username')
        if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_]{1,15}', username):
            raise HTTPException(422, 'Profil X invalide.')
        if username.lower() in ids:
            raise HTTPException(422, 'Ce profil est déjà autorisé.')
        ids.add(username.lower())
    payload = workspace.model_dump()
    if os.getenv('SOURCE_WORKSPACE_TABLE'):
        boto3.client('dynamodb').update_item(TableName=os.environ['SOURCE_WORKSPACE_TABLE'],
            Key={'account_id':{'S':context_for(account)['account_id']}},
            UpdateExpression='SET source_workspace = :workspace',
            ExpressionAttributeValues={':workspace':{'S':json.dumps(payload)}},
            ConditionExpression='attribute_exists(account_id)')
        return payload
    with connection() as db:
        db.execute('INSERT INTO workspaces(account,payload) VALUES (?,?) ON CONFLICT(account) DO UPDATE SET payload=excluded.payload', (account, json.dumps(payload)))
    return payload
