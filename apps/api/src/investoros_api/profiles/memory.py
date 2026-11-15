"""Durable demo profile memory; optimistic revisions prevent silent cross-tab overwrites."""
import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Literal
import boto3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from investoros_api.demo_contexts import context_for
from .models import PROFILE_FIELDS, WorkspaceTab

router=APIRouter(prefix='/v1/profiles/memory',tags=['profiles'])
Account=Literal['amira','mateo','robert']
class StoredCitation(BaseModel):
    model_config=ConfigDict(extra='ignore')
    id: str = Field(min_length=1,max_length=200)
    index: int = Field(ge=1)
    title: str = Field(max_length=500)
    url: str = Field(max_length=2000)
    snippet: str | None = Field(default=None,max_length=2400)

class MemoryWrite(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expectedRevision: int = Field(ge=0)
    profile: dict = Field(max_length=16)
    tabs: list[WorkspaceTab] = Field(default_factory=list,max_length=12)
    sources: list[StoredCitation] = Field(default_factory=list,max_length=80)

    @model_validator(mode='after')
    def validate_profile(self):
        if not set(self.profile)<=PROFILE_FIELDS|{'origins','confirmed','version','updatedAt','situation'}:
            raise ValueError('Champ de mémoire inconnu.')
        for k in PROFILE_FIELDS:
            if k in self.profile and (not isinstance(self.profile[k],str) or len(self.profile[k])>2000):
                raise ValueError('Valeur de profil invalide.')
        origins=self.profile.get('origins',{})
        if not isinstance(origins,dict) or not set(origins)<=PROFILE_FIELDS or any(not isinstance(v,str) or len(v)>500 for v in origins.values()):
            raise ValueError('Provenance de profil invalide.')
        if 'confirmed' in self.profile and type(self.profile['confirmed']) is not bool:
            raise ValueError('Confirmation de profil invalide.')
        if 'version' in self.profile and (type(self.profile['version']) is not int or self.profile['version']<1):
            raise ValueError('Version de profil invalide.')
        situation=self.profile.get('situation')
        if situation is not None and (not isinstance(situation,dict) or not set(situation)<={'incomeRange','liquidities','financialAssets','obligations','personalContext'} or any(not isinstance(value,str) or len(value)>500 for value in situation.values())):
            raise ValueError('Situation de démonstration invalide.')
        if len(json.dumps(self.profile,ensure_ascii=False))>24000:
            raise ValueError('Mémoire de profil trop volumineuse.')
        return self

def connection():
    path=Path(os.getenv('PROFILE_MEMORY_DB',str(Path.home()/'.local/share/investoros/profile-memory.sqlite3')))
    path.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path,timeout=10)
    db.execute('CREATE TABLE IF NOT EXISTS profile_memory (account TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)')
    return db

def table_name():
    return os.getenv('PROFILE_WORKSPACE_TABLE') or os.getenv('SOURCE_WORKSPACE_TABLE')


def _dynamodb_call(method, **kwargs):
    from botocore.exceptions import ClientError, BotoCoreError
    from botocore.config import Config
    try:
        client=boto3.Session().client('dynamodb',config=Config(connect_timeout=5,read_timeout=10,retries={'max_attempts':1}))
        return getattr(client,method)(**kwargs)
    except ClientError as error:
        code=error.response.get('Error',{}).get('Code','')
        if code=='ConditionalCheckFailedException':
            raise
        detail='La session AWS du serveur a expiré. Renouveler la connexion AWS pour synchroniser la mémoire.' if code in {'ExpiredToken','ExpiredTokenException','RequestExpired','InvalidClientTokenId'} else 'La mémoire AWS est temporairement indisponible. Les modifications locales restent conservées.'
        raise HTTPException(503,detail) from error
    except BotoCoreError as error:
        raise HTTPException(503,'La mémoire AWS est inaccessible. Réessayez après vérification de la connexion du serveur.') from error

@router.get('/{account}')
def read_memory(account:Account):
    table=table_name()
    if table:
        item=_dynamodb_call('get_item',TableName=table,Key={'account_id':{'S':context_for(account)['account_id']}},ProjectionExpression='profile_workspace',ConsistentRead=True).get('Item',{})
        return json.loads(item['profile_workspace']['S']) if 'profile_workspace' in item else {'revision':0,'profile':None,'tabs':[],'storage':'dynamodb'}
    with connection() as db:
        row=db.execute('SELECT payload FROM profile_memory WHERE account=?',(account,)).fetchone()
    return json.loads(row[0]) if row else {'revision':0,'profile':None,'tabs':[],'storage':'sqlite'}

@router.put('/{account}')
def write_memory(account:Account,body:MemoryWrite):
    payload={'revision':body.expectedRevision+1,'profile':body.profile,'tabs':[t.model_dump() for t in body.tabs],'sources':[s.model_dump() for s in body.sources],
             'updatedAt':datetime.now(timezone.utc).isoformat(),'storage':'dynamodb' if table_name() else 'sqlite'}
    encoded=json.dumps(payload,ensure_ascii=False)
    if len(encoded.encode())>280000:
        raise HTTPException(413,'Mémoire trop volumineuse; fermer certains dossiers avant de réessayer.')
    if table_name():
        from botocore.exceptions import ClientError
        key={'account_id':{'S':context_for(account)['account_id']}}
        current=_dynamodb_call('get_item',TableName=table_name(),Key=key,ProjectionExpression='profile_workspace',ConsistentRead=True).get('Item',{})
        previous=current.get('profile_workspace',{}).get('S')
        if (json.loads(previous)['revision'] if previous else 0)!=body.expectedRevision:
            raise HTTPException(409,'Le profil a changé dans une autre session. Rechargez la mémoire avant de poursuivre.')
        values={':next':{'S':encoded}}
        condition='attribute_exists(account_id) AND attribute_not_exists(profile_workspace)'
        if previous:
            values[':previous']={'S':previous};condition='profile_workspace = :previous'
        try:
            _dynamodb_call('update_item',TableName=table_name(),Key=key,UpdateExpression='SET profile_workspace = :next',ExpressionAttributeValues=values,ConditionExpression=condition)
        except ClientError as e:
            if e.response['Error']['Code']=='ConditionalCheckFailedException':
                raise HTTPException(409,'Mémoire modifiée ailleurs. Rechargez avant de réessayer.') from e
            raise
    else:
        with connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT revision FROM profile_memory WHERE account=?',(account,)).fetchone()
            if (row[0] if row else 0)!=body.expectedRevision:
                raise HTTPException(409,'Mémoire modifiée ailleurs. Rechargez avant de réessayer.')
            db.execute('INSERT INTO profile_memory VALUES (?,?,?) ON CONFLICT(account) DO UPDATE SET revision=excluded.revision,payload=excluded.payload',(account,payload['revision'],encoded))
    return payload
