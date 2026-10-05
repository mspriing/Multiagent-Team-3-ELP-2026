from graph.workflow import graph
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os

class ChatRequest(BaseModel):
    message: str

load_dotenv()  # reads .env file

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

    result = graph.invoke({
        "message": request.message,
        "research": "",
        "analysis": "",
        "final_answer": ""
    })

    return {
        "response": result["final_answer"]
    }