
from graph.workflow import graph
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
import logging
import os

from database import (
    init_db,
    create_conversation,
    save_message,
    save_evidence,
    get_messages,
    get_conversations,
    get_conversation,
    get_evidence,
    cancel_request,
    is_cancelled,
    add_usage
)
from auth import (
    check_limits,
    email_only_sign_in,
    sign_in_settings,
    request_code,
    require_user,
    sign_out,
    usage_for,
    verify_code
)

load_dotenv()

# Configure backend logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    # Lets the user stop this question while the agents work
    request_id: str | None = Field(default=None, max_length=100)


class CancelRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)


class CodeRequest(BaseModel):
    email: str = Field(max_length=200)


class VerifyRequest(BaseModel):
    email: str = Field(max_length=200)
    code: str = Field(max_length=20)


def stopped(request_id):
    # True when the user pressed Stop for this question
    return bool(request_id) and is_cancelled(request_id)


app = FastAPI()

# Create the database tables when the backend starts
init_db()

# Sites allowed to call this backend: the local dev servers, plus any listed in
# ALLOWED_ORIGINS (comma separated), such as the frontend's Vercel address
allowed_origins = ["http://localhost:5173", "http://localhost:5174"] + [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Hello from the multi-agent backend!"}


# ---------- Sign-in with a Penn State email ----------

@app.get("/auth/settings")
def auth_settings():
    # Whether sign-in asks for an emailed code, and which email domain is allowed
    return sign_in_settings()


@app.post("/auth/email")
def auth_email(request: CodeRequest):
    # Sign in with the email address alone (only while sign-in codes are off)
    token, email = email_only_sign_in(request.email)
    return {"token": token, "email": email, **usage_for(email)}


@app.post("/auth/request-code")
def auth_request_code(request: CodeRequest):
    # Email a 6-digit code to a @psu.edu address
    email = request_code(request.email)
    return {"sent": True, "email": email}


@app.post("/auth/verify")
def auth_verify(request: VerifyRequest):
    # Trade a correct code for a session token
    token, email = verify_code(request.email, request.code)
    return {"token": token, "email": email, **usage_for(email)}


@app.get("/auth/me")
def auth_me(email: str = Depends(require_user)):
    # Who is signed in, and how many questions they have used today
    return {"email": email, **usage_for(email)}


@app.post("/auth/sign-out")
def auth_sign_out(authorization: str | None = Header(default=None)):
    sign_out(authorization)
    return {"signed_out": True}


@app.post("/chat")
def chat(request: ChatRequest, email: str = Depends(require_user)):

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
            # Reject IDs that do not belong to one of this person's saved conversations
            # (get_messages alone cannot distinguish an empty chat
            # from a nonexistent conversation).
            conversation = get_conversation(conversation_id)
            if conversation is None or conversation.get("user_email") != email:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found."
                )

        # Stop here if today's question limits are used up, otherwise count this question
        day = check_limits(email)
        add_usage(email, day)

        history = get_messages(conversation_id)

        # 4. Run the multi-agent workflow one agent at a time,
        # stopping early if the user pressed Stop
        result = {}
        for state in graph.stream({
            "message": message,
            "history": history,
            "research": "",
            "analysis": "",
            "final_answer": "",
            "next_agent": "",
            "evidence": []
        }, stream_mode="values"):
            result = state
            if stopped(request.request_id):
                logger.info("Stopped by the user: %s", request.request_id)
                raise HTTPException(status_code=409, detail="Stopped.")

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
        # Nothing is saved for a question the user stopped.
        if stopped(request.request_id):
            raise HTTPException(status_code=409, detail="Stopped.")

        # Only create the conversation after successful generation.
        if not request.conversation_id:
            create_conversation(
                conversation_id,
                message[:100],
                email
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
            "evidence": get_evidence(assistant_message_id),
            **usage_for(email)
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Multi-agent workflow failed")

        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again."
        )


@app.post("/cancel")
def cancel(request: CancelRequest, email: str = Depends(require_user)):
    # Stop a question the agents are still working on
    cancel_request(request.request_id)
    return {"stopped": True}


@app.get("/conversations")
def list_conversations(email: str = Depends(require_user)):
    # Return the signed-in person's saved conversations
    return get_conversations(email)


@app.get("/conversations/{conversation_id}")
def retrieve_conversation(conversation_id: str, email: str = Depends(require_user)):
    # Find the requested conversation (only its owner can open it)
    conversation = get_conversation(conversation_id)

    if conversation is None or conversation.pop("user_email", None) != email:
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
