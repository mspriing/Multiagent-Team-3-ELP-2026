from graph.state import AgentState
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)


def research_agent(state: AgentState):
    # Get the user's message from the LangGraph state
    message = state["message"]

    # Send the message to DeepSeek
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a research agent. "
                    "Research the user's question and provide useful, "
                    "organized information for another agent to analyze."
                )
            },
            {
                "role": "user",
                "content": message
            }
        ]
    )

    # Extract DeepSeek's answer
    research_result = response.choices[0].message.content

    # Save it into the LangGraph state
    return {
        "research": research_result
    }