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
    get_notebook_metadata,
    get_notebooks,
    insert_file_metadata,
    insert_message,
    update_notebook_metadata,
)
from models.storage import delete_file, read_file, upload
import datetime

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


class GenerationResponse(BaseModel):
    content: str


async def get_combined_source_content(notebook_id: str) -> str:
    """
    Retrieves all files for a notebook, reads their content,
    and combines them into a single string.
    """
    try:
        files = await get_files(notebook_id)
        combined_content = ""
        if not files:
            return combined_content

        for file_meta in files:
            file_path = f"{notebook_id}/{file_meta.get('file_name')}"
            bucket_name = "files"
            file_type = file_meta.get("file_type")
            original_name = file_meta.get("file_original_name", "Unknown File")
            print(f"Reading source file: {original_name} ({file_path})")
            file_content = await read_file(file_path, bucket_name, file_type)

            if file_content:
                combined_content += f"--- Source: {original_name} ---\n"
                combined_content += file_content
                combined_content += "\n\n"  # Add separation between files
            else:
                print(f"Warning: Could not read content for file {original_name}")
                combined_content += (
                    f"--- Source: {original_name} (Could not read content) ---\n\n"
                )
        return combined_content.strip()
    except Exception as e:
        print(f"Error getting combined source content for notebook {notebook_id}: {e}")
        return ""


async def generate_single_turn(prompt: str) -> str:
    """
    Sends a single prompt to the Gemini API and returns the text response.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API Key not configured on server.",
        )

    try:
        generation_config = GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=2048,
            top_p=0.9,
            top_k=40,
        )

        gemini_client = genai.Client(
            api_key=GEMINI_API_KEY,
        )

        print(
            f"Sending generation prompt (length: {len(prompt)} chars) to model: {MODEL_NAME}"
        )
        response = gemini_client.models.generate_content(
            model=MODEL_NAME, contents=prompt, config=generation_config
        )

        if (
            response.candidates
            and response.candidates[0].content
            and response.candidates[0].content.parts
        ):
            reply_text = response.candidates[0].content.parts[0].text
            print("Generation successful.")
            return reply_text
        elif response.prompt_feedback.block_reason:
            block_reason_str = response.prompt_feedback.block_reason.name
            print(f"Generation blocked. Reason: {block_reason_str}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Content generation blocked by safety filters: {block_reason_str}",
            )
        else:
            # Handle cases where response is empty but not blocked (rare)
            print("Generation resulted in empty response without explicit blocking.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI model returned an empty response.",
            )

    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        # Catch other potential errors during API call setup or sending
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while contacting the AI service: {str(e)}",
        )


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
            prompt = ""
            for file in files_content:
                prompt += f"File Name: {file['file_name']}\n"
                prompt += f"Content: {file['content']}\n\n"
            # Add the system instruction to the prompt
            prompt += request.user_text
            # --- Start Chat Session ---
            chat_session = client.chats.create(
                model=MODEL_NAME,
                history=history_objs,
                config=generation_config,
            )
            # --- Send Message to Gemini ---
            response = chat_session.send_message(prompt)
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


@router.delete("/delete-notebook/{notebookID}")
async def delete_notebook_route(res: Response, notebookID: str):
    """
    Delete a notebook.
    """
    print("Deleting the notebook with ID:", notebookID)
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


@router.post("/get-notebook-metadata")
async def get_notebook_metadata_route(res: Response, notebookID: str = Form(...)):
    """
    Get the metadata of a notebook.
    """
    print("Getting the notebook metadata")
    metadata = await get_notebook_metadata(notebookID)
    if metadata is None:
        return {"detail": "No metadata found"}
    res.status_code = status.HTTP_200_OK
    return {"metadata": metadata}


@router.post("/generate-faq", response_model=GenerationResponse)
async def generate_faq_route(notebookID: str = Form(...)):
    """
    Generates Frequently Asked Questions based on the notebook's source documents.
    """
    print(f"Generating FAQ for notebook: {notebookID}")
    source_content = await get_combined_source_content(notebookID)
    if not source_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No source content found for this notebook to generate FAQ.",
        )

    prompt = f"""Based *only* on the following document content, generate a list of 3-5 frequently asked questions (FAQs) and their answers. Format each as a question followed by its answer. Document Content:
{source_content}

