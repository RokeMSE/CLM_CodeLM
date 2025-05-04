import os
import uuid
from typing import List
import google.genai as genai
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Cookie,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from google.genai.types import GenerateContentConfig, ModelContent, Part, UserContent
from pydantic import BaseModel, Field  # For request/response validation

from models.notebookModel import (
    create_notebook,
    delete_file_metadata,
    delete_notebook,
    get_files,
    get_notebook_messages,
    get_notebooks,
    insert_file_metadata,
    insert_message,
    update_notebook_metadata,
)
from models.storage import delete_file, read_file, upload

load_dotenv()
# --- Load Environment Variables ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.0-flash"
SYSTEM_INSTRUCTION = os.getenv("SYSTEM_INSTRUCTION")

# ----------- SETTING UP THE API CALLS -----------------
# --- Configure Logging ---
router = APIRouter()

if not GEMINI_API_KEY:
    raise ValueError("API Key not configured")


# --- Pydantic Models for Data Validation ---
class Message(BaseModel):
    role: str  # Keep as str, validation happens later if needed
    text: str


class ChatRequest(BaseModel):
    user_text: str = Field(..., min_length=1)  # Ensure user_text is not empty
    history: List[Message]  # Expects a list of Message objects
    notebookID: str = Field(..., min_length=1)  # Ensure notebookID is not empty


class ChatResponse(BaseModel):
    reply: str


@router.post("/create-notebook")
async def create_notebook_route(res: Response, user_id: str = Cookie(None)):
    """
    Create a new notebook.
    """
    print("Creating a new notebook")
    notebook_id = str(uuid.uuid4())
    response = await create_notebook(notebook_id, user_id)
    if response is None:
        raise HTTPException(status_code=500, detail="Error creating notebook")
    res.status_code = status.HTTP_201_CREATED
    return {"notebook_id": notebook_id}  # this is the response body


@router.post("/upload")
async def upload_file_route(
    res: Response, notebookID: str = Form(...), files: List[UploadFile] = File(...)
):
    """
    Upload a file to the notebook.
    """
    print("Uploading files to the notebook")
    for file in files:
        file_content = await file.read()
        file_extension = file.filename.split(".")[-1]
        unique_filename = str(uuid.uuid4()) + "." + file_extension
        # Call the upload function from storage.py
        response = await upload(file_content, unique_filename, "files", notebookID)
        if response is None:
            raise HTTPException(status_code=500, detail="Error uploading file")
        else:
            insert = await insert_file_metadata(
                notebookID,
                unique_filename,
                file.content_type,
                file.size,
                file.filename,
                response,
            )
            if insert is None:
                raise HTTPException(
                    status_code=500, detail="Error inserting file metadata"
                )
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

    try:
        client = genai.Client(
            api_key=GEMINI_API_KEY,
            # Optional: Set the region if needed
            # region="us-central1",
        )
        files = await get_files(request.notebookID)
        files_content = []
        for file in files:
            print(f"Reading file: {file['file_name']}")
            file_content = await read_file(
                f"{request.notebookID}/{file['file_name']}", "files", file["file_type"]
            )
            if file_content is not None:
                files_content.append(
                    {"file_name": file["file_original_name"], "content": file_content}
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
            # system_instruction=SYSTEM_INSTRUCTION,
        )
        try:
            # --- Start Chat Session ---
            chat_session = client.chats.create(
                model=MODEL_NAME,
                history=history_objs,
                config=generation_config,
            )
            # --- Send Message to Gemini ---
            response = chat_session.send_message(
                request.user_text,
            )
            # --- Process Response ---
            reply_text = response.text
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
            return ChatResponse(reply=reply_text)

        except ValueError:
            # This usually indicates the response was blocked by safety settings
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
        except Exception as e:
            # Catch other potential errors during response processing
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing the bot's response.{str(e)}",
            )

    except Exception as e:
        # Catch potential errors during API call setup or sending
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
    try:
        print("Getting all files in the notebook")
        files = await get_files(notebookID)
        for file in files:
            # Convert ObjectId to string
            file["_id"] = str(file["_id"])
            if "notebook_id" in file:
                file["notebook_id"] = str(file["notebook_id"])
            if "created_at" in file:
                file["created_at"] = str(file["created_at"])
        res.status_code = status.HTTP_200_OK
        return {"files": files if files is not None else []}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"detail": f"Error fetching files: {str(e)}"}


@router.post("/delete-files")
async def delete_file_route(
    res: Response, files: List[str] = Form(...), notebookID: str = Form(...)
):
    """
    Delete a file from the notebook.
    """
    print("Deleting the file")
    print(f"Files to delete: {files}")
    for file_name in files:
        print(f"Deleting file: {file_name}")
        print(f"Deleting file from {notebookID}/{file_name}")
        response = await delete_file(f"{notebookID}/{file_name}", "files")
        if response is None:
            raise HTTPException(status_code=500, detail="Error deleting file")
        response = await delete_file_metadata(file_name, notebookID)
        if response is None:
            raise HTTPException(status_code=500, detail="Error deleting file metadata")
    res.status_code = status.HTTP_200_OK
    return {"detail": "File deleted"}


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


@router.get("/get-notebooks")
async def get_notebooks_route(res: Response, user_id: str = Cookie(None)):
    """
    Get all notebooks for a user.
    """
    print("Getting all notebooks")
    # Call the get_notebook function from notebookModel.py
    response = await get_notebooks(user_id)
    if response is None:
        raise HTTPException(status_code=500, detail="Error getting notebooks")
    res.status_code = status.HTTP_200_OK
    return {"notebooks": response}


@router.post("/update-title")
async def update_title_route(
    res: Response,
    title: str = Form(...),
    notebookID: str = Form(...),
):
    """
    Update the title of a notebook.
    """
    print("Updating the notebook title", notebookID)
    response = await update_notebook_metadata(
        notebookID,
        title,
    )
    if response is None:
        raise HTTPException(status_code=500, detail="Error updating notebook title")
    res.status_code = status.HTTP_200_OK
    return {"detail": "Notebook title updated"}


@router.post("/update-source")
async def update_source_route(
    res: Response,
    source: str = Form(...),
    notebookID: str = Form(...),
):
    """
    Update the source of a notebook.
    """
    print("Updating the notebook source", notebookID)
    source = int(source)
    response = await update_notebook_metadata(
        notebookID,
        None,
        None,
        source,
    )
    if response is None:
        raise HTTPException(status_code=500, detail="Error updating notebook source")
    res.status_code = status.HTTP_200_OK
    return {"detail": "Notebook source updated"}
