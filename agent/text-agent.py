from dotenv import load_dotenv
import os

# Import namespaces
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient


def main():
    try:
        # Clear the console
        os.system('cls' if os.name == 'nt' else 'clear')
        
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

        # Use the agent to get a response
        prompt = input("User prompt: ")
        try:
            response = openai_client.responses.create(
                model=model,
                input=[{"role": "user", "content": prompt}],
                extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
            )
            print(f"{agent_name}: {response.output_text}")
        except Exception as err:
            if "agent_reference" in str(err) or "unknown_parameter" in str(err):
                response = openai_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                )
                print(f"{agent_name}: {response.choices[0].message.content}")
            else:
                raise err

        
    except Exception as ex:
        print(ex)

if __name__ == "__main__":
    main()