from graph.state import AgentState
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)


def supervisor_agent(state: AgentState):
    message = state["message"]

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a supervisor for a multi-agent system. "
                    "Decide which agent should handle the user's request. "
                    "Choose exactly one of these options: researcher, analyst, writer. "
                    "Use researcher when information or research is needed. "
                    "Use analyst when the user wants analysis or comparison. "
                    "Use writer when the user mainly needs a written response. "
                    "Respond with only the agent name."
                )
            },
            {
                "role": "user",
                "content": message
            }
        ]
    )

    next_agent = response.choices[0].message.content.strip().lower()

    # Safety fallback in case DeepSeek returns something unexpected
    if next_agent not in ["researcher", "analyst", "writer"]:
        next_agent = "writer"

    print(f"SUPERVISOR → {next_agent.upper()}")

    return {
        "next_agent": next_agent
    }