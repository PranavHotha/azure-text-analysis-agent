import os
import sys
import time
import json
import base64
import hashlib
import secrets
import threading
import subprocess
import urllib.parse
import urllib.request
from typing import Dict, Any, List, Optional
import contextvars
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Import Azure SDK namespaces
from azure.core.credentials import AccessToken, TokenCredential
from azure.core.exceptions import ClientAuthenticationError
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

base_dir = os.path.dirname(os.path.abspath(__file__))

# Auto-rebuild text-agent-app/dist in local environments if needed
if not os.environ.get("RENDER"):
    try:
        app_jsx_path = os.path.join(base_dir, "text-agent-app", "src", "App.jsx")
        dist_index_path = os.path.join(base_dir, "text-agent-app", "dist", "index.html")
        if os.path.exists(app_jsx_path) and os.path.exists(dist_index_path):
            if os.path.getmtime(app_jsx_path) > os.path.getmtime(dist_index_path):
                print("[INFO] Rebuilding text-agent-app production bundle...")
                subprocess.run(
                    ["npm", "--prefix", "text-agent-app", "run", "build"],
                    cwd=base_dir,
                    shell=(os.name == "nt"),
                    check=False,
                )
    except Exception as build_err:
        print(f"[WARN] Frontend auto-build skipped: {build_err}", file=sys.stderr)

# Load environment configuration from .env if present
load_dotenv()

app = FastAPI(title="Azure Text Analysis Agent API", version="1.0.0")

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global client and authentication state cache
_openai_client = None
_project_client = None
_active_user_session = None

# Per-request Azure access token supplied by the signed-in user's browser
_request_token: contextvars.ContextVar = contextvars.ContextVar("request_token", default=None)


def _decode_jwt_payload(jwt_token: str) -> dict:
    try:
        parts = jwt_token.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        padding = "=" * ((4 - len(payload_b64) % 4) % 4)
        decoded = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return {}


def _bind_user_token(authorization: Optional[str]) -> None:
    """Binds caller's token if present. If absent, allows DefaultAzureCredential (e.g. from az login)."""
    global _active_user_session
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token:
        claims = _decode_jwt_payload(token)
        exp = int(claims.get("exp", 0) or 0)
        email = (
            claims.get("preferred_username")
            or claims.get("upn")
            or claims.get("email")
            or claims.get("unique_name")
            or ""
        ).strip()
        _request_token.set((token, exp, claims, email))
        _active_user_session = {
            "authenticated": True,
            "name": claims.get("name", ""),
            "email": email,
            "tenant_id": claims.get("tid", ""),
        }
    else:
        _request_token.set(None)


class MsalAzureCredential(TokenCredential):
    """Authenticates Azure AI Foundry SDK calls using the signed-in user's token or CLI session."""

    def get_token(self, *scopes: str, claims: Optional[str] = None, tenant_id: Optional[str] = None, **kwargs) -> AccessToken:
        bound = _request_token.get()
        if not bound:
            return DefaultAzureCredential().get_token(*scopes, claims=claims, tenant_id=tenant_id, **kwargs)
        token, exp, tok_claims, email = bound
        aud = str(tok_claims.get("aud", ""))

        if "ai.azure.com" in aud or "cognitiveservices.azure.com" in aud:
            return AccessToken(token, exp)

        try:
            return DefaultAzureCredential().get_token(*scopes, claims=claims, tenant_id=tenant_id, **kwargs)
        except Exception:
            pass

        return AccessToken(token, exp)


def get_azure_client():
    global _openai_client, _project_client
    if _openai_client is not None:
        return _openai_client

    foundry_endpoint = os.getenv("FOUNDRY_ENDPOINT")
    if not foundry_endpoint or "<your-foundry-resource>" in foundry_endpoint:
        return None

    try:
        _project_client = AIProjectClient(
            endpoint=foundry_endpoint,
            credential=MsalAzureCredential(),
        )
        _openai_client = _project_client.get_openai_client()
        return _openai_client
    except Exception as e:
        print(f"[ERROR] Failed to initialize Azure Project Client: {e}", file=sys.stderr)
        return None


