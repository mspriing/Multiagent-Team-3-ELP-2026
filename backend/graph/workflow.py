
from langgraph.graph import StateGraph, START, END

from graph.state import AgentState
from agents.supervisor import supervisor_agent
from agents.researcher import research_agent
from agents.analyst import analysis_agent
from agents.writer import writer_agent


workflow = StateGraph(AgentState)

# Add agents
workflow.add_node("supervisor", supervisor_agent)
workflow.add_node("researcher", research_agent)
workflow.add_node("analyst", analysis_agent)
workflow.add_node("writer", writer_agent)

# Start with supervisor
workflow.add_edge(START, "supervisor")

# Route based on the supervisor's decision
workflow.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {
        "researcher": "researcher",
        "analyst": "analyst",
        "writer": "writer"
    }
)

# Continue through the pipeline
workflow.add_edge("researcher", "analyst")
workflow.add_edge("analyst", "writer")

# Finish
workflow.add_edge("writer", END)

graph = workflow.compile()
