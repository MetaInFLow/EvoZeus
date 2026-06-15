from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse

from evozeus.companion.tokens import token_matches


def create_app(token: str) -> FastAPI:
    app = FastAPI(title="EvoZeus Companion")

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request) -> str:
        provided = request.query_params.get("token")
        if not token_matches(token, provided):
            raise HTTPException(status_code=403, detail="Invalid token")
        return "<h1>EvoZeus Companion</h1><p>Review required.</p>"

    return app