DEFAULT_SYSTEM_INSTRUCTIONS = """You are an Azure AI Text Analysis Agent specializing in Data Privacy, PII Redaction, Named Entity Recognition (NER), and Sentiment Intelligence. Follow the exact output format below based on the requested function:

1. PII REDACTION (Redact PII)
- Replace every piece of Personally Identifiable Information in the input text using ONLY these standardized bracketed tags:
  [Person], [Phone Number], [Email], [Address], [SSN], [Credit Card Number], [Account Number], [Date], [Organization], [Location], [IP Address], [URL], [Password], [Passport Number]
- Output Structure:
  Redacted Text:
  (Full original text with sensitive values replaced inline by the bracketed tags above)

  Redaction Summary:
  - Total Redactions: (Total count of redacted items)
  - Categories Detected: (Comma-separated list of bracketed tags used)

2. SENTIMENT ANALYSIS (Analyze Sentiment)
- Evaluate emotional tone, polarity, and key drivers.
- Output Structure:
  Overall Sentiment: (POSITIVE, NEGATIVE, NEUTRAL, or MIXED)

  Confidence Scores:
  - Positive: (0-100)%
  - Neutral: (0-100)%
  - Negative: (0-100)%

  Assessment:
  (1-2 sentence executive summary of the overall tone)

  Key Drivers:
  - Positive Drivers: (Key phrases or points driving positive sentiment, or None)
  - Negative Drivers: (Key phrases or points driving negative sentiment, or None)

3. ENTITY EXTRACTION (Extract Entities)
- Identify and group all named entities into structured categories.
- Output Structure:
  People & Identifiers:
  - Name / Role: (Details)

  Organizations & Brands:
  - Organization: (Context or Contact)

  Locations & Addresses:
  - Location: (Address, Airport, or City)

  Dates, Numbers & Reference Codes:
  - Type: (Flight Number, Confirmation Code, Account Number, or Date)"""

_custom_system_instructions: Optional[str] = None


def get_active_system_instructions() -> str:
    global _custom_system_instructions
    if _custom_system_instructions is not None:
        return _custom_system_instructions
    env_inst = os.getenv("SYSTEM_INSTRUCTIONS", "").strip()
    return env_inst if env_inst else DEFAULT_SYSTEM_INSTRUCTIONS


# Request & Response Models
class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    system_instructions: Optional[str] = None
    user_email: Optional[str] = None


class AnalyzeRequest(BaseModel):
    text: str
    task: str  # "redact", "sentiment", "entities", "custom"
    custom_prompt: Optional[str] = None
    system_instructions: Optional[str] = None
    user_email: Optional[str] = None


class SystemInstructionsUpdate(BaseModel):
    instructions: str


class TargetConfigUpdate(BaseModel):
    endpoint: str
    model: str
    agent_name: str


@app.get("/api/config/instructions")
def get_system_instructions():
    return {
        "instructions": get_active_system_instructions(),
        "default_instructions": DEFAULT_SYSTEM_INSTRUCTIONS,
    }


@app.post("/api/config/instructions")
def update_system_instructions(req: SystemInstructionsUpdate):
    global _custom_system_instructions
    cleaned = req.instructions.strip()
    _custom_system_instructions = cleaned if cleaned else DEFAULT_SYSTEM_INSTRUCTIONS
    os.environ["SYSTEM_INSTRUCTIONS"] = _custom_system_instructions
    return {
        "status": "saved",
        "instructions": _custom_system_instructions,
    }


@app.get("/api/status")
def get_status():
    endpoint = os.getenv("FOUNDRY_ENDPOINT", "")
    agent_name = os.getenv("AGENT_NAME", "Text-Analysis-Agent")
    model = os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4.1")
    is_ready = bool(endpoint and "<your-foundry-resource>" not in endpoint)

    return {
        "status": "ready" if is_ready else "configuration_needed",
        "endpoint": endpoint,
        "agent_name": agent_name,
        "model": model,
        "endpoint_configured": is_ready,
    }


@app.post("/api/config/target")
def update_target_config(req: TargetConfigUpdate):
    global _openai_client, _project_client
    ep = req.endpoint.strip()
    mdl = req.model.strip()
    ag = req.agent_name.strip()

    # Ephemeral session-only target configuration (never saved or persisted to disk/.env)
    os.environ["FOUNDRY_ENDPOINT"] = ep
    os.environ["MODEL_DEPLOYMENT_NAME"] = mdl
    os.environ["AGENT_NAME"] = ag
    _openai_client = None
    _project_client = None

    return {"status": "connected", "endpoint": ep, "model": mdl, "agent_name": ag}


