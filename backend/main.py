
from graph.workflow import graph
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
from database import (
    init_db,
    create_conversation,
    save_message,
    get_messages
)
import logging

from database import (
    init_db,
    create_conversation,
    save_message,
    save_evidence,
    get_messages,
    get_conversations,
    get_conversation,
    get_evidence
)

load_dotenv()

# Configure backend logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


app = FastAPI()

# Initialize SQLite tables when the backend starts
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Hello from the multi-agent backend!"}


@app.post("/chat")
def chat(request: ChatRequest):

    # 1. Validate the user's question
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    # 2. Create or reuse a conversation ID
    conversation_id = request.conversation_id or str(uuid4())

    try:
        # 3. Retrieve existing conversation history
        if request.conversation_id:
            # Reject IDs that do not belong to a saved conversation
            # (get_messages alone cannot distinguish an empty chat
            # from a nonexistent conversation).
            from database import get_connection

            with get_connection() as connection:
                exists = connection.execute(
                    "SELECT 1 FROM conversations WHERE id = ?",
                    (conversation_id,)
                ).fetchone()

            if not exists:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found."
                )

        history = get_messages(conversation_id)

        # 4. Run the multi-agent workflow
        result = graph.invoke({
            "message": message,
            "history": history,
            "research": "",
            "analysis": "",
            "final_answer": "",
            "next_agent": "",
            "evidence": []
        })

        # Debug: Check how many evidence sources were retrieved
        evidence = result.get("evidence", [])

        logger.info("Evidence sources retrieved: %d", len(evidence))

        for source in evidence:
            logger.info(
                "Source: %s | %s",
                source["title"],
                source["url"]
            )

        # 5. Validate the agents' response
        final_answer = result.get("final_answer")

        if not final_answer or not final_answer.strip():
            raise HTTPException(
                status_code=500,
                detail="The agents did not generate a response."
            )

        # 6. Save conversation and messages
        # Only create the conversation after successful generation.
        if not request.conversation_id:
            create_conversation(
                conversation_id,
                message[:100]
            )

        # Save the user's question
        save_message(conversation_id, "user", request.message)

        # Save the AI response and capture its database ID
        assistant_message_id = save_message(
            conversation_id,
            "assistant",
            final_answer
        )

        # Retrieve evidence collected by the Researcher Agent
        evidence = result.get("evidence", [])

        # Save evidence linked to this specific AI response
        save_evidence(assistant_message_id, evidence)

        logger.info(
            "Saved %d evidence sources for message %d",
            len(evidence),
            assistant_message_id
        )

        # 7. Return the result to React
        return {
            "response": final_answer,
            "conversation_id": conversation_id,
            "message_id": assistant_message_id,
            "evidence": get_evidence(assistant_message_id)
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Multi-agent workflow failed")

        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again."
        )


@app.get("/conversations")
def list_conversations():
    # Return all saved conversations
    return get_conversations()


@app.get("/conversations/{conversation_id}")
def retrieve_conversation(conversation_id: str):
    # Find the requested conversation
    conversation = get_conversation(conversation_id)

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found."
        )

    # Retrieve all messages belonging to it
    messages = get_messages(conversation_id)

    for message in messages:
        if message["role"] == "assistant":
            message["evidence"] = get_evidence(message["id"])
        else:
            message["evidence"] = []

    return {
        "conversation": conversation,
        "messages": messages
    }
