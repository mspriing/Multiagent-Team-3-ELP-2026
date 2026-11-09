
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
    history = state.get("history", [])

    
    
    # STEP 1: Generate focused search queries
    query_response = client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        max_tokens=300,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                "You are a search query generator. "
                "Use conversation history only to understand references. "
                "Focus exclusively on the latest user question. "
                "Generate exactly 3 specific standalone search queries. "
                "Respond immediately with a valid JSON object. "
                "Do not include explanations or whitespace before the JSON. "
                'Your entire response must follow this format: '
                '{"queries": ["query 1", "query 2", "query 3"]}'
                )
            },
            *history,
            {
                "role": "user",
                "content": message
            }
        ]
    )

    # Print DeepSeek's response for debugging
    print("[RESEARCHER] Raw DeepSeek response:")
    print(query_response.choices[0].message.content)


    
    # Parse the generated queries
    try:
        data = json.loads(query_response.choices[0].message.content)
        queries = data["queries"]

        if (
            not isinstance(queries, list)
            or len(queries) != 3
            or not all(isinstance(q, str) and q.strip() for q in queries)
        ):
            raise ValueError("Invalid search queries")

    except (json.JSONDecodeError, ValueError, TypeError, KeyError) as e:
        raise ValueError(f"Invalid search queries: {e}") from e


    # STEP 2: Search Tavily for each query

    all_results = []
    seen_urls = set()

    print(f"[RESEARCHER] History messages: {len(history)}")


    for query in queries:
        print(f"[RESEARCHER] Searching Tavily: {query}")

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
    print(f"[RESEARCHER] Total unique sources found: {len(all_results)}")

    # STEP 3: Summarize research using DeepSeek
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a research agent. "
                    "Use conversation history to understand the current question. "
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
            *history,
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
