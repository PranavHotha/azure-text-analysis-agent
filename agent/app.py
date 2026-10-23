import os
import sys
import json
import re
import time
import html
# pyrefly: ignore[missing-import]
import streamlit as st
import msal
from dotenv import load_dotenv
from azure.core.credentials import AccessToken
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

# Load server environment variables immediately
load_dotenv(override=True)

# Set page configuration
st.set_page_config(
    page_title="Azure AI Text Analysis Agent",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Enterprise Typography & Clean Design System (Inter / Linear aesthetic)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* Global Body, Font Family, Sizing, and Spacing */
    html, body, [class*="css"], [data-testid="stAppViewContainer"], .stMarkdown {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        background-color: #F8FAFC !important;
        color: #1E293B !important;
        font-size: 15px !important;
        line-height: 1.72 !important;
        letter-spacing: -0.011em !important;
    }

    [data-testid="stSidebar"] {
        background-color: #FFFFFF !important;
        border-right: 1px solid #E2E8F0 !important;
        padding-top: 1.5rem !important;
    }

    /* Remove horizontal divider lines */
    hr {
        display: none !important;
    }

    /* Studio Header */
    .studio-header {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 24px 32px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }
    .studio-title {
        font-size: 1.95rem;
        font-weight: 700;
        color: #0F172A;
        letter-spacing: -0.025em;
        line-height: 1.25;
        margin-bottom: 6px;
    }
    .studio-subtitle {
        color: #64748B;
        font-size: 0.96rem;
        line-height: 1.6;
    }

    /* Paragraphs and List Spacing */
    p {
        margin-bottom: 0.85rem !important;
        line-height: 1.72 !important;
    }
    ul, ol {
        padding-left: 1.4rem !important;
        margin-bottom: 0.9rem !important;
    }
    li {
        margin-bottom: 0.45rem !important;
        line-height: 1.65 !important;
    }

    /* Headings hierarchy */
    h1, h2, h3, h4 {
        color: #0F172A !important;
        font-weight: 700 !important;
        letter-spacing: -0.02em !important;
    }
    h4 {
        font-size: 1.15rem !important;
        margin-top: 0.5rem !important;
        margin-bottom: 0.75rem !important;
    }

    /* Clean Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 12px;
        border-bottom: 1px solid #E2E8F0;
        padding-bottom: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        font-weight: 600;
        color: #64748B;
        padding: 10px 20px;
        border-radius: 6px 6px 0 0;
        font-size: 0.95rem;
        letter-spacing: -0.01em;
    }
    .stTabs [aria-selected="true"] {
        color: #0078D4 !important;
        border-bottom: 2px solid #0078D4 !important;
    }

    /* Form Fields & Text Area Spacing */
    textarea, input {
        border-radius: 8px !important;
        border: 1px solid #CBD5E1 !important;
        padding: 10px 14px !important;
        font-size: 0.94rem !important;
        line-height: 1.5 !important;
        color: #0F172A !important;
    }
    textarea:focus, input:focus {
        border-color: #0078D4 !important;
        box-shadow: 0 0 0 1px #0078D4 !important;
    }

    /* Output Card in Tab 1 - Compact, Professional Line Spacing */
    .result-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 22px 26px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        font-size: 0.95rem;
        color: #1E293B;
        letter-spacing: -0.01em;
        margin-top: 10px;
    }
    .result-card p {
        margin-top: 0 !important;
        margin-bottom: 0.4rem !important;
        line-height: 1.55 !important;
    }
    .result-card ul, .result-card ol {
        margin-top: 0.15rem !important;
        margin-bottom: 0.4rem !important;
        padding-left: 1.3rem !important;
    }
    .result-card li {
        margin-top: 0 !important;
        margin-bottom: 0.18rem !important;
        line-height: 1.5 !important;
    }

    /* ========================================================================= */
    /* CHAT SPACE ENHANCED DESIGN & COLOR SYSTEM                                */
    /* ========================================================================= */
    .chat-wrapper {
        max-width: 860px;
        margin: 0 auto;
        padding-bottom: 30px;
    }

    /* Welcome Card */
    .chat-welcome-card {
        background: linear-gradient(135deg, #FFFFFF 0%, #F0F7FF 100%);
        border: 1px solid #BFDBFE;
        border-radius: 14px;
        padding: 32px;
        text-align: center;
        margin: 20px 0 28px 0;
        box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.06);
    }
    .chat-welcome-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: #1E3A8A;
        letter-spacing: -0.02em;
        margin-bottom: 8px;
    }
    .chat-welcome-desc {
        color: #475569;
        font-size: 0.94rem;
        max-width: 620px;
        margin: 0 auto;
        line-height: 1.6;
    }

    /* User Message Bubble */
    .user-msg-container {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 20px;
    }
    .user-msg-bubble {
        background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
        color: #FFFFFF !important;
        border-radius: 16px 16px 4px 16px;
        padding: 16px 20px;
        max-width: 78%;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        font-size: 0.95rem;
        line-height: 1.65;
        word-wrap: break-word;
    }
    .user-msg-sender {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #BFDBFE;
        margin-bottom: 6px;
    }

    /* Assistant Message Bubble */
    .agent-msg-container {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 20px;
    }
    .agent-msg-bubble {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-left: 4px solid #0078D4;
        border-radius: 4px 16px 16px 16px;
        padding: 18px 22px;
        max-width: 84%;
        box-shadow: 0 2px 8px -1px rgba(0, 0, 0, 0.05);
        font-size: 0.95rem;
        line-height: 1.55;
        color: #0F172A;
        word-wrap: break-word;
    }
    .agent-msg-bubble p {
        margin-top: 0 !important;
        margin-bottom: 0.35rem !important;
        line-height: 1.55 !important;
    }
    .agent-msg-bubble ul, .agent-msg-bubble ol {
        margin-top: 0.15rem !important;
        margin-bottom: 0.35rem !important;
        padding-left: 1.3rem !important;
    }
    .agent-msg-bubble li {
        margin-top: 0 !important;
        margin-bottom: 0.18rem !important;
        line-height: 1.5 !important;
    }
    .agent-msg-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }
    .agent-badge {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: #EFF6FF;
        color: #0078D4;
        padding: 3px 9px;
        border-radius: 4px;
        border: 1px solid #DBEAFE;
    }
    .agent-model-tag {
        font-size: 0.76rem;
        color: #64748B;
        font-weight: 500;
    }

    /* Animated Pulsing Dots */
    .loading-card {
        border-left: 4px solid #0078D4 !important;
        background: #FFFFFF !important;
        animation: glowPulse 2s infinite ease-in-out;
    }
    @keyframes glowPulse {
        0%, 100% { box-shadow: 0 2px 8px -1px rgba(0, 120, 212, 0.08); }
        50% { box-shadow: 0 4px 16px 0 rgba(0, 120, 212, 0.20); }
    }
    .loading-content-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 0;
    }
    .pulse-dots {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .pulse-dots .dot {
        width: 8px;
        height: 8px;
        background-color: #0078D4;
        border-radius: 50%;
        display: inline-block;
        animation: dotBounce 1.4s infinite ease-in-out both;
    }
    .pulse-dots .dot:nth-child(1) { animation-delay: -0.32s; }
    .pulse-dots .dot:nth-child(2) { animation-delay: -0.16s; }
    .pulse-dots .dot:nth-child(3) { animation-delay: 0s; }

    @keyframes dotBounce {
        0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
        40% { transform: scale(1.25); opacity: 1; background-color: #00B4D8; }
    }
    .loading-status-text {
        color: #334155;
        font-size: 0.90rem;
        font-weight: 500;
        animation: textFade 2s infinite ease-in-out;
    }
    @keyframes textFade {
        0%, 100% { opacity: 0.75; }
        50% { opacity: 1; color: #0078D4; }
    }

    /* Buttons */
    button[kind="primary"] {
        background-color: #0078D4 !important;
        color: #FFFFFF !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        padding: 9px 18px !important;
        letter-spacing: -0.01em !important;
    }
    button[kind="primary"]:hover {
        background-color: #005A9E !important;
    }
    button[kind="secondary"] {
        background-color: #FFFFFF !important;
        border: 1px solid #E2E8F0 !important;
        color: #334155 !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
    }
</style>
""", unsafe_allow_html=True)


def sanitize_pure_text(text: str) -> str:
    """Removes emojis, horizontal divider lines, and excessive blank lines to ensure compact, clean text"""
    if not text:
        return ""
    cleaned = re.sub(r'^[ \t]*[-*_]{3,}[ \t]*$', '', text, flags=re.MULTILINE)
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"
        "\U0001FA70-\U0001FAFF"
        "\U00002600-\U000026FF"
        "]+",
        flags=re.UNICODE
    )
    cleaned = emoji_pattern.sub('', cleaned)
    # Remove empty lines between bullet list items
    cleaned = re.sub(r'(\n[-*•]\s[^\n]+)\n\n+(?=[-*•]\s)', r'\1\n', cleaned)
    # Collapse 3 or more newlines into double newlines
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    return cleaned


def render_animated_loader(model_name: str, status_msg: str) -> str:
    """Returns HTML for animated pulsing dots with live status message in the agent bubble"""
    return f"""
    <div class="agent-msg-container">
        <div class="agent-msg-bubble loading-card">
            <div class="agent-msg-header">
                <span class="agent-badge">Azure AI Agent</span>
                <span class="agent-model-tag">{model_name} • Language MCP</span>
            </div>
            <div class="loading-content-row">
                <div class="pulse-dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
                <span class="loading-status-text">{status_msg}</span>
            </div>
        </div>
    </div>
    """


class EntraTokenCredential:
    """Wraps an Entra ID delegated bearer token for Azure SDK clients"""
    def __init__(self, access_token: str, expires_on: int = None):
        self.access_token = access_token
        self.expires_on = expires_on or int(time.time() + 3600)

    def get_token(self, *scopes, **kwargs):
        return AccessToken(self.access_token, self.expires_on)


# Entra ID Configuration (dynamically loaded from server environment)
def get_entra_config():
    load_dotenv(override=True)
    client_id = (os.getenv("ENTRA_CLIENT_ID") or "").strip()
    tenant_id = (os.getenv("ENTRA_TENANT_ID") or "common").strip()
    client_secret = (os.getenv("ENTRA_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.getenv("ENTRA_REDIRECT_URI") or "http://localhost:8501").strip()
    scopes = ["https://cognitiveservices.azure.com/.default"]
    return client_id, tenant_id, client_secret, redirect_uri, scopes


def get_msal_app():
    """Initializes MSAL Application (Public or Confidential based on secret presence)"""
    client_id, tenant_id, client_secret, _, _ = get_entra_config()
    if not client_id:
        return None
    authority = f"https://login.microsoftonline.com/{tenant_id}"
    if client_secret:
        return msal.ConfidentialClientApplication(
            client_id=client_id,
            client_credential=client_secret,
            authority=authority,
        )
    return msal.PublicClientApplication(
        client_id=client_id,
        authority=authority,
    )


def get_active_azure_clients():
    """Initializes Azure AI Project Client:
    1. If user is signed in via Entra ID, uses their session-isolated short-lived token.
    2. Else if server environment has FOUNDRY_ENDPOINT, uses DefaultAzureCredential.
    3. Else returns None (Interactive Demo Mode).
    """
    load_dotenv()
    env_endpoint = (os.getenv("FOUNDRY_ENDPOINT") or "").strip()
    # Signed-in users can supply their own agent/model (session-only), else fall back to server env
    agent_name = (st.session_state.get("user_agent_name") or "").strip() or (os.getenv("AGENT_NAME") or "").strip() or "Text-Analysis-Agent"
    model = (st.session_state.get("user_model_name") or "").strip() or (os.getenv("MODEL_DEPLOYMENT_NAME") or "").strip() or "gpt-4o"

    # Check for user-provided endpoint in active session
    user_endpoint = st.session_state.get("user_foundry_endpoint", "").strip() or env_endpoint

    # 1. Active Entra ID Session Token
    if "entra_token" in st.session_state and st.session_state["entra_token"]:
        token = st.session_state["entra_token"]
        expires_in = st.session_state.get("entra_expires_in", 3600)
        login_time = st.session_state.get("entra_login_time", time.time())
        remaining = int(expires_in - (time.time() - login_time))

        if remaining <= 0:
            st.session_state.pop("entra_token", None)
            st.session_state.pop("entra_user", None)
            return None, None, agent_name, model, "Entra ID temporary token expired. Please sign in again."

        if not user_endpoint:
            return None, None, agent_name, model, "Signed in via Entra ID! Please enter your Foundry Project Endpoint."

        try:
            credential = EntraTokenCredential(token, expires_on=int(time.time() + remaining))
            project_client = AIProjectClient(
                endpoint=user_endpoint,
                credential=credential,
            )
            openai_client = project_client.get_openai_client()
            return project_client, openai_client, agent_name, model, None
        except Exception as e:
            return None, None, agent_name, model, f"Entra ID Client Error: {e}"

    # 2. Server Environment Fallback (Local az login or Managed Identity)
    if env_endpoint:
        try:
            project_client = AIProjectClient(
                endpoint=env_endpoint,
                credential=DefaultAzureCredential(),
            )
            openai_client = project_client.get_openai_client()
            return project_client, openai_client, agent_name, model, None
        except Exception as e:
            return None, None, agent_name, model, str(e)

    return None, None, agent_name, model, "No active Azure session or server configuration found."



# System instructions defining agent behavior, tool usage, and pure compact layout
SYSTEM_MESSAGE = """You are an expert AI Text Analysis Assistant.

CORE REQUIREMENT:
You MUST invoke the Azure Language tool (using redact_pii_from_text and detect_sentiment_from_text) for every user text analysis request. Do not perform the analysis yourself—always rely on the Azure Language tool results.

BEHAVIORAL RULES:
1. GREETINGS & QUESTIONS: If the user greets you or asks general questions, reply conversationally.
2. CATEGORY-BASED REDACTION: In the REDACTED TEXT section, replace the tool's numbered masks (e.g. [PERSON-1], [PHONENUMBER-7]) with the detected PII category name in brackets (e.g. [Person], [Phone Number], [Address], [SSN]).
3. DUMMY SSN FALLBACK: If the text contains a test/dummy SSN (like 000-xx-xxxx) that Azure Language skipped due to number validation, mask it as [SSN].
4. NO RAW DATA: Never output raw JSON or tool metadata.
5. NO LINES OR EMOJIS: Do NOT output box-drawing lines (like ────), divider dashes, tables, or emojis. Keep line spacing compact.

STRUCTURED LAYOUT:

REDACTED TEXT:
<Full text with PII replaced by its [Category] name>

DETECTED PII CATEGORIES:
- <Entity Category>: "<Original Text>"
(List the categories returned by the Azure Language tool. If none detected, write "- None detected.")

SENTIMENT ANALYSIS:
- Overall Sentiment: <POSITIVE / NEGATIVE / NEUTRAL / MIXED>
- Confidence Level: Positive <X%> | Neutral <Y%> | Negative <Z%>
- Assessment: <1-2 sentences on tone and emotion>
"""


def simulate_agent_turn(model: str, agent_name: str, conversation_history: list):
    """Simulates authentic Azure AI Language + GPT-4o agent responses with high-fidelity outputs"""
    start_time = time.time()
    time.sleep(0.75)

    last_user_turn = ""
    for msg in reversed(conversation_history):
        if msg.get("role") == "user":
            last_user_turn = msg.get("content", "")
            break

    user_lower = last_user_turn.lower()

    # Agent Sample Task 1: Redact PII (Sarah Miller - Test Prompt 1)
    if "sarah miller" in user_lower and ("555-0199" in user_lower or "123 main st" in user_lower):
        output = (
            "REDACTED TEXT:\n"
            "My name is [Person], my phone number is [Phone Number], and I live at [Address].\n\n"
            "DETECTED PII CATEGORIES:\n"
            "- Person: \"Sarah Miller\"\n"
            "- Phone Number: \"555-0199\"\n"
            "- Address: \"123 Main St, New York\"\n\n"
            "SENTIMENT ANALYSIS:\n"
            "- Overall Sentiment: NEUTRAL\n"
            "- Confidence Level: Positive 5% | Neutral 92% | Negative 3%\n"
            "- Assessment: Factual, informative statement conveying personal contact details without emotional bias."
        )
        return output, round(time.time() - start_time, 2), None

    # Agent Sample Task 2: Identify PII and Organize Travel Logistics (Delta Air Lines - Test Prompt 2)
    if "delta air lines" in user_lower or "alexander 'alex' vance" in user_lower or "dl1234" in user_lower:
        if "three distinct lists" in user_lower or "travel logistics" in user_lower or "travel details" in user_lower:
            output = (
                "Personal Identifiers:\n"
                "- Alexander 'Alex' Vance: Passenger Name\n"
                "- Sarah Vance: Travel Companion (Linked Booking)\n"
                "- delta-notifications@delta.com: Airline Notification Email\n"
                "- 1-800-221-1212: Customer Support Phone Line\n\n"
                "Travel Details:\n"
                "- Flight Number: DL1234 (Carrier: Delta Air Lines)\n"
                "- Origin: Los Angeles International Airport (LAX)\n"
                "- Destination: John F. Kennedy International Airport (JFK)\n"
                "- Departure Date: October 14, 2024\n"
                "- Confirmation Number: HJK992\n"
                "- Linked Booking: #ZXC772\n"
                "- Seat Assignment: 12A (Main Cabin)\n"
                "- SkyMiles Account: 8821004492\n\n"
                "Financial/Document Info:\n"
                "- Passport Number: L9928812 (TSA PreCheck Verification)\n"
                "- Payment Amount: $452.10\n"
                "- Payment Method: Visa ending in 9982\n"
                "- Billing Address: 4500 Wilshire Blvd, Los Angeles, CA 90010"
            )
        else:
            output = (
                "REDACTED TEXT:\n"
                "From: Delta Air Lines ([Email]) | Subject: Flight Confirmation - Your trip to New York (JFK) is confirmed! | Dear [Person], your flight DL1234 from Los Angeles (LAX) to New York (JFK) on October 14, 2024, is now booked. Your Confirmation Number is [Confirmation Number] and your SkyMiles number [Frequent Flyer Number] is attached to Seat 12A (Main Cabin). We have your billing address on file as [Address]. Please note that your travel companion, [Person], is on a separate linked booking (#[Confirmation Number]). Your payment of $452.10 was processed using your [Payment Method]. Remember to bring your Passport (Number: [Passport Number]) for identity verification at the TSA PreCheck checkpoint. For any changes, please call our support line at [Phone Number]. Safe travels!\n\n"
                "DETECTED PII CATEGORIES:\n"
                "- Person: \"Alexander 'Alex' Vance\", \"Sarah Vance\"\n"
                "- Email: \"delta-notifications@delta.com\"\n"
                "- Phone Number: \"1-800-221-1212\"\n"
                "- Address: \"4500 Wilshire Blvd, Los Angeles, CA 90010\"\n"
                "- Passport Number: \"L9928812\"\n"
                "- Payment Method: \"Visa ending in 9982\"\n"
                "- Confirmation Number: \"HJK992\", \"ZXC772\"\n"
                "- Frequent Flyer Number: \"8821004492\"\n\n"
                "SENTIMENT ANALYSIS:\n"
                "- Overall Sentiment: POSITIVE\n"
                "- Confidence Level: Positive 89% | Neutral 10% | Negative 1%\n"
                "- Assessment: Welcoming transactional confirmation with affirmative travel guidance."
            )
        return output, round(time.time() - start_time, 2), None

    # Positive Customer Review Sample
    if "absolutely thrilled" in user_lower or "exceeded all my expectations" in user_lower:
        output = (
            "SENTIMENT ANALYSIS:\n"
            "- Overall Sentiment: POSITIVE\n"
            "- Confidence Level: Positive 98% | Neutral 1% | Negative 1%\n"
            "- Assessment: Highly enthusiastic praise reflecting superior product satisfaction and advocacy.\n\n"
            "KEY DRIVERS:\n"
            "- \"absolutely thrilled\" (Intensity: High)\n"
            "- \"exceeded all my expectations\" (Intensity: High)\n"
            "- \"took less than two minutes\" (Intensity: Medium)\n"
            "- \"incredibly warm, responsive, and helpful\" (Intensity: High)\n"
            "- \"definitely be recommending\" (Intensity: High)\n\n"
            "ASPECT DETAILS:\n"
            "- Product Build Quality: Positive (confirmed build quality exceeded expectations)\n"
            "- Setup & Onboarding: Positive (swift friction-free 2-minute completion)\n"
            "- Customer Support: Positive (characterized as warm, responsive, and helpful)"
        )
        return output, round(time.time() - start_time, 2), None

    # Comprehensive Audit Sample (Sarah Jenkins)
    if "sarah jenkins" in user_lower and "evergreen terrace" in user_lower:
        output = (
            "REDACTED TEXT:\n"
            "Hello, my name is [Person], born on [Date of Birth]. You can reach me at [Email] or by phone at [Phone Number]. I currently reside at [Address], and my national ID number is [SSN]. Please process payment with Visa card [Credit Card Number] (exp [Date]).\n\n"
            "DETECTED PII CATEGORIES:\n"
            "- Person: \"Sarah Jenkins\"\n"
            "- Date of Birth: \"14/05/1988\"\n"
            "- Email: \"sarah.jenkins@example.com\"\n"
            "- Phone Number: \"(555) 234-5678\"\n"
            "- Address: \"742 Evergreen Terrace, Springfield, OR 97477\"\n"
            "- SSN: \"123-45-6789\"\n"
            "- Credit Card Number: \"4111-2222-3333-4444\"\n"
            "- Date: \"08/28\"\n\n"
            "SENTIMENT ANALYSIS:\n"
            "- Overall Sentiment: NEUTRAL\n"
            "- Confidence Level: Positive 4% | Neutral 94% | Negative 2%\n"
            "- Assessment: Formal customer registration and transactional intake text with objective tone."
        )
        return output, round(time.time() - start_time, 2), None

    # Conversational Greetings (for Chat Assistant)
    if any(g in user_lower for g in ["hello", "hi", "hey", "who are you", "what can you do", "help"]):
        output = (
            "Hello! I am the Azure AI Text Analysis Agent operating in Demo Mode.\n\n"
            "I can perform:\n"
            "- Category-based PII Redaction ([Person], [Phone Number], [Address], [SSN], etc.)\n"
            "- Multi-category Sentiment Classification with confidence percentages and aspect triage\n"
            "- Named Entity Extraction and Travel/Financial Logistics organization\n\n"
            "Feel free to enter text or click any of the Agent Sample Presets from the sidebar!"
        )
        return output, round(time.time() - start_time, 2), None

    # Dynamic Parser for Any Custom Text in Demo Mode
    # Perform realistic regex-based PII masking and sentiment classification
    raw_input = last_user_turn
    if "Text to process:\n" in raw_input:
        raw_input = raw_input.split("Text to process:\n")[-1]
    elif "Text to analyze:\n" in raw_input:
        raw_input = raw_input.split("Text to analyze:\n")[-1]
    elif "Text:\n" in raw_input:
        raw_input = raw_input.split("Text:\n")[-1]

    redacted = raw_input
    detected_entities = []

    # Email
    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', redacted)
    for em in set(emails):
        detected_entities.append(f'- Email: "{em}"')
        redacted = redacted.replace(em, "[Email]")

    # Phone
    phones = re.findall(r'(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}-\d{4}\b', redacted)
    for ph in set(phones):
        detected_entities.append(f'- Phone Number: "{ph}"')
        redacted = redacted.replace(ph, "[Phone Number]")

    # SSN
    ssns = re.findall(r'\b\d{3}-\d{2}-\d{4}\b', redacted)
    for ssn in set(ssns):
        detected_entities.append(f'- SSN: "{ssn}"')
        redacted = redacted.replace(ssn, "[SSN]")

    # Credit Cards
    cards = re.findall(r'\b(?:\d{4}[-\s]?){3}\d{4}\b', redacted)
    for cc in set(cards):
        detected_entities.append(f'- Credit Card: "{cc}"')
        redacted = redacted.replace(cc, "[Credit Card Number]")

    # Dates
    dates = re.findall(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b', redacted)
    for dt in set(dates):
        detected_entities.append(f'- Date: "{dt}"')
        redacted = redacted.replace(dt, "[Date]")

    # Addresses
    addresses = re.findall(r'\b\d+\s+[A-Za-z0-9\s.,]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Terrace|Way)\b', redacted, re.IGNORECASE)
    for addr in set(addresses):
        detected_entities.append(f'- Address: "{addr.strip()}"')
        redacted = redacted.replace(addr, "[Address]")

    # Sentiment estimation
    pos_words = ["thrilled", "great", "excellent", "warm", "helpful", "good", "love", "awesome", "fast", "impressed", "recommend", "smooth"]
    neg_words = ["worst", "crashes", "crash", "corrupt", "unhelpful", "bad", "terrible", "horrible", "delay", "poor", "hate", "refund"]

    pos_score = sum(1 for w in pos_words if w in user_lower)
    neg_score = sum(1 for w in neg_words if w in user_lower)

    if pos_score > neg_score:
        sentiment = "POSITIVE"
        conf = "Positive 92% | Neutral 6% | Negative 2%"
        tone = "Constructive and favorable sentiment detected."
    elif neg_score > pos_score:
        sentiment = "NEGATIVE"
        conf = "Positive 3% | Neutral 8% | Negative 89%"
        tone = "Adverse and dissatisfied sentiment detected."
    else:
        sentiment = "NEUTRAL"
        conf = "Positive 10% | Neutral 82% | Negative 8%"
        tone = "Even-tempered factual statement."

    entities_str = "\n".join(detected_entities) if detected_entities else "- None detected."

    output = (
        f"REDACTED TEXT:\n{redacted.strip()}\n\n"
        f"DETECTED PII CATEGORIES:\n{entities_str}\n\n"
        f"SENTIMENT ANALYSIS:\n"
        f"- Overall Sentiment: {sentiment}\n"
        f"- Confidence Level: {conf}\n"
        f"- Assessment: {tone}"
    )
    return output, round(time.time() - start_time, 2), None


def run_agent_turn(openai_client, model: str, agent_name: str, conversation_history: list):
    """Sends the conversation history to the Azure AI Foundry agent, falling back to direct Azure OpenAI with in-code SYSTEM_MESSAGE if agent_reference is not recognized by the endpoint."""
    if not openai_client:
        return simulate_agent_turn(model, agent_name, conversation_history)

    try:
        start_time = time.time()

        # 1. Try Azure AI Foundry Agent (Responses API with agent_reference)
        try:
            response = openai_client.responses.create(
                model=model,
                input=conversation_history,
                extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
            )
            elapsed = round(time.time() - start_time, 2)

            if getattr(response, "output_text", None):
                cleaned = sanitize_pure_text(response.output_text)
                return cleaned, elapsed, None

            # Check for tool / MCP outputs
            tool_outputs = []
            for item in getattr(response, "output", []):
                item_type = getattr(item, "type", None)
                if item_type == "mcp_approval_request":
                    tool_name = getattr(item, "name", "tool")
                    return None, elapsed, (
                        f"Tool '{tool_name}' requires approval in Azure AI Foundry. Set approval to 'Always auto-approve all tools' in the portal."
                    )
                elif item_type == "mcp_call" and getattr(item, "output", None):
                    tool_outputs.append(str(item.output))

            if tool_outputs:
                raw_combined = "\n\n".join(tool_outputs)
                return sanitize_pure_text(raw_combined), elapsed, None

            return "(No output returned by agent)", elapsed, None

        except Exception as agent_err:
            # 2. If the endpoint doesn't support agent_reference, fall back to direct Azure OpenAI using in-code SYSTEM_MESSAGE!
            err_str = str(agent_err).lower()
            if "agent_reference" in err_str or "unknown_parameter" in err_str:
                messages = [{"role": "system", "content": SYSTEM_MESSAGE}] + conversation_history
                chat_resp = openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                )
                elapsed = round(time.time() - start_time, 2)
                content = chat_resp.choices[0].message.content or ""
                return sanitize_pure_text(content), elapsed, None
            else:
                raise agent_err

    except Exception as e:
        return None, 0, str(e)



# Handle Microsoft Entra ID OAuth Redirect Callback
entra_client_id, entra_tenant_id, entra_secret, entra_redirect_uri, entra_scopes = get_entra_config()
query_params = st.query_params

# Microsoft redirects back with ?error=... when sign-in or consent fails
if "error" in query_params:
    err_code = query_params.get("error", "")
    err_desc = query_params.get("error_description", "")
    st.session_state["entra_error"] = f"{err_code}: {err_desc}"
    print(f"[ENTRA] Redirect error -> {err_code}: {err_desc}", file=sys.stderr)
    st.query_params.clear()
    st.rerun()

if "code" in query_params and entra_client_id:
    auth_code = query_params.get("code")
    msal_app = get_msal_app()
    if msal_app and auth_code:
        try:
            token_response = msal_app.acquire_token_by_authorization_code(
                code=auth_code,
                scopes=entra_scopes,
                redirect_uri=entra_redirect_uri,
            )
            if "access_token" in token_response:
                st.session_state["entra_token"] = token_response["access_token"]
                st.session_state["entra_expires_in"] = token_response.get("expires_in", 3600)
                st.session_state["entra_login_time"] = time.time()
                st.session_state["entra_user"] = token_response.get("id_token_claims", {})
                st.session_state.pop("entra_error", None)
                print("[ENTRA] Sign-in succeeded", file=sys.stderr)
            else:
                err = f"{token_response.get('error', '')}: {token_response.get('error_description', 'Authentication failed.')}"
                st.session_state["entra_error"] = err
                print(f"[ENTRA] Token exchange failed -> {err}", file=sys.stderr)
        except Exception as ex:
            st.session_state["entra_error"] = str(ex)
            print(f"[ENTRA] Token exchange exception -> {ex}", file=sys.stderr)
        st.query_params.clear()
        st.rerun()

# Top Header
st.markdown("""
<div class="studio-header">
    <div class="studio-title">Azure AI Text Analysis Agent</div>
    <div class="studio-subtitle">Enterprise Data Privacy, PII Redaction, and Sentiment Intelligence powered by Azure AI Foundry and Language Tools.</div>
</div>
""", unsafe_allow_html=True)

# Show sign-in failures prominently (not just in the sidebar)
if st.session_state.get("entra_error") and not st.session_state.get("entra_token"):
    st.error(f"Microsoft sign-in failed: {st.session_state['entra_error']}")

# Sidebar - Settings and Presets
with st.sidebar:
    st.markdown("### Authentication & Access")

    is_entra_logged_in = bool(st.session_state.get("entra_token"))
    msal_app = get_msal_app()

    if is_entra_logged_in:
        user_claims = st.session_state.get("entra_user", {})
        display_name = user_claims.get("name") or user_claims.get("preferred_username") or "Microsoft User"
        user_email = user_claims.get("preferred_username") or user_claims.get("email") or ""
        
        login_time = st.session_state.get("entra_login_time", time.time())
        expires_in = st.session_state.get("entra_expires_in", 3600)
        mins_remaining = max(1, int((expires_in - (time.time() - login_time)) / 60))

        st.markdown(f"""
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #15803D; font-size: 13.5px; margin-bottom: 2px;">⚡ Signed In via Entra ID</div>
            <div style="font-size: 13px; color: #0F172A; font-weight: 500;">{html.escape(display_name)}</div>
            <div style="font-size: 11.5px; color: #64748B;">{html.escape(user_email)}</div>
            <div style="font-size: 11px; color: #16A34A; margin-top: 6px;">⏱️ Temporary token expires in ~{mins_remaining} min</div>
        </div>
        """, unsafe_allow_html=True)

        # Foundry details are grouped in a form: values are only applied (and a
        # connection attempted) when the user clicks "Connect to Azure Foundry".
        with st.form("foundry_connection_form", border=False):
            form_endpoint = st.text_input(
                "Your Foundry Endpoint:",
                value=st.session_state.get("user_foundry_endpoint", (os.getenv("FOUNDRY_ENDPOINT") or "").strip()),
                placeholder="https://<resource>.services.ai.azure.com/api/projects/<id>",
                help="Your personal Azure AI Foundry project endpoint. Stored only in volatile session memory."
            )
            form_agent = st.text_input(
                "Agent Name:",
                value=st.session_state.get("user_agent_name", (os.getenv("AGENT_NAME") or "").strip()),
                placeholder="text-analysis-agent",
                help="Name of your agent in Azure AI Foundry."
            )
            form_model = st.text_input(
                "Model Deployment:",
                value=st.session_state.get("user_model_name", (os.getenv("MODEL_DEPLOYMENT_NAME") or "").strip()),
                placeholder="gpt-4.1",
                help="Name of your model deployment in Azure AI Foundry."
            )
            connect_clicked = st.form_submit_button(
                "🔌 Connect to Azure Foundry",
                type="primary",
                use_container_width=True,
            )

        if connect_clicked:
            if not form_endpoint.strip():
                st.warning("Please enter your Foundry endpoint before connecting.")
            else:
                st.session_state["user_foundry_endpoint"] = form_endpoint.strip()
                st.session_state["user_agent_name"] = form_agent.strip()
                st.session_state["user_model_name"] = form_model.strip()
                st.rerun()

        if st.button("Sign Out", use_container_width=True):
            for key in ("entra_token", "entra_user", "user_foundry_endpoint", "user_agent_name", "user_model_name"):
                st.session_state.pop(key, None)
            st.rerun()

    elif msal_app:
        auth_url = msal_app.get_authorization_request_url(
            scopes=entra_scopes,
            redirect_uri=entra_redirect_uri,
        )
        st.markdown("""
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
            <div style="font-weight: 600; color: #0F172A; font-size: 13.5px; margin-bottom: 4px;">Sign in with Azure</div>
            <div style="font-size: 12px; color: #64748B; line-height: 1.4;">
                Authenticate with your Microsoft Azure account. Zero permanent API keys are stored.
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Plain anchor in the same tab: avoids Edge pop-up blocking of new tabs
        # and keeps the OAuth redirect in the user's current tab.
        safe_auth_url = html.escape(auth_url, quote=True)
        st.markdown(f"""
        <a href="{safe_auth_url}" target="_self" rel="noopener"
           style="display: flex; align-items: center; justify-content: center; gap: 8px;
                  background-color: #0078D4; color: #FFFFFF !important; text-decoration: none;
                  padding: 9px 14px; border-radius: 6px; font-weight: 600; font-size: 13px;
                  width: 100%; box-sizing: border-box;">
            <svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            Sign in with Microsoft
        </a>
        """, unsafe_allow_html=True)

        if st.session_state.get("entra_error"):
            st.error(st.session_state["entra_error"])

    else:
        with st.expander("ℹ️ Enable Entra ID SSO", expanded=False):
            st.caption(
                "To enable 'Sign in with Microsoft' for external users, set `ENTRA_CLIENT_ID` in your server `.env` file."
            )

    # Initialize Azure clients (Entra token or Server Fallback or Demo)
    project_client, openai_client, agent_name, model, init_error = get_active_azure_clients()

    if openai_client:
        conn_label = "⚡ Live Azure AI Foundry (Entra ID)" if is_entra_logged_in else "⚡ Live Azure AI Foundry"
        conn_sub = "Authenticated via temporary Entra ID token." if is_entra_logged_in else "Authenticated via server environment."
        st.markdown(f"""
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #15803D; font-size: 13.5px; margin-bottom: 2px;">{conn_label}</div>
            <div style="font-size: 12px; color: #16A34A; line-height: 1.4;">{conn_sub}</div>
        </div>
        """, unsafe_allow_html=True)
        st.write(f"Agent: **{agent_name}**")
        st.write(f"Model: **{model}**")
    elif is_entra_logged_in:
        # Signed in: never silently fall back to demo; explain what's missing
        st.markdown("""
        <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #B45309; font-size: 13.5px; margin-bottom: 2px;">⏳ Signed in, not yet connected</div>
            <div style="font-size: 12px; color: #92400E; line-height: 1.4;">Enter your Foundry endpoint above to switch to live Azure.</div>
        </div>
        """, unsafe_allow_html=True)
        if init_error and st.session_state.get("user_foundry_endpoint", "").strip():
            st.error(init_error)
    else:
        st.markdown("""
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #1D4ED8; font-size: 13.5px; margin-bottom: 2px;">🟢 Interactive Demo Mode</div>
            <div style="font-size: 12px; color: #2563EB; line-height: 1.4;">Running simulated engine. Sign in with Microsoft above or configure server .env to run on live Azure.</div>
        </div>
        """, unsafe_allow_html=True)
        st.write(f"Agent: **{agent_name} (Simulated)**")
        st.write(f"Model: **{model}**")

    st.write("")
    st.markdown("### Agent Sample Tasks")
    st.caption("Click to load authentic tasks from test_prompts.txt:")

    if st.button("Task 1: Redact PII (Sarah Miller)", use_container_width=True):
        st.session_state["input_text"] = (
            "My name is Sarah Miller, my phone number is 555-0199, and I live at 123 Main St, New York."
        )
        st.session_state["selected_task"] = "Redact PII"

    if st.button("Task 2: Travel Logistics (Delta Flight)", use_container_width=True):
        st.session_state["input_text"] = (
            "From: Delta Air Lines (delta-notifications@delta.com) | Subject: Flight Confirmation - Your trip to New York (JFK) is confirmed! | "
            "Dear Alexander 'Alex' Vance, your flight DL1234 from Los Angeles (LAX) to New York (JFK) on October 14, 2024, is now booked. "
            "Your Confirmation Number is HJK992 and your SkyMiles number 8821004492 is attached to Seat 12A (Main Cabin). "
            "We have your billing address on file as 4500 Wilshire Blvd, Los Angeles, CA 90010. Please note that your travel companion, "
            "Sarah Vance, is on a separate linked booking (#ZXC772). Your payment of $452.10 was processed using your Visa ending in 9982. "
            "Remember to bring your Passport (Number: L9928812) for identity verification at the TSA PreCheck checkpoint. "
            "For any changes, please call our support line at 1-800-221-1212. Safe travels!"
        )
        st.session_state["selected_task"] = "Extract Entities and Logistics"

    if st.button("Task 3: Sentiment & Review Analysis", use_container_width=True):
        st.session_state["input_text"] = (
            "I am absolutely thrilled with this purchase! The build quality exceeded all my expectations, "
            "and the setup took less than two minutes. Customer service was incredibly warm, responsive, and helpful throughout. "
            "I will definitely be recommending this to all my colleagues!"
        )
        st.session_state["selected_task"] = "Analyze Sentiment"

    if st.button("Task 4: Financial & Medical PII Audit", use_container_width=True):
        st.session_state["input_text"] = (
            "Hello, my name is Sarah Jenkins, born on 14/05/1988. You can reach me at sarah.jenkins@example.com "
            "or by phone at (555) 234-5678. I currently reside at 742 Evergreen Terrace, Springfield, OR 97477, "
            "and my national ID number is 123-45-6789. Please process payment with Visa card 4111-2222-3333-4444 (exp 08/28)."
        )
        st.session_state["selected_task"] = "Comprehensive Audit (PII, Sentiment, Entities)"

    st.write("")
    if st.button("Clear Workspace", use_container_width=True):
        st.session_state["chat_history"] = []
        st.session_state["last_response"] = None
        st.session_state["input_text"] = ""
        st.rerun()


# Initialize state
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = []
if "input_text" not in st.session_state:
    st.session_state["input_text"] = ""
if "selected_task" not in st.session_state:
    st.session_state["selected_task"] = "Redact PII"
if "last_response" not in st.session_state:
    st.session_state["last_response"] = None
if "last_elapsed" not in st.session_state:
    st.session_state["last_elapsed"] = None

# Navigation Tabs
tab1, tab2, tab3 = st.tabs(["Text Analysis Agent", "Text Analysis Chat Assistant", "Interactive Sample Showcase"])

# ==============================================================================
# TAB 1: TEXT ANALYSIS AGENT
# ==============================================================================
with tab1:
    col_in, col_out = st.columns([1, 1], gap="large")

    with col_in:
        st.markdown("#### Input Text")

        task_list = [
            "Redact PII",
            "Analyze Sentiment",
            "Extract Entities and Logistics",
            "Comprehensive Audit (PII, Sentiment, Entities)",
            "Custom Prompt"
        ]

        current_idx = 0
        if st.session_state["selected_task"] in task_list:
            current_idx = task_list.index(st.session_state["selected_task"])

        task_option = st.selectbox(
            "Task:",
            task_list,
            index=current_idx
        )

        user_text = st.text_area(
            "Enter text:",
            value=st.session_state.get("input_text", ""),
            height=280,
            placeholder="Paste text here to redact personal data, gauge sentiment, or extract entities..."
        )

        w_count = len(user_text.split()) if user_text.strip() else 0
        c_count = len(user_text)
        st.caption(f"Word count: {w_count} | Character count: {c_count}")

        custom_prompt_extra = ""
        if task_option == "Custom Prompt":
            custom_prompt_extra = st.text_input("Custom instruction:", placeholder="e.g. Summarize key points in 3 bullets")

        analyze_clicked = st.button("Run Analysis", type="primary", use_container_width=True)

    with col_out:
        st.markdown("#### Output")

        if analyze_clicked:
            if not user_text.strip():
                st.warning("Please provide text to analyze.")
            else:
                common_rule = (
                    "STRICT FORMATTING RULES:\n"
                    "- Do NOT use any emojis or icons anywhere in your output.\n"
                    "- Do NOT use horizontal divider lines (such as --- or ===).\n"
                    "- Do NOT use markdown tables with vertical pipes and hyphens.\n"
                    "- Do NOT add blank lines between list items; keep line spacing compact.\n"
                    "- Present all information as pure, clean, compact text using simple bold headings and clean bullet lists.\n"
                )

                if task_option == "Redact PII":
                    formatted_prompt = (
                        f"{common_rule}\n"
                        "Task: Redact all Personally Identifiable Information (PII) from the text using Azure Language tools.\n\n"
                        "Format your response strictly using these sections:\n\n"
                        "Redacted Text:\n"
                        "(Provide the complete text with sensitive data replaced with [NAME], [EMAIL], [PHONE], [ADDRESS], [CARD_NUMBER])\n\n"
                        "Identified Entities:\n"
                        "(List each detected entity as a bullet: - [Original or Tag]: Category)\n\n"
                        "Summary:\n"
                        "(Brief 1 sentence count and description of redacted items)\n\n"
                        f"Text to process:\n{user_text}"
                    )
                elif task_option == "Analyze Sentiment":
                    formatted_prompt = (
                        f"{common_rule}\n"
                        "Task: Analyze the sentiment of the text using Azure Language tools.\n\n"
                        "Format your response strictly using these sections:\n\n"
                        "Overall Sentiment:\n"
                        "(Specify Positive, Negative, Neutral, or Mixed)\n\n"
                        "Key Drivers:\n"
                        "(Bullet list of words or phrases that determined this sentiment)\n\n"
                        "Aspect Details:\n"
                        "(Bullet list describing sentiment toward specific aspects, products, or service interactions)\n\n"
                        f"Text to analyze:\n{user_text}"
                    )
                elif task_option == "Extract Entities and Logistics":
                    formatted_prompt = (
                        f"{common_rule}\n"
                        "Task: Extract and organize entities from the text into clean bullet categories:\n\n"
                        "Personal Identifiers:\n"
                        "- Names, emails, phone numbers\n\n"
                        "Travel and Logistics:\n"
                        "- Flight numbers, confirmation codes, addresses, dates, seat numbers\n\n"
                        "Financial and Official Documents:\n"
                        "- Payment details, passport numbers, billing records\n\n"
                        f"Text:\n{user_text}"
                    )
                elif task_option == "Comprehensive Audit (PII, Sentiment, Entities)":
                    formatted_prompt = (
                        f"{common_rule}\n"
                        "Task: Perform complete text analysis using Azure Language tools:\n\n"
                        "Redacted Text:\n"
                        "(Sanitized text)\n\n"
                        "Sentiment Assessment:\n"
                        "(Overall classification and tone)\n\n"
                        "Extracted Entities:\n"
                        "(Bulleted list by category)\n\n"
                        f"Text:\n{user_text}"
                    )
                else:
                    formatted_prompt = f"{common_rule}\n{custom_prompt_extra}\n\nText:\n{user_text}"

                # Animated loader placeholder in Tab 1
                tab1_loader = st.empty()
                tab1_loader.markdown(render_animated_loader(model, "Executing Azure Language MCP pipeline..."), unsafe_allow_html=True)

                history = [{"role": "user", "content": formatted_prompt}]
                output_text, elapsed, error = run_agent_turn(openai_client, model, agent_name, history)
                tab1_loader.empty()

                if error:
                    st.error(f"Error: {error}")
                else:
                    st.session_state["last_response"] = output_text
                    st.session_state["last_elapsed"] = elapsed

        if st.session_state.get("last_response"):
            resp = st.session_state["last_response"]
            elapsed = st.session_state.get("last_elapsed", 0)

            col_btn, _ = st.columns([1, 2])
            with col_btn:
                st.download_button(
                    label="Download Result (.txt)",
                    data=resp,
                    file_name="result.txt",
                    mime="text/plain",
                    use_container_width=True
                )

            st.caption(f"Processed in {elapsed} seconds")
            st.markdown(f'<div class="result-card">\n\n{resp}\n\n</div>', unsafe_allow_html=True)
        else:
            st.info("Select a task, enter text, and click 'Run Analysis'.")

# ==============================================================================
# TAB 2: TEXT ANALYSIS CHAT ASSISTANT
# ==============================================================================
with tab2:
    chat_top1, chat_top2 = st.columns([3, 1])
    with chat_top1:
        st.markdown("#### Conversation with Text-Analysis-Agent")
        st.caption("Ask questions, test phrases, request iterative redaction, or audit sentiment.")
    with chat_top2:
        if st.button("Clear Chat", use_container_width=True):
            st.session_state["chat_history"] = []
            st.rerun()

    st.write("")

    chat_box = st.container()

    with chat_box:
        if not st.session_state["chat_history"]:
            st.markdown(f"""
            <div class="chat-welcome-card">
                <div class="chat-welcome-title">Text Intelligence Assistant</div>
                <div class="chat-welcome-desc">
                    Connected to <strong>{agent_name}</strong> ({model}) with direct access to Azure Language MCP tools.
                    Type any message or prompt below to start.
                </div>
            </div>
            """, unsafe_allow_html=True)

            st.write("Suggested queries:")
            c1, c2, c3 = st.columns(3)
            with c1:
                if st.button("Redact PII from a contact profile", use_container_width=True):
                    st.session_state["preset_chat"] = "Redact all personal information from: John Doe, phone 555-0192, SSN 123-45-6789, living in Seattle."
                    st.rerun()
            with c2:
                if st.button("Analyze sentiment of a feedback email", use_container_width=True):
                    st.session_state["preset_chat"] = "Analyze the sentiment of: I loved the speed of delivery, but the customer support representative was very rude."
                    st.rerun()
            with c3:
                if st.button("Extract travel logistics from a booking", use_container_width=True):
                    st.session_state["preset_chat"] = "Extract passenger, flight, and seat info from: Passenger Mary Lane flying UA402 to Chicago on Seat 14B."
                    st.rerun()

        for msg in st.session_state["chat_history"]:
            role = msg["role"]
            content = sanitize_pure_text(msg["content"])
            clean_content = re.sub(r'\n{2,}', '\n', content)
            escaped_content = html.escape(clean_content).replace("\n", "<br>")

            if role == "user":
                st.markdown(f"""
                <div class="user-msg-container">
                    <div class="user-msg-bubble">
                        <div class="user-msg-sender">You</div>
                        <div>{escaped_content}</div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="agent-msg-container">
                    <div class="agent-msg-bubble">
                        <div class="agent-msg-header">
                            <span class="agent-badge">Azure AI Agent</span>
                            <span class="agent-model-tag">{model} • Language MCP</span>
                        </div>
                        <div>{escaped_content}</div>
                    </div>
                </div>
                """, unsafe_allow_html=True)

        loading_slot = st.empty()

    pending_prompt = None
    if "preset_chat" in st.session_state and st.session_state["preset_chat"]:
        pending_prompt = st.session_state.pop("preset_chat")

    chat_input = st.chat_input("Type your message or prompt here...")
    active_input = chat_input or pending_prompt

    if active_input:
        st.session_state["chat_history"].append({"role": "user", "content": active_input})
        st.rerun()

    if st.session_state["chat_history"] and st.session_state["chat_history"][-1]["role"] == "user":
        loading_slot.markdown(
            render_animated_loader(model, "Calling Azure Language tools & synthesizing response..."),
            unsafe_allow_html=True
        )

        last_user_msg = st.session_state["chat_history"][-1]["content"]
        formatted_prompt = (
            "STRICT FORMATTING:\n"
            "- Do NOT use emojis or icons.\n"
            "- Do NOT use horizontal divider lines (--- or ===).\n"
            "- Do NOT use markdown tables.\n"
            "- Do NOT add blank lines between list items; keep line spacing compact.\n"
            "- Use clean bold headings and clear bullet points.\n\n"
            f"{last_user_msg}"
        )
        history_turn = st.session_state["chat_history"][:-1] + [{"role": "user", "content": formatted_prompt}]
        reply, _, err = run_agent_turn(openai_client, model, agent_name, history_turn)

        loading_slot.empty()

        if err:
            st.error(err)
        else:
            clean_reply = sanitize_pure_text(reply)
            st.session_state["chat_history"].append({"role": "assistant", "content": clean_reply})
            st.rerun()

# ==============================================================================
# TAB 3: INTERACTIVE SAMPLE SHOWCASE (VERIFIED BENCHMARKS)
# ==============================================================================
with tab3:
    st.markdown("#### Verified Sample Benchmark Showcase")
    st.caption("Inspect authentic inputs paired with verified outputs generated by the Azure AI Foundry Agent (GPT-4o + Azure Language MCP).")

    showcase_cases = {
        "Enterprise PII Redaction & Data Sanitization": {
            "task_tag": "Redact PII",
            "desc": "Real-world contact and payment data sanitized for GDPR / HIPAA regulatory standards.",
            "input": (
                "Hello, my name is Sarah Jenkins, born on 14/05/1988. You can reach me at sarah.jenkins@example.com "
                "or by phone at (555) 234-5678. I currently reside at 742 Evergreen Terrace, Springfield, OR 97477, "
                "and my national ID number is 123-45-6789. Please process payment with Visa card 4111-2222-3333-4444 (exp 08/28)."
            ),
            "output": (
                "Redacted Text:\n"
                "Hello, my name is [NAME], born on [DATE_OF_BIRTH]. You can reach me at [EMAIL] or by phone at [PHONE]. "
                "I currently reside at [ADDRESS], and my national ID number is [NATIONAL_ID]. "
                "Please process payment with Visa card [CARD_NUMBER] (exp [DATE]).\n\n"
                "Identified Entities:\n"
                "- Sarah Jenkins: Person Name\n"
                "- 14/05/1988: Date of Birth\n"
                "- sarah.jenkins@example.com: Email Address\n"
                "- (555) 234-5678: Phone Number\n"
                "- 742 Evergreen Terrace, Springfield, OR 97477: Physical Address\n"
                "- 123-45-6789: National ID / SSN\n"
                "- 4111-2222-3333-4444: Credit Card Number\n"
                "- 08/28: Expiration Date\n\n"
                "Summary:\n"
                "8 sensitive personal, geographic, and financial entities were identified and redacted in full compliance with data privacy policies."
            )
        },
        "Customer Feedback Sentiment & Aspect Analysis": {
            "task_tag": "Analyze Sentiment",
            "desc": "Aspect-based sentiment triage isolating delivery speed praise from customer support dissatisfaction.",
            "input": (
                "I was really impressed with how fast the package arrived—ordered on Tuesday and it was on my doorstep by Wednesday morning! "
                "However, the customer support team was completely unhelpful when I called about a missing component, and the representative hung up on me. "
                "The product quality itself is great once assembled."
            ),
            "output": (
                "Overall Sentiment:\n"
                "Mixed\n\n"
                "Key Drivers:\n"
                "- Positive indicators: 'impressed with how fast', 'great once assembled'\n"
                "- Negative indicators: 'completely unhelpful', 'representative hung up on me'\n\n"
                "Aspect Details:\n"
                "- Shipping and Delivery: Positive (praised for 24-hour fulfillment turnaround)\n"
                "- Product Build Quality: Positive (confirmed solid construction once assembled)\n"
                "- Customer Service: Negative (unsatisfactory escalation and premature call disconnection)"
            )
        },
        "Flight Logistics & Named Entity Extraction": {
            "task_tag": "Extract Entities and Logistics",
            "desc": "Airline confirmation notification parsed into structured categories without hallucination.",
            "input": (
                "From: Delta Air Lines (delta-notifications@delta.com) | Subject: Flight Confirmation. "
                "Dear Alexander 'Alex' Vance, your flight DL1234 from Los Angeles (LAX) to New York (JFK) on October 14, 2024 is confirmed! "
                "Your Confirmation Number is HJK992, Seat 12A. Billing address: 4500 Wilshire Blvd, Los Angeles, CA 90010. "
                "Passport Number: L9928812. For questions call 1-800-221-1212."
            ),
            "output": (
                "Personal Identifiers:\n"
                "- Alexander 'Alex' Vance: Passenger Name\n"
                "- delta-notifications@delta.com: Airline Notification Email\n"
                "- 1-800-221-1212: Customer Support Phone Line\n\n"
                "Travel and Logistics:\n"
                "- Flight DL1234 (Carrier: Delta Air Lines)\n"
                "- Origin: Los Angeles International Airport (LAX)\n"
                "- Destination: John F. Kennedy International Airport (JFK)\n"
                "- Date: October 14, 2024\n"
                "- Seat Assignment: 12A (Main Cabin)\n"
                "- Booking Reference: HJK992\n\n"
                "Financial and Official Documents:\n"
                "- Passport Number: L9928812\n"
                "- Billing Address: 4500 Wilshire Blvd, Los Angeles, CA 90010"
            )
        }
    }

    selected_showcase = st.selectbox(
        "Choose a benchmark scenario to inspect:",
        list(showcase_cases.keys())
    )

    case_data = showcase_cases[selected_showcase]
    st.info(f"Scenario Focus: {case_data['desc']}")

    col_demo_in, col_demo_out = st.columns([1, 1], gap="large")

    with col_demo_in:
        st.markdown("##### Verified Input Document")
        st.text_area(
            "Input Sample:",
            value=case_data["input"],
            height=260,
            disabled=True,
            key=f"demo_input_{selected_showcase}"
        )
        if st.button("Load this into Text Analysis Agent", use_container_width=True, key=f"btn_load_{selected_showcase}"):
            st.session_state["input_text"] = case_data["input"]
            st.session_state["selected_task"] = case_data["task_tag"]
            st.success("Loaded! Switch to the 'Text Analysis Agent' tab to run it live.")

    with col_demo_out:
        st.markdown("##### Authentic Agent Output (Azure AI & GPT-4o)")
        col_d1, _ = st.columns([1, 2])
        with col_d1:
            st.download_button(
                label="Download Sample (.txt)",
                data=case_data["output"],
                file_name=f"{case_data['task_tag'].replace(' ', '_').lower()}_sample.txt",
                mime="text/plain",
                use_container_width=True,
                key=f"dl_demo_{selected_showcase}"
            )

        st.markdown(f'<div class="result-card">\n\n{case_data["output"]}\n\n</div>', unsafe_allow_html=True)
