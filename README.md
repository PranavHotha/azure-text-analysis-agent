# Azure AI Text Analysis & PII Sanitization Agent

An enterprise-grade AI Agent application built with **Azure AI Foundry**, **OpenAI GPT-4o**, and **Azure AI Language (Cognitive Services)** using the **Model Context Protocol (MCP)**. 

The system provides deterministic PII detection & redaction, sentiment classification, and entity extraction through both a high-performance **Streamlit Web Application** and an interactive **CLI Terminal Agent**.

---

## Architecture Overview

Unlike standard chatbots that rely solely on generative LLMs for data redaction (which can hallucinate or miss edge cases), this application implements an **Agentic Tool-Calling Workflow**:

1. **Orchestrator / Brain**: OpenAI `gpt-4o` running on Azure AI Foundry.
2. **Deterministic NLP Engine**: Azure AI Language Cognitive Services (PII Recognition & Sentiment Analysis).
3. **Tool Protocol**: Model Context Protocol (MCP) connecting the agent to remote Azure Language tools.
4. **Client Interfaces**:
   - **Streamlit Web Studio** (`app.py`): Light-mode enterprise web UI with one-click presets, live pulsing loader animations, and conversation history.
   - **CLI Agent** (`text-agent.py`): Fast multi-turn terminal conversation loop.

---

## Key Features

- **Automated PII Redaction**: Detects and sanitizes sensitive data (Names, Credit Cards, SSNs, National IDs, Addresses, Phone Numbers, Emails) for GDPR/HIPAA compliance.
- **Sentiment & Tone Intelligence**: Evaluates overall polarity (Positive, Negative, Neutral, Mixed), emotional drivers, and aspect-based service reviews.
- **Entity Extraction**: Categorizes messy unstructured customer notifications and emails into Travel Logistics, Identifiers, and Official Documents.
- **Pure Text Output Formatting**: Generates clean, structured, line-free output ready for downstream logging, compliance storage, or PDF/TXT export.
- **Animated Live Status**: ChatGPT-style pulsating dot indicators with live status feedback during tool invocation.

---

## Tech Stack

- **Language**: Python 3.12+
- **Cloud Platform**: Microsoft Azure AI Foundry (Azure AI Studio)
- **SDKs**: `azure-ai-projects`, `azure-identity`, `openai`
- **Protocol**: Remote Model Context Protocol (MCP)
- **Web UI**: Streamlit

---

## Project Structure

```text
text-analysis-agent/
│
├── README.md                       # Project documentation & architecture
│
└── agent/
    ├── app.py                      # Streamlit Web Application (UI + Chat Studio)
    ├── text-agent.py               # Interactive CLI terminal loop
    ├── requirements.txt            # Python dependencies
    ├── setup.txt                   # Azure Foundry configuration steps
    ├── test_prompts.txt            # Ready-to-use benchmark test cases
    ├── .env                        # Azure endpoint, agent, and model secrets (ignored by git)
    ├── .gitignore                  # Git exclusion rules
    └── .streamlit/
        └── config.toml             # Streamlit Light Mode theme settings
```

---

## Getting Started

### 1. Prerequisites
- Python 3.10+ installed
- Azure Subscription with Azure AI Foundry access
- Azure CLI (`az login` completed in terminal)

### 2. Installation
Navigate into the `agent` folder and install dependencies:
```powershell
cd agent
pip install -r requirements.txt
```

### 3. Environment Setup
Create a `.env` file in the `agent/` folder with your Azure AI Foundry details:
```env
FOUNDRY_ENDPOINT="https://<your-project>.services.ai.azure.com/api/projects/<project-id>"
AGENT_NAME="your_agent_name"
MODEL_DEPLOYMENT_NAME="your_model"
```

### 4. Running the Application

#### Option A: Launch the Web Studio (Recommended)
```powershell
.\labenv\Scripts\python.exe -m streamlit run app.py
```
*Opens automatically in your browser at `http://localhost:8501`.*

#### Option B: Launch the Terminal CLI
```powershell
.\labenv\Scripts\python.exe text-agent.py
```
