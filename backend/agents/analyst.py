
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
    # Get the user's original question
    message = state["message"]

    # Get the research produced by the Researcher Agent
    research = state.get("research", "")

    # Send the research to DeepSeek for analysis
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert analysis agent. "
                    "Analyze the research in relation to the user's "
                    "original question. "
                    "Identify the most important findings, patterns, "
                    "trends, and relationships. "
                    "Compare information from different sources when "
                    "appropriate. "
                    "Evaluate the reliability and relevance of evidence. "
                    "Distinguish facts from interpretations. "
                    "Identify contradictions and missing information. "
                    "Draw useful, evidence-based conclusions. "
                    "Do not invent facts or unsupported claims. "
                    "Preserve source URLs for important findings. "
                    "Organize your analysis clearly for a writer agent."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Original user question:\n{message}\n\n"
                    f"Research findings:\n{research}"
                )
            }
        ]
    )

    # Extract DeepSeek's analysis
    analysis_result = response.choices[0].message.content

    # Save the analysis in LangGraph state
    return {
        "analysis": analysis_result
    }
