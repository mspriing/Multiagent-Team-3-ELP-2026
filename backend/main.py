
from graph.workflow import graph
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Set up logging to track backend errors
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str

load_dotenv()

# DeepSeek client
deepseek_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

app = FastAPI()

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

    # 1. Check for an empty message
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    try:
        # 2. Run the multi-agent workflow
        result = graph.invoke({
            "message": request.message,
            "research": "",
            "analysis": "",
            "final_answer": ""
        })

        # 3. Check whether the writer returned an answer
        final_answer = result.get("final_answer")

        if not final_answer:
            raise HTTPException(
                status_code=500,
                detail="The agents did not generate a response."
            )

        # 4. Return the answer to React
        return {
            "response": final_answer
        }

    except HTTPException:
        # Preserve errors we intentionally raised
        raise

    except Exception:
        # 5. Log unexpected errors for debugging
        logger.exception("Multi-agent workflow failed")

        # 6. Return a safe error message to React
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again."
        )
