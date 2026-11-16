
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

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a supervisor for a multi-agent AI assistant. "
                    "Choose exactly one agent based on the user's request. "
                    "Use conversation history to understand follow-up questions. "

                    "Choose researcher when the user needs new external information, "
                    "up-to-date facts, research, or sources. "

                    "Choose analyst when the user wants comparisons, reasoning, "
                    "or analysis using information already available in the conversation. "

                    "Choose writer when the user wants a simple explanation, "
                    "general knowledge answer, summary, rewrite, or formatting. "

                    "Do not use researcher unless external research is necessary. "
                    "For follow-up questions, reuse existing conversation information "
                    "when sufficient. "

                    "Respond with exactly one word: researcher, analyst, or writer."
                )
            },
            *history,
            {
                "role": "user",
                "content": message
            }
        ],
        temperature=0
    )

    next_agent = (
        response.choices[0].message.content or ""
    ).strip().lower()

    if next_agent not in ["researcher", "analyst", "writer"]:
        next_agent = "researcher"

    print(f"SUPERVISOR → {next_agent.upper()}", flush=True)

    return {"next_agent": next_agent}
