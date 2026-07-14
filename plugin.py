# -*- coding: utf-8 -*-
"""Agent Avatar Plugin — Backend.

Stores avatar config and uploaded files inside each agent's workspace directory
as <workspace_dir>/.agent-avatar/config.json and <workspace_dir>/.agent-avatar/avatar.*
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from qwenpaw.plugins.api import PluginApi
from qwenpaw.config.config import load_agent_config
from qwenpaw.config.utils import load_config

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


# ── Helpers ────────────────────────────────────────────────────────────

def _avatar_dir(agent_id: str) -> Path:
    """Return the .agent-avatar directory inside the agent's workspace."""
    cfg = load_agent_config(agent_id)
    workspace_dir = Path(cfg.workspace_dir).expanduser()
    d = workspace_dir / ".agent-avatar"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read_config(agent_id: str) -> dict:
    d = _avatar_dir(agent_id)
    f = d / "config.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return {}


def _write_config(agent_id: str, data: dict) -> None:
    d = _avatar_dir(agent_id)
    (d / "config.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8",
    )


def _all_agents() -> List[Dict[str, str]]:
    """Return all agent profiles (id, name, description)."""
    conf = load_config()
    agents = getattr(conf, "agents", None)
    order = list(getattr(agents, "agent_order", []) or [])
    profiles = dict(getattr(agents, "profiles", {}) or {})
    seen: set = set()
    result = []
    for aid in [*order, *profiles.keys()]:
        if aid not in seen and aid in profiles:
            seen.add(aid)
            p = profiles[aid]
            result.append({
                "id": aid,
                "name": getattr(p, "name", aid) or aid,
                "description": getattr(p, "description", "") or "",
            })
    return result


def _avatar_configs() -> Dict[str, dict]:
    """Collect avatar configs from all agents."""
    out = {}
    for a in _all_agents():
        aid = a["id"]
        cfg = _read_config(aid)
        if not cfg:
            continue
        if cfg.get("type") == "url":
            out[aid] = {"type": "url", "value": cfg["url"]}
        elif cfg.get("type") == "file":
            out[aid] = {"type": "file", "value": f"/api/agent-avatar/file/{aid}"}
    return out


# ── Router ─────────────────────────────────────────────────────────────

class AvatarSetRequest(BaseModel):
    type: str  # "url" | "none"
    url: Optional[str] = None


def build_router() -> APIRouter:
    router = APIRouter()

    @router.get("/agents")
    def list_agents():
        return {"agents": _all_agents()}

    @router.get("/config")
    def get_config():
        return {"agents": _avatar_configs()}

    @router.put("/config/{agent_id}")
    def set_avatar(agent_id: str, req: AvatarSetRequest):
        if req.type == "none":
            old = _read_config(agent_id)
            if old.get("type") == "file" and old.get("filename"):
                (_avatar_dir(agent_id) / old["filename"]).unlink(missing_ok=True)
            cf = _avatar_dir(agent_id) / "config.json"
            if cf.exists():
                cf.unlink(missing_ok=True)
            return {"success": True, "message": f"Avatar cleared for '{agent_id}'"}

        elif req.type == "url":
            url = (req.url or "").strip()
            if not url:
                raise HTTPException(400, "url is required when type is 'url'")
            _write_config(agent_id, {"type": "url", "url": url})
            return {"success": True, "message": f"URL avatar set for '{agent_id}'"}

        else:
            raise HTTPException(400, f"Invalid type '{req.type}'")

    @router.post("/upload/{agent_id}")
    async def upload_avatar(agent_id: str, file: UploadFile = File(...)):
        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(400, "Only image files are allowed.")
        original = file.filename or "avatar.png"
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            ext = ".png"
        content = await file.read()
        d = _avatar_dir(agent_id)
        dest = d / f"avatar{ext}"
        dest.write_bytes(content)
        _write_config(agent_id, {"type": "file", "filename": dest.name})
        return {
            "success": True,
            "agent_id": agent_id,
            "url": f"/api/agent-avatar/file/{agent_id}",
        }

    @router.delete("/config/{agent_id}")
    def delete_avatar(agent_id: str):
        old = _read_config(agent_id)
        if old.get("type") == "file" and old.get("filename"):
            (_avatar_dir(agent_id) / old["filename"]).unlink(missing_ok=True)
        cf = _avatar_dir(agent_id) / "config.json"
        if cf.exists():
            cf.unlink(missing_ok=True)
        return {"success": True, "message": f"Avatar removed for '{agent_id}'"}

    @router.get("/file/{agent_id}")
    def get_file(agent_id: str):
        cfg = _read_config(agent_id)
        if cfg.get("type") != "file":
            raise HTTPException(404, "No uploaded avatar.")
        fn = cfg.get("filename", "")
        fp = _avatar_dir(agent_id) / fn
        if not fp.exists():
            raise HTTPException(404, "Avatar file not found.")
        from fastapi.responses import FileResponse
        return FileResponse(str(fp))

    return router


# ── Plugin Entry Point ────────────────────────────────────────────────

class AgentAvatarPlugin:
    def register(self, api: PluginApi):
        logger.info("Registering Agent Avatar plugin...")
        api.register_http_router(
            build_router(),
            prefix="/agent-avatar",
            tags=["agent-avatar"],
        )
        logger.info("✓ Agent Avatar plugin registered at /api/agent-avatar")


plugin = AgentAvatarPlugin()
