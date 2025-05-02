from fastapi import APIRouter, Cookie, Request, Response, status, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from models.notebookModel import create_notebook, insert_file_metadata, get_files, get_notebook_messages, delete_notebook, insert_message
from models.storage import upload
from typing import List
import logging
from pydantic import BaseModel, Field  # For request/response validation
import uuid
import google.genai as genai
from google.genai.types import GenerateContentConfig, UserContent, ModelContent, Part
from dotenv import load_dotenv
import os
load_dotenv()
# --- Load Environment Variables ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.0-flash"

# ----------- SETTING UP THE API CALLS -----------------
# --- Configure Logging ---
router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables.")
    raise ValueError("API Key not configured")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Gemini API configured successfully.")
    except Exception as e:
        logger.error(f"Error configuring Gemini API: {e}")



# --- Pydantic Models for Data Validation ---
class Message(BaseModel):
    role: str  # Keep as str, validation happens later if needed
    text: str


class ChatRequest(BaseModel):
    user_text: str = Field(..., min_length=1)  # Ensure user_text is not empty
    history: List[Message] # Expects a list of Message objects
    notebookID: str = Field(..., min_length=1)  # Ensure notebookID is not empty


class ChatResponse(BaseModel):
    reply: str

@router.post("/create-notebook")
async def create_notebook_route(req: Request, res: Response):
    """
    Create a new notebook.
    """
    print("Creating a new notebook")
    userID = req.cookies.get("userID")
    notebook_id = str(uuid.uuid4())
    # Call the create_notebook function from notebookModel.py
    response = await create_notebook(notebook_id, userID)
    if response is None:
        raise HTTPException(status_code=500, detail="Error creating notebook")
    res.status_code = status.HTTP_201_CREATED
    return {"notebook_id": notebook_id} # this is the response body

@router.post("/upload")
async def upload_file_route(res: Response, notebookID: str = Form(...), files: List[UploadFile] = File(...)):
    """
    Upload a file to the notebook.
    """
    print("Uploading files to the notebook")
    for file in files:
        file_content = await file.read()
        file_extension = file.filename.split(".")[-1]
        unique_filename = str(uuid.uuid4()) + "." + file_extension
        # Call the upload function from storage.py
        response = upload(file_content, unique_filename, "files", notebookID)
        if response is None:
            raise HTTPException(status_code=500, detail="Error uploading file")
        else:
            insert = await insert_file_metadata(notebookID, unique_filename, file.content_type, file.size, file.filename)
            if insert is None:
                raise HTTPException(status_code=500, detail="Error inserting file metadata")
    # If all files are uploaded successfully, return a success message
    res.status_code = status.HTTP_200_OK
    return {"detail": "Files uploaded successfully"}

# --- API Endpoint ---
@router.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest, user_id: str = Cookie(None)):
    """
    Receives user text and chat history, calls the Gemini API,
    and returns the model's reply.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API Key not configured on server.",
        )

    logger.info(
        f"Received request: user_text='{request.user_text}', history_length={len(request.history)}"
    )

    try:
        client = genai.Client(
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
            chat_session = client.chats.create(
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
            print("User ID: ", user_id)
            await insert_message(
                notebook_id=request.notebookID,
                responder="user",
                message=request.user_text,
                user_id=user_id,
            )
            await insert_message(
                notebook_id=request.notebookID,
                responder=MODEL_NAME,
                message=reply_text,
            )
            logger.info(f"Gemini Reply Text: {reply_text}")
            return ChatResponse(reply=reply_text)

        except ValueError:
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
        
@router.post("/fetch-messages")
async def get_messages_route(res: Response, notebookID: str = Form(...)):
    """
    Get all messages in the notebook.
    """
    print("Getting all messages in the notebook")
    # Call the get_file function from notebookModel.py
    messages = await get_notebook_messages(notebookID)
    if messages is None:
        return {"detail": "No messages found"}
    res.status_code = status.HTTP_200_OK
    return {"messages": messages}

@router.post("/fetch-files")
async def get_files_route(res: Response, notebookID: str = Form(...)):
    """
    Get all files in the notebook.
    """
    print("Getting all files in the notebook")
    # Call the get_file function from notebookModel.py
    files = await get_files(notebookID)
    if files is None:
        return {"detail": "No files found"}
    files_names = []
    for file in files:
        files_names.append(file["file_original_name"])
    res.status_code = status.HTTP_200_OK
    return {"files": files_names}

@router.delete("/delete-notebook")
async def delete_notebook_route(res: Response, notebookID: str = Form(...)):
    """
    Delete a notebook.
    """
    print("Deleting the notebook")
    # Call the delete_notebook function from notebookModel.py
    response = await delete_notebook(notebookID)
    if response is None:
        raise HTTPException(status_code=500, detail="Error deleting notebook")
    res.status_code = status.HTTP_200_OK
    return {"detail": "Notebook deleted"}