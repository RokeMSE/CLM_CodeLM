from pymongo import AsyncMongoClient
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from routes.notebookRoutes import router as notebook_router
from routes.authRoutes import router as auth_router
import logging
from pydantic import BaseModel, Field  # For request/response validation
from typing import List
import google.genai as genai
from google.genai.types import GenerateContentConfig, Part, UserContent, ModelContent
from dotenv import load_dotenv
import os

# --- Configure Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Load Environment Variables ---
load_dotenv()  # Get the local one
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.0-flash"

# --- FastAPI App Initialization ---
app = FastAPI()

mongo_client = AsyncMongoClient("mongodb://localhost:27017")
app.include_router(notebook_router, prefix="/api")
app.include_router(auth_router)  # does not need a prefix

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, etc.
    allow_headers=["*"],  # Allows all headers
)

# --- Pydantic Models for Data Validation ---
class Message(BaseModel):
    role: str  # Keep as str, validation happens later if needed
    text: str


class ChatRequest(BaseModel):
    user_text: str = Field(..., min_length=1)  # Ensure user_text is not empty
    history: List[Message]  # Expects a list of Message objects


class ChatResponse(BaseModel):
    reply: str  # MIGHT HAVE TO HANDLE .MD OUTPUT LATER ON

# --- API Endpoint ---
@app.post("/api/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    """
    Receives user text and chat history, calls the Gemini API,
    and returns the model's reply.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API Key not configured on server.",
        )

    try:
        gemini_client = genai.Client(
            api_key=GEMINI_API_KEY,
            # Optional: Set the region if needed
            # region="us-central1",
        )

        # --- Prepare History for Gemini SDK ---
        # The Python SDK expects history like: [{'role': 'user'/'model', 'parts': [{'text': '...'}]}]
        history_objs = []
        for msg in request.history:
            # Basic validation for role
            if msg.role == "user":
                history_objs.append(UserContent(parts=[Part(text=msg.text)]))
            elif msg.role == "model":
                history_objs.append(ModelContent(parts=[Part(text=msg.text)]))
            else:
                logger.warning(
                    f"Invalid role '{msg.role}' in history. Defaulting to 'user'."
                )

        # --- Configuration ---
        # Keeping it wholesome and Christian
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
        ]

        # Basic model config
        generation_config = GenerateContentConfig(
            temperature=0.9,  # 90% randomness, keeping it fresh.
            max_output_tokens=1000,  # 1000 tokens = 750 words (I think)
            top_p=0.9,  # consider the top 90% of the probability distribution when generating text.
            top_k=40,  # consider the top 40 tokens with the highest probabilities when generating text.
            safety_settings=safety_settings,
        )
        try:
            # --- Start Chat Session ---
            chat_session = gemini_client.chats.create(
                model=MODEL_NAME,
                history=history_objs,
                config=generation_config,
            )

            # --- Send Message to Gemini ---
            logger.info("Sending message to Gemini...")
            response = chat_session.send_message(request.user_text)
            logger.info("Received response from Gemini.")
            # --- Process Response ---
            reply_text = response.text
            logger.info(f"Gemini Reply Text: {reply_text}")
            return ChatResponse(reply=reply_text)

        except ValueError as ve:
            # This usually indicates the response was blocked by safety settings
            logger.warning("Gemini response might be blocked by safety settings.")
            # Optionally inspect response.prompt_feedback here
            feedback = response.prompt_feedback
            block_reason = "Content may be blocked by safety settings."
            if feedback.block_reason:
                block_reason += (
                    f" Reason: {feedback.block_reason.name}"  # Use .name for enum
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=block_reason
            )
        except Exception as inner_e:
            # Catch other potential errors during response processing
            logger.error(f"Error processing Gemini response: {inner_e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing the bot's response.",
            )

    except Exception as e:
        # Catch potential errors during API call setup or sending
        logger.error(f"Error interacting with Gemini API: {e}")
        # You might want more specific error handling based on Gemini SDK exceptions
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while contacting the AI service: {str(e)}",
        )


# --- Add a root endpoint for basic testing ---
@app.get("/")
def read_root():
    return {"message": "Chat API Backend is running"}
