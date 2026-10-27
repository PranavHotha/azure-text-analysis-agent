import sys
from dotenv import load_dotenv
import os

# Import namespaces
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient


def get_user_prompt(prompt_label="User prompt (or 'quit' / Esc to exit): "):
    """Captures user input in terminal, immediately exiting if Esc is pressed or 'quit' is typed."""
    if sys.platform == "win32" and sys.stdin.isatty():
        import msvcrt
        print(prompt_label, end="", flush=True)
        chars = []
        while True:
            ch = msvcrt.getch()
            # Esc key pressed
            if ch == b'\x1b':
                print("\n[Esc pressed] Goodbye!")
                return None
            # Enter key
            elif ch in (b'\r', b'\n'):
                print()
                res = "".join(chars).strip()
                return res
            # Backspace
            elif ch in (b'\x08', b'\x7f'):
                if chars:
                    chars.pop()
                    msvcrt.putch(b'\b')
                    msvcrt.putch(b' ')
                    msvcrt.putch(b'\b')
            # Ctrl+C
            elif ch == b'\x03':
                print("\nGoodbye!")
                return None
            # Printable characters
            elif len(ch) == 1 and ch >= b' ':
                try:
                    char_str = ch.decode("utf-8", errors="ignore")
                    chars.append(char_str)
                    sys.stdout.write(char_str)
                    sys.stdout.flush()
                except Exception:
                    pass
    else:
        try:
            return input(prompt_label).strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            return None


def main():
    try:
        # Clear the console
        os.system('cls' if os.name == 'nt' else 'clear')
        
        # Get Configuration Settings
        load_dotenv()
        foundry_endpoint = os.getenv('FOUNDRY_ENDPOINT')
        agent_name = os.getenv('AGENT_NAME', 'Text-Analysis-Agent')
        model = os.getenv('MODEL_DEPLOYMENT_NAME', 'gpt-4o')
        
        # Get project client
        project_client = AIProjectClient(
            endpoint=foundry_endpoint,
            credential=DefaultAzureCredential(),
        )
        
        # Get an OpenAI client
        openai_client = project_client.get_openai_client()

        print(f"Connected to {agent_name} ({model}).")
        print("Type your message, 'quit' to exit, or press the Esc key.\n")

        conversation_history = []

        while True:
            prompt = get_user_prompt("User prompt: ")
            if prompt is None or prompt.lower() in ("quit", "exit", "q"):
                print("Exiting conversation. Goodbye!")
                break
            if not prompt:
                continue

            conversation_history.append({"role": "user", "content": prompt})

            try:
                response = openai_client.responses.create(
                    model=model,
                    input=conversation_history,
                    extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
                )
                output = response.output_text
                print(f"{agent_name}: {output}\n")
                conversation_history.append({"role": "assistant", "content": output})
            except Exception as err:
                if "agent_reference" in str(err) or "unknown_parameter" in str(err):
                    response = openai_client.chat.completions.create(
                        model=model,
                        messages=conversation_history,
                    )
                    output = response.choices[0].message.content
                    print(f"{agent_name}: {output}\n")
                    conversation_history.append({"role": "assistant", "content": output})
                else:
                    print(f"Error: {err}\n")
        
    except Exception as ex:
        print(f"Startup error: {ex}")

if __name__ == "__main__":
    main()