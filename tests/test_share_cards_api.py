from __future__ import annotations

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from backend.civic_api.api import app


client = TestClient(app)


def test_share_landing_returns_og_meta_and_deep_link() -> None:
    response = client.get(
        "/share/election",
        params={
            "title": "Upcoming Election on November 3",
            "subtitle": "Check deadlines, voting options, and what is on your ballot.",
            "cta": "View Election Details",
            "target": "election",
            "eid": "election-123",
            "state": "NY",
        },
    )

    assert response.status_code == 200
    body = response.text
    assert "<meta property=\"og:title\"" in body
    assert "<meta property=\"og:image\"" in body
    assert "votenow://election" in body
    assert "VoteNow civic action card" in body


def test_share_preview_svg_endpoint() -> None:
    response = client.get(
        "/share/preview/registration.svg",
        params={
            "title": "Check Your Registration",
            "subtitle": "Register, update your address, or check your voter status.",
            "badge": "CA · Oct 20",
            "cta": "Check Registration",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in response.text
    assert "Check Your Registration" in response.text
