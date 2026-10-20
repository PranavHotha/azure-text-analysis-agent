from dotenv import load_dotenv
import os
import sys

# Import namespaces
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient


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


def main():
    try:
        # Clear the console
        os.system('cls' if os.name == 'nt' else 'clear')

        # Ensure UTF-8 output in Windows console
        if sys.platform == "win32":
            sys.stdout.reconfigure(encoding="utf-8")
        
        # Get Configuration Settings
        load_dotenv()
        foundry_endpoint = os.getenv('FOUNDRY_ENDPOINT')
        agent_name = os.getenv('AGENT_NAME')
        model = os.getenv('MODEL_DEPLOYMENT_NAME')
        
        # Get project client
        project_client = AIProjectClient(
            endpoint=foundry_endpoint,
            credential=DefaultAzureCredential(),
        )
        
        # Get an OpenAI client
        openai_client = project_client.get_openai_client()

        # Conversation history for multi-turn chat (Responses API requires user/assistant roles)
        conversation_history = []
        print(f"Connected to {agent_name}. Type 'exit' or 'quit' to end.\n")

        while True:
            # Prompt user
            prompt = input("User prompt: ").strip()
            if not prompt:
                continue
            if prompt.lower() in ("exit", "quit", "q"):
                print("Exiting conversation. Goodbye!")
                break

            conversation_history.append({"role": "user", "content": prompt})

            # Use the agent to get a response
            response = openai_client.responses.create(
                model=model,
                input=conversation_history,
                extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
            )

            if response.output_text:
                print(f"\n{agent_name}:\n{response.output_text}\n")
                conversation_history.append({"role": "assistant", "content": response.output_text})
            else:
                # Check if tools were executed or require approval
                has_output = False
                tool_output_combined = []
                for item in getattr(response, "output", []):
                    item_type = getattr(item, "type", None)
                    if item_type == "mcp_approval_request":
                        tool_name = getattr(item, "name", "tool")
                        print(f"\n[Action Required] Tool '{tool_name}' requires approval in Azure AI Foundry.")
                        print("To fix: In Azure Foundry portal -> Agents -> select your agent -> Tools -> Configure -> Set 'Approval setting' to 'Always auto-approve all tools' and save.")
                        has_output = True
                    elif item_type == "mcp_call" and getattr(item, "output", None):
                        print(f"\n[{getattr(item, 'name', 'Tool Output')}]:\n{item.output}\n")
                        tool_output_combined.append(str(item.output))
                        has_output = True
                if not has_output:
                    print(f"\n{agent_name}: (No output returned)\n")
                elif tool_output_combined:
                    conversation_history.append({"role": "assistant", "content": "\n".join(tool_output_combined)})

    except KeyboardInterrupt:
        print("\n\nExiting conversation. Goodbye!")
    except Exception as ex:
        print(ex)

if __name__ == "__main__":
    main()