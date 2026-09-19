"""HTTP-level tests for the server app: health, overview, seeding, bundled SPA."""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _load_app(monkeypatch, tmp_path, seed: str | None):
    """Reload the app module with a controlled DB path and seed flag.

    Reloading is what picks up FLEETWRIT_DB (module-level store) and
    FLEETWRIT_SEED (module-level seeding), so each test gets a fresh app.
    """
    monkeypatch.setenv("FLEETWRIT_DB", str(tmp_path / "x.db"))
    if seed is None:
        monkeypatch.delenv("FLEETWRIT_SEED", raising=False)
    else:
        monkeypatch.setenv("FLEETWRIT_SEED", seed)

    # NB: `fleetwrit_server/__init__.py` does `from .app import app`, so the
    # attribute `fleetwrit_server.app` is the FastAPI object, not the submodule.
    # Fetch the real module by name so reload picks up the env above.
    m = importlib.import_module("fleetwrit_server.app")
    importlib.reload(m)
    return m.app


def test_empty_by_default(monkeypatch, tmp_path) -> None:
    app = _load_app(monkeypatch, tmp_path, seed=None)
    with TestClient(app) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/v1/overview").json()["pending"] == 0


def test_seeded_when_demo(monkeypatch, tmp_path) -> None:
    app = _load_app(monkeypatch, tmp_path, seed="1")
    with TestClient(app) as client:
        assert client.get("/v1/overview").json()["pending"] == 4


def test_bundled_dashboard_served(monkeypatch, tmp_path) -> None:
    app = _load_app(monkeypatch, tmp_path, seed=None)
    with TestClient(app) as client:
        root = client.get("/")
        assert root.status_code == 200
        assert "Fleetwrit" in root.text

        spa = client.get("/requests/anything")
        assert spa.status_code == 200
        assert "<title" in spa.text
