
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
    # Get the original user question
    message = state["message"]

    # Get the research produced by the Researcher Agent
    research = state.get("research", "")

    # Get the analysis produced by the Analyst Agent
    analysis = state.get("analysis", "")

    # Send all information to DeepSeek
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert writing agent. "
                    "Write a clear, accurate, and well-organized "
                    "final answer to the user's original question. "
                    "Use the provided research and analysis. "
                    "Begin with a direct answer to the question. "
                    "Organize the response using Markdown headings, "
                    "paragraphs, and bullet points when appropriate. "
                    "Explain important findings and conclusions. "
                    "Include relevant source URLs to support factual claims. "
                    "Only cite sources present in the research. "
                    "Do not invent facts, statistics, or citations. "
                    "Distinguish established facts from interpretations. "
                    "Acknowledge uncertainty or missing evidence. "
                    "Avoid unnecessary repetition and overly long responses."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Original user question:\n{message}\n\n"
                    f"Research findings:\n{research}\n\n"
                    f"Analysis:\n{analysis}"
                )
            }
        ]
    )

    # Extract DeepSeek's final response
    final_result = response.choices[0].message.content

    # Save the final answer in LangGraph state
    return {
        "final_answer": final_result
    }
