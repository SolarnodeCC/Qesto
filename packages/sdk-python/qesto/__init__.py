"""SDK-PYTHON-V1 — minimal Public API v1 client."""

from __future__ import annotations

import json
import urllib.request
from typing import Any


class QestoClient:
    def __init__(self, api_key: str, base_url: str = "https://qesto.cc") -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _request(self, path: str) -> Any:
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            headers={"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode())
        if not body.get("ok"):
            raise RuntimeError(body.get("error", {}).get("message", "request failed"))
        return body["data"]

    def list_sessions(self) -> dict[str, Any]:
        return self._request("/api/v1/sessions")

    def get_session_results(self, session_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/sessions/{session_id}/results")