@app.post("/api/session/clear")
def clear_server_cache():
    global _openai_client, _project_client, _active_user_session
    _openai_client = None
    _project_client = None
    _active_user_session = None
    os.environ["FOUNDRY_ENDPOINT"] = ""
    os.environ["MODEL_DEPLOYMENT_NAME"] = ""
    os.environ["AGENT_NAME"] = ""
    return {"status": "cleared", "message": "Server client cache and session target cleared."}


@app.post("/api/chat")
def chat(req: ChatRequest, authorization: Optional[str] = Header(None)):
    _bind_user_token(authorization)
    client = get_azure_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Azure AI target is not configured. Please enter your Foundry Endpoint, Model Deployment, and Agent Name in the sidebar and click Connect, or configure them in .env."
        )

    agent_name = os.getenv("AGENT_NAME", "Text-Analysis-Agent")
    model = os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4.1")

    active_sys = (req.system_instructions or "").strip() or get_active_system_instructions()
    conv_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    if active_sys and (not conv_messages or conv_messages[0].get("role") != "system"):
        conv_messages.insert(0, {"role": "system", "content": active_sys})

    try:
        response = client.responses.create(
            model=model,
            input=conv_messages,
            extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
        )
        output = response.output_text or ""
        return {"reply": output}
    except Exception as err:
        err_msg = str(err)
        if "agent_reference" in err_msg or "unknown_parameter" in err_msg:
            try:
                chat_resp = client.chat.completions.create(
                    model=model,
                    messages=conv_messages,
                )
                output = chat_resp.choices[0].message.content or ""
                return {"reply": output}
            except Exception as chat_err:
                raise HTTPException(status_code=500, detail=str(chat_err))
        raise HTTPException(status_code=500, detail=err_msg)


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest, authorization: Optional[str] = Header(None)):
    _bind_user_token(authorization)
    client = get_azure_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Azure AI target is not configured. Please enter your Foundry Endpoint, Model Deployment, and Agent Name in the sidebar and click Connect, or configure them in .env."
        )

    agent_name = os.getenv("AGENT_NAME", "Text-Analysis-Agent")
    model = os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4.1")

    if req.task == "redact":
        prompt = (
            "You are a data privacy assistant. Redact all Personally Identifiable Information (PII) "
            "from the following text by replacing sensitive tokens with category tags such as [Person], "
            "[Phone Number], [Email], [Address], [SSN], [Credit Card Number].\n\n"
            f"Text to process:\n{req.text}"
        )
    elif req.task == "sentiment":
        prompt = (
            "Analyze the sentiment and emotional tone of the following text. "
            "Provide:\n- Overall Sentiment (POSITIVE, NEGATIVE, NEUTRAL, MIXED)\n"
            "- Confidence scores\n- Assessment\n- Key Drivers\n\n"
            f"Text to analyze:\n{req.text}"
        )
    elif req.task == "custom":
        user_inst = (req.custom_prompt or "").strip() or "Analyze and summarize the following text."
        prompt = f"{user_inst}\n\nText to process:\n{req.text}"
    else:
        prompt = (
            "Extract all entities, travel logistics, locations, and personal identifiers "
            "from the following text with structured category headers.\n\n"
            f"Text to analyze:\n{req.text}"
        )

    start_time = time.time()
    active_sys = (req.system_instructions or "").strip() or get_active_system_instructions()
    conv_messages = []
    if active_sys:
        conv_messages.append({"role": "system", "content": active_sys})
    conv_messages.append({"role": "user", "content": prompt})

    try:
        response = client.responses.create(
            model=model,
            input=conv_messages,
            extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
        )
        output = response.output_text or ""
    except Exception as err:
        err_msg = str(err)
        if "agent_reference" in err_msg or "unknown_parameter" in err_msg:
            try:
                chat_resp = client.chat.completions.create(
                    model=model,
                    messages=conv_messages,
                )
                output = chat_resp.choices[0].message.content or ""
            except Exception as chat_err:
                raise HTTPException(status_code=500, detail=str(chat_err))
        else:
            raise HTTPException(status_code=500, detail=err_msg)

    elapsed = round(time.time() - start_time, 2)
    return {"result": output, "elapsed": elapsed, "task": req.task}


# Serve React production build
dist_dir = os.path.join(base_dir, "text-agent-app", "dist")
assets_dir = os.path.join(dist_dir, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/")
def serve_index():
    index_file = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Azure Text Analysis API is active", "status": "online"}

@app.get("/{full_path:path}")
def serve_react_app(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
    file_path = os.path.join(dist_dir, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_file = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
