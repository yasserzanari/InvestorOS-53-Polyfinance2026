import json
import os
from typing import Any

import boto3
from fastapi import FastAPI, HTTPException
from mangum import Mangum
from investoros_api.profiles.router import router as profiles_router

app = FastAPI(title="InvestorOS API", version="0.1.0")
app.include_router(profiles_router)
_dynamodb = None


def _client() -> Any:
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.client("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    return _dynamodb


def _table_name(key: str) -> str:
    name = os.getenv(key, "")
    if not name:
        raise HTTPException(status_code=503, detail="Demo data is not configured")
    return name


def _decode_item(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    decoded_item = {key: next(iter(value.values())) for key, value in item.items()}
    payload = decoded_item.get("payload")
    if not isinstance(payload, str):
        raise HTTPException(status_code=502, detail="Demo record payload is invalid")
    try:
        decoded = {**decoded_item, "payload": json.loads(payload)}
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="Demo record payload is invalid") from error
    return decoded


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "investoros-api"}


@app.get("/v1/demo/overview")
def demo_overview() -> dict[str, Any]:
    """Read only the fixed, fictional demo account configured for this environment."""
    account_id = os.getenv("DEMO_ACCOUNT_ID", "")
    profile_id = os.getenv("DEMO_PROFILE_ID", "")
    portfolio_id = os.getenv("DEMO_PORTFOLIO_ID", "")
    if not all((account_id, profile_id, portfolio_id)):
        raise HTTPException(status_code=503, detail="Demo context is not configured")

    dynamodb = _client()

    account = _decode_item(
        dynamodb.get_item(
            TableName=_table_name("ACCOUNTS_TABLE_NAME"),
            Key={"account_id": {"S": account_id}},
            ConsistentRead=True,
        ).get("Item")
    )
    profile = _decode_item(
        dynamodb.get_item(
            TableName=_table_name("PROFILES_TABLE_NAME"),
            Key={"account_id": {"S": account_id}, "profile_id": {"S": profile_id}},
            ConsistentRead=True,
        ).get("Item")
    )
    portfolio = _decode_item(
        dynamodb.get_item(
            TableName=_table_name("PORTFOLIOS_TABLE_NAME"),
            Key={"account_id": {"S": account_id}, "portfolio_id": {"S": portfolio_id}},
            ConsistentRead=True,
        ).get("Item")
    )
    if not account or not profile or not portfolio:
        raise HTTPException(status_code=404, detail="Demo context was not found")

    # Partition-key reads keep every returned record inside the configured demo account.
    if profile.get("account_id") != account_id or portfolio.get("account_id") != account_id:
        raise HTTPException(status_code=403, detail="Demo record does not belong to this account")
    profile_payload = profile["payload"]
    portfolio_payload = portfolio["payload"]
    if portfolio_payload.get("profile_id") != profile_id:
        raise HTTPException(status_code=403, detail="Demo portfolio is not linked to this profile")

    analysis_items = dynamodb.query(
        TableName=_table_name("ANALYSES_TABLE_NAME"),
        KeyConditionExpression="account_id = :account_id",
        ExpressionAttributeValues={":account_id": {"S": account_id}},
        Limit=25,
        ScanIndexForward=False,
        ConsistentRead=True,
    ).get("Items", [])
    analysis_records = [_decode_item(item) for item in analysis_items]
    if any(record and record.get("account_id") != account_id for record in analysis_records):
        raise HTTPException(status_code=403, detail="Demo analysis does not belong to this account")

    return {
        "mode": "demo",
        "source": "aws-dynamodb",
        "account": account["payload"],
        "profile": profile_payload,
        "portfolio": portfolio_payload,
        "analyses": [record["payload"] for record in analysis_records if record],
    }


handler = Mangum(app)