FAQs:
"""
    try:
        generated_text = await generate_single_turn(prompt)
        return GenerationResponse(content=generated_text)
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error generating FAQ: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate FAQ: {str(e)}")


@router.post("/generate-study-guide", response_model=GenerationResponse)
async def generate_study_guide_route(notebookID: str = Form(...)):
    """
    Generates a study guide (key topics, potential questions) based on the notebook's source documents.
    """
    print(f"Generating Study Guide for notebook: {notebookID}")
    source_content = await get_combined_source_content(notebookID)
    if not source_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No source content found for this notebook to generate a study guide.",
        )

    prompt = f"""Analyze the following document content and generate a concise study guide. Include:
    1.  A list of the main key topics covered.
    2.  3-4 potential short-answer or definition questions based *only* on the provided text.

    Document Content:
    {source_content}

    Study Guide:
    """
    try:
        generated_text = await generate_single_turn(prompt)
        return GenerationResponse(content=generated_text)
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error generating Study Guide: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate Study Guide: {str(e)}"
        )


@router.post("/generate-briefing", response_model=GenerationResponse)
async def generate_briefing_route(notebookID: str = Form(...)):
    """
    Generates a briefing (summary) based on the notebook's source documents.
    """
    print(f"Generating Briefing for notebook: {notebookID}")
    source_content = await get_combined_source_content(notebookID)
    if not source_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No source content found for this notebook to generate a briefing.",
        )

    prompt = f"""Based *only* on the following document content, generate a concise briefing. 
    The briefing should summarize the key points and findings from the documents.

    Document Content:
    {source_content}

    Briefing:
    """
    try:
        generated_text = await generate_single_turn(prompt)
        return GenerationResponse(content=generated_text)
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error generating Briefing: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate Briefing: {str(e)}"
        )


@router.post("/save-generated-source")
async def save_generated_source_route(
    res: Response,
    notebookID: str = Form(...),
    content: str = Form(...),
    title: str = Form(...),
):
    """
    Saves text content (from user notes or generation) as a new markdown source file
    associated with the notebook.
    """
    print(
        f"Saving generated/note content as source for notebook: {notebookID}, Title: {title}"
    )

    if not content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")
    if not title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        file_content_bytes = content.encode("utf-8")
        file_size = len(file_content_bytes)
        unique_filename = f"{timestamp}.md"  # Save as markdown
        file_type = "text/markdown"
        bucket_name = "files"

        print(
            f"Uploading new source file: {unique_filename} to bucket: {bucket_name}/{notebookID}"
        )
        public_url = await upload(
            file_content_bytes, unique_filename, bucket_name, notebookID
        )

        if not public_url:
            print("Error: Failed to upload generated source to storage.")
            raise HTTPException(
                status_code=500, detail="Error saving source file to storage."
            )
        else:
            print(f"Successfully uploaded. Public URL: {public_url}")

        print(f"Inserting metadata for new source: {unique_filename}")
        await insert_file_metadata(
            notebook_id=notebookID,
            file_name=unique_filename,
            file_type=file_type,
            file_size=file_size,
            file_original_name=title,  # Use the provided title as the display name
            public_url=public_url,
        )

        await update_notebook_metadata(notebook_id=notebookID, source=1)

        res.status_code = status.HTTP_201_CREATED  # Use 201 for resource creation
        return {
            "detail": "Source saved successfully",
            "filename": unique_filename,
            "public_url": public_url,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error saving generated source: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save source: {str(e)}")
