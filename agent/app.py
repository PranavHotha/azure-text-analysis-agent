import os
import sys
import json
import re
import time
import html
# pyrefly: ignore[missing-import]
import streamlit as st
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

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


@st.cache_resource
def get_azure_clients(custom_endpoint=None, custom_agent=None, custom_model=None):
    """Initializes Azure AI Project Client and OpenAI Client (cached across runs)"""
    load_dotenv()
    env_endpoint = (os.getenv("FOUNDRY_ENDPOINT") or "").strip()
    env_agent = (os.getenv("AGENT_NAME") or "").strip()
    env_model = (os.getenv("MODEL_DEPLOYMENT_NAME") or "").strip()

    # Prioritize values entered in the frontend fields, then fall back to .env, then sensible defaults
    foundry_endpoint = (custom_endpoint or "").strip() or env_endpoint
    agent_name = (custom_agent or "").strip() or env_agent or "Text-Analysis-Agent"
    model = (custom_model or "").strip() or env_model or "gpt-4o"

    if not foundry_endpoint:
        return (
            None,
            None,
            agent_name,
            model,
            "No Foundry Endpoint found. Please enter your Foundry Endpoint in the sidebar fields or in your .env file."
        )

    try:
        project_client = AIProjectClient(
            endpoint=foundry_endpoint,
            credential=DefaultAzureCredential(),
        )
        openai_client = project_client.get_openai_client()
        return project_client, openai_client, agent_name, model, None
    except Exception as e:
        return None, None, agent_name, model, str(e)



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


def run_agent_turn(openai_client, model: str, agent_name: str, conversation_history: list):
    """Sends the conversation history directly to the authentic Azure AI Foundry agent"""
    try:
        start_time = time.time()
        response = openai_client.responses.create(
            model=model,
            input=conversation_history,
            extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
        )
        elapsed = round(time.time() - start_time, 2)

        if response.output_text:
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

    except Exception as e:
        return None, 0, str(e)


# Top Header
st.markdown("""
<div class="studio-header">
    <div class="studio-title">Azure AI Text Analysis Agent</div>
    <div class="studio-subtitle">Enterprise Data Privacy, PII Redaction, and Sentiment Intelligence powered by Azure AI Foundry and Language Tools.</div>
</div>
""", unsafe_allow_html=True)

# Sidebar - Settings and Presets
with st.sidebar:
    st.markdown("### Connection Settings")

    load_dotenv()
    env_endpoint = (os.getenv("FOUNDRY_ENDPOINT") or "").strip()
    env_agent = (os.getenv("AGENT_NAME") or "").strip()
    env_model = (os.getenv("MODEL_DEPLOYMENT_NAME") or "").strip()
    has_env = bool(env_endpoint)

    expander_title = "Azure Credentials (Foundry)" if has_env else "Azure Credentials (Required)"
    with st.expander(expander_title, expanded=not has_env):
        if not has_env:
            st.caption("Enter your Azure Foundry project credentials below:")
        else:
            st.caption("Using configuration from `.env`. Enter values here only if you wish to override:")

        custom_endpoint_input = st.text_input(
            "Foundry Endpoint:",
            value="",
            placeholder="https://<resource>.services.ai.azure.com/api/projects/<id>",
            type="password",
            help="Project endpoint from Azure AI Foundry overview"
        )
        custom_agent_input = st.text_input(
            "Agent Name:",
            value="",
            placeholder="Text-Analysis-Agent"
        )
        custom_model_input = st.text_input(
            "Model Deployment:",
            value="",
            placeholder="gpt-4o"
        )

    # Initialize Azure clients with frontend inputs (or fallback to .env)
    project_client, openai_client, agent_name, model, init_error = get_azure_clients(
        custom_endpoint=custom_endpoint_input or None,
        custom_agent=custom_agent_input or None,
        custom_model=custom_model_input or None
    )

    if init_error:
        st.error(f"Azure Connection:\n{init_error}")
        st.info("Tip: Run `az login` in your terminal to authenticate with Microsoft Entra ID.")
    else:
        st.success("Connected to Azure AI Foundry")
        st.write(f"Agent: **{agent_name}**")
        st.write(f"Model: **{model}**")



    st.write("")
    st.markdown("### Sample Presets")
    st.caption("Click to load sample text into Text Analysis Agent:")

    if st.button("PII Redaction Sample", use_container_width=True):
        st.session_state["input_text"] = (
            "Hello, my name is Sarah Jenkins, born on 14/05/1988. You can reach me at sarah.jenkins@example.com "
            "or by phone at (555) 234-5678. I currently reside at 742 Evergreen Terrace, Springfield, OR 97477, "
            "and my national ID number is 123-45-6789. Please process payment with Visa card 4111-2222-3333-4444 (exp 08/28)."
        )
        st.session_state["selected_task"] = "Redact PII"

    if st.button("Positive Review Sample", use_container_width=True):
        st.session_state["input_text"] = (
            "I am absolutely thrilled with this purchase! The build quality exceeded all my expectations, "
            "and the setup took less than two minutes. Customer service was incredibly warm, responsive, and helpful throughout. "
            "I will definitely be recommending this to all my colleagues!"
        )
        st.session_state["selected_task"] = "Analyze Sentiment"

    if st.button("Negative Review Sample", use_container_width=True):
        st.session_state["input_text"] = (
            "This is hands down the worst experience I have ever had with any service provider. The application crashes constantly, "
            "corrupting my unsaved work every single day. I waited on hold for two hours only to be disconnected without any resolution. "
            "I demand an immediate refund and cancellation of my contract."
        )
        st.session_state["selected_task"] = "Analyze Sentiment"

    if st.button("Travel Logistics Sample", use_container_width=True):
        st.session_state["input_text"] = (
            "From: Delta Air Lines (delta-notifications@delta.com) | Subject: Flight Confirmation. "
            "Dear Alexander 'Alex' Vance, your flight DL1234 from Los Angeles (LAX) to New York (JFK) on October 14, 2024 is confirmed! "
            "Your Confirmation Number is HJK992, Seat 12A. Billing address: 4500 Wilshire Blvd, Los Angeles, CA 90010. "
            "Passport Number: L9928812. For questions call 1-800-221-1212."
        )
        st.session_state["selected_task"] = "Extract Entities and Logistics"

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
            elif not openai_client:
                st.error("Azure Client is not connected. Please provide your Foundry credentials in the sidebar and ensure you are logged in via 'az login'.")
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
        if not openai_client:
            st.error("Azure Client not connected. Please provide your Foundry credentials in the sidebar and ensure you are logged in via 'az login'.")

        else:
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
