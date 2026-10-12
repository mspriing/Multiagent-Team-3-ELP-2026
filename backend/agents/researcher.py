
from graph.state import AgentState
from openai import OpenAI
from tavily import TavilyClient
from dotenv import load_dotenv
import os
import json

load_dotenv()

# DeepSeek client
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

# Tavily client
tavily = TavilyClient(
    api_key=os.getenv("TAVILY_API_KEY")
)


def research_agent(state: AgentState):
    message = state["message"]

    # STEP 1: Generate focused search queries
    query_response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a search query generator. "
                    "Generate exactly 3 focused web search queries "
                    "that will help answer the user's question. "
                    "Return ONLY a JSON array of strings."
                )
            },
            {
                "role": "user",
                "content": message
            }
        ]
    )

    # Parse the generated queries
    try:
        queries = json.loads(
            query_response.choices[0].message.content
        )

        if (
            not isinstance(queries, list)
            or len(queries) != 3
            or not all(isinstance(q, str) and q.strip() for q in queries)
        ):
            raise ValueError("Invalid search queries")

    except (json.JSONDecodeError, ValueError, TypeError):
        queries = [message]

    # STEP 2: Search Tavily for each query
    all_results = []
    seen_urls = set()

    for query in queries:
        search_results = tavily.search(
            query=query,
            search_depth="advanced",
            max_results=5
        )

        for result in search_results.get("results", []):
            url = result.get("url")

            if url and url not in seen_urls:
                seen_urls.add(url)

                all_results.append({
                    "title": result.get("title", ""),
                    "url": url,
                    "content": result.get("content", "")
                })

    # STEP 3: Summarize research using DeepSeek
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a research agent. "
                    "Analyze the provided web search results. "
                    "Identify the most relevant and reliable information. "
                    "Ignore unrelated results. "
                    "Do not invent facts or sources. "
                    "Preserve source URLs and explain which findings "
                    "they support. "
                    "Organize your research clearly for an analyst agent. "
                    "If evidence is insufficient, state what is missing."
                )
            },
            {
                "role": "user",
                "content": (
                    f"User question:\n{message}\n\n"
                    f"Web search results:\n"
                    f"{json.dumps(all_results, indent=2)}"
                )
            }
        ]
    )

    research_result = response.choices[0].message.content

    # STEP 4: Save research in LangGraph state
    return {
        "research": research_result
    }
