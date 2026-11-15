"""Account-scoped, server-persisted assistant conversation history."""
import json
import os
import sqlite3
from pathlib import Path
from typing import Literal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from fastapi import APIRouter, HTTPException, Path as ApiPath
from pydantic import BaseModel, ConfigDict, Field

from investoros_api.demo_contexts import context_for

router = APIRouter(prefix="/v1/profiles/conversations", tags=["profiles"])
Account = Literal["amira", "mateo", "robert"]
MAX_CONVERSATIONS = 30
MAX_CONVERSATION_BYTES = 350_000
_dynamodb = None


class ConversationWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    lastUsedAt: int = Field(ge=0)
    messages: list[dict] = Field(max_length=100)
    tabs: list[dict] = Field(default_factory=list, max_length=12)
    researchRuns: list[dict] = Field(default_factory=list, max_length=40)
    activeTab: str = Field(default="", max_length=100)


def _table():
    name = os.getenv("PROFILE_CONVERSATIONS_TABLE")
    if not name:
        return None
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
        )
    return _dynamodb.Table(name)


def _connection():
    path = Path(os.getenv("PROFILE_CONVERSATIONS_DB", str(Path.home() / ".local/share/investoros/profile-conversations.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.execute("CREATE TABLE IF NOT EXISTS profile_conversations (account TEXT NOT NULL, conversation_id TEXT NOT NULL, title TEXT NOT NULL, last_used_at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(account, conversation_id))")
    return db


def _account_id(account: Account) -> str:
    return context_for(account)["account_id"]


def _index_item(conversation_id: str, title: str, last_used_at: int) -> dict:
    return {"id": conversation_id, "title": title, "lastUsedAt": last_used_at}


@router.get("/{account}")
def list_conversations(account: Account):
    account_id = _account_id(account)
    table = _table()
    if table:
        response = table.query(
            IndexName="account-last-used",
            KeyConditionExpression=Key("account_id").eq(account_id),
            ProjectionExpression="account_id, conversation_id, #title, last_used_at",
            ExpressionAttributeNames={"#title": "title"},
            ScanIndexForward=False,
            Limit=MAX_CONVERSATIONS,
        )
        return {"conversations": [
            _index_item(item["conversation_id"], item["title"], int(item["last_used_at"]))
            for item in response.get("Items", [])
        ], "storage": "dynamodb"}
    with _connection() as db:
        rows = db.execute(
            "SELECT conversation_id, title, last_used_at FROM profile_conversations WHERE account=? ORDER BY last_used_at DESC LIMIT ?",
            (account, MAX_CONVERSATIONS),
        ).fetchall()
    return {"conversations": [_index_item(item_id, title, last_used_at) for item_id, title, last_used_at in rows], "storage": "sqlite"}


@router.get("/{account}/{conversation_id}")
def read_conversation(account: Account, conversation_id: str = ApiPath(pattern=r"^[A-Za-z0-9_-]{1,80}$")):
    account_id = _account_id(account)
    table = _table()
    if table:
        item = table.get_item(Key={"account_id": account_id, "conversation_id": conversation_id}).get("Item")
        if not item:
            raise HTTPException(404, "Conversation introuvable pour ce compte.")
        return json.loads(item["conversation"])
    with _connection() as db:
        row = db.execute(
            "SELECT payload FROM profile_conversations WHERE account=? AND conversation_id=?",
            (account, conversation_id),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Conversation introuvable pour ce compte.")
    return json.loads(row[0])


@router.put("/{account}/{conversation_id}")
def save_conversation(account: Account, body: ConversationWrite, conversation_id: str = ApiPath(pattern=r"^[A-Za-z0-9_-]{1,80}$")):
    encoded = json.dumps(body.model_dump(), ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_CONVERSATION_BYTES:
        raise HTTPException(413, "Conversation trop volumineuse pour être synchronisée.")
    account_id = _account_id(account)
    table = _table()
    if table:
        table.put_item(Item={
            "account_id": account_id,
            "conversation_id": conversation_id,
            "title": body.title,
            "last_used_at": body.lastUsedAt,
            "conversation": encoded,
        })
        old_items = table.query(
            IndexName="account-last-used",
            KeyConditionExpression=Key("account_id").eq(account_id),
            ProjectionExpression="account_id, conversation_id",
            ScanIndexForward=False,
            Limit=MAX_CONVERSATIONS + 1,
        ).get("Items", [])
        for old in old_items[MAX_CONVERSATIONS:]:
            table.delete_item(Key={"account_id": account_id, "conversation_id": old["conversation_id"]})
    else:
        with _connection() as db:
            db.execute(
                "INSERT INTO profile_conversations(account,conversation_id,title,last_used_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(account,conversation_id) DO UPDATE SET title=excluded.title,last_used_at=excluded.last_used_at,payload=excluded.payload",
                (account, conversation_id, body.title, body.lastUsedAt, encoded),
            )
            db.execute(
                "DELETE FROM profile_conversations WHERE account=? AND conversation_id NOT IN (SELECT conversation_id FROM profile_conversations WHERE account=? ORDER BY last_used_at DESC LIMIT ?)",
                (account, account, MAX_CONVERSATIONS),
            )
    return {"id": conversation_id, "title": body.title, "lastUsedAt": body.lastUsedAt, "storage": "dynamodb" if table else "sqlite"}
