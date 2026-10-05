from typing import TypedDict

class AgentState(TypedDict):
    message: str
    research: str
    analysis: str
    final_answer: str
    next_agent: str