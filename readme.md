# Azure Text Analysis Agent Walkthrough

This repository contains a Python-based Text Analysis Agent built using **Azure AI Foundry** and the **Azure AI Projects SDK**. This project was created as part of a technical walkthrough to explore AI agent orchestration.

## 🚀 Overview
The agent is designed to interact with an Azure AI Project, utilizing a specific model deployment to process user prompts and return intelligent responses.

### Key Features:
- **Azure Identity Integration**: Uses `DefaultAzureCredential` for secure authentication.
- **Environment Configuration**: Manages sensitive endpoints and keys via `.env` files.
- **OpenAI Client Integration**: Connects to Azure OpenAI models through the AI Project Client.

## 📸 Code Preview
Below is a snapshot of the core logic implementation:
<img width="3680" height="4660" alt="text-analysis-agent" src="https://github.com/user-attachments/assets/7737cf90-2ccd-425b-b907-d3c15acc8b91" />


## 🛠️ Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>

2. **Install dependencies**:
   ```bash
   pip install -r agent/requirements.txt
3. **Configure Environment Variables:**
   Create a .env file in the agent/ directory with the following:
   
    **FOUNDRY_ENDPOINT**=your_endpoint_here
   **AGENT_NAME**=your_agent_name
    **MODEL_DEPLOYMENT_NAME**=your_model_name
   
5. **Run the Agent:**
  ```bash
python agent/text-agent.py


