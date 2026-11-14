from fastapi import FastAPI
from mangum import Mangum

app = FastAPI(title="InvestorOS API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "investoros-api"}


handler = Mangum(app)
