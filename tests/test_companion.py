from fastapi.testclient import TestClient

from evozeus.companion.app import create_app
from evozeus.companion.tokens import create_one_time_token


def test_create_one_time_token_returns_non_empty_token():
    assert create_one_time_token()


def test_companion_rejects_missing_token():
    client = TestClient(create_app(token="secret"))

    response = client.get("/")

    assert response.status_code == 403


def test_companion_accepts_valid_token():
    client = TestClient(create_app(token="secret"))

    response = client.get("/?token=secret")

    assert response.status_code == 200
    assert "EvoZeus Companion" in response.text
