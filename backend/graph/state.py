
from typing import TypedDict


class EvidenceSource(TypedDict):
    title: str
    url: str
    content: str


class AgentState(TypedDict):
    message: str
    history: list[dict]
    research: str
    analysis: str
    final_answer: str
    next_agent: str
    evidence: list[EvidenceSource]
