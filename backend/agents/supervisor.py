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
    history = state.get("history", [])

    # Always research the first question in a conversation
    if not history:
        print("SUPERVISOR → RESEARCHER (new conversation)")
        return {"next_agent": "researcher"}

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a supervisor for a multi-agent system. "
                    "Use conversation history to understand follow-up questions. "
                    "Choose exactly one agent: researcher, analyst, or writer. "
                    "Choose researcher when new facts, research, or sources are needed. "
                    "Choose analyst when analyzing or comparing information already discussed. "
                    "Choose writer when summarizing, rewriting, or reformatting an existing answer. "
                    "When uncertain, choose researcher. "
                    "Respond with only one word: researcher, analyst, or writer."
                )
            },
            *history,
            {
                "role": "user",
                "content": message
            }
        ]
    )

    next_agent = response.choices[0].message.content.strip().lower()

    # Safety fallback in case DeepSeek returns something unexpected
    if next_agent not in ["researcher", "analyst", "writer"]:
        next_agent = "researcher"

    print(f"SUPERVISOR → {next_agent.upper()}")

    return {
        "next_agent": next_agent
    }
