# tests/test_app.py
import pytest
from backend.app import app

@pytest.fixture
def client():
    app.testing = True
    return app.test_client()

def test_ping(client):
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json["status"] == "ok"

def test_analyze_missing_folder(client):
    response = client.post("/analyze", json={})
    assert response.status_code == 400

def test_apply_missing_actions(client):
    response = client.post("/apply-actions", json={})
    assert response.status_code == 400
