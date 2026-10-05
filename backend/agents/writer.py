from graph.state import AgentState
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)


def writer_agent(state: AgentState):
    # Get the analysis produced by the analyst agent
    analysis = state["analysis"]

    # Send the analysis to DeepSeek
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a writing agent. "
                    "Using the provided analysis, write a clear, accurate, "
                    "and well-organized final answer for the user."
                )
            },
            {
                "role": "user",
                "content": analysis
            }
        ]
    )

    # Get DeepSeek's final response
    final_result = response.choices[0].message.content

    # Store it as the final answer
    return {
        "final_answer": final_result
    }