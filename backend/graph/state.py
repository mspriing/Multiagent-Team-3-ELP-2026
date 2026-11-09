from typing import TypedDict

class AgentState(TypedDict):
    message: str
    history: list[dict]
    research: str
    analysis: str
    final_answer: str
    next_agent: str