from graph.state import AgentState
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)


def analysis_agent(state: AgentState):
    # Get the research produced by the researcher agent
    research = state["research"]

    # Send the research to DeepSeek for analysis
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an analysis agent. "
                    "Analyze the provided research, identify the most "
                    "important information, and draw useful conclusions."
                )
            },
            {
                "role": "user",
                "content": research
            }
        ]
    )

    # Get DeepSeek's response
    analysis_result = response.choices[0].message.content

    # Store the result in the LangGraph state
    return {
        "analysis": analysis_result
    }