import os
import uuid
from typing import List, Optional
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
import ollama
from pydantic import BaseModel, Field  # For request/response validation
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from models.notebookModel import (
    create_notebook,
    delete_all_file_metadata,
    delete_file_metadata,
    delete_notebook,
    delete_notebook_messages,
    get_files,
    get_notebook_messages,
    get_notebook_metadata,
    get_notebooks,
    insert_file_metadata,
    insert_message,
    update_notebook_metadata,
)
from models.storage import delete_file, query_file, upload, get_chroma_settings
import datetime
import subprocess

# Load environment variables
load_dotenv()

# --- Custom Model Configuration ---
CUSTOM_MODEL_NAME = "my-custom-model"  # Name to identify your model
LOCAL_MODEL = os.getenv("LOCAL_MODEL", "llama3")  # Use llama3 as fallback
SYSTEM_INSTRUCTION = os.getenv("SYSTEM_INSTRUCTION", "You are a helpful assistant.")
print(f"Initializing with model: {LOCAL_MODEL}")

# Create a Modelfile in memory - using a known base model
modelfile_content = """
FROM llama3
PARAMETER temperature 0.9
PARAMETER top_p 0.95
PARAMETER num_predict 512
PARAMETER top_k 40
"""

try:
    # Check if model already exists
    models = ollama.list()
    model_exists = any(
        model.get("name") == CUSTOM_MODEL_NAME for model in models.get("models", [])
    )

    if not model_exists:
        print(f"Creating custom model '{CUSTOM_MODEL_NAME}'")

        # Create physical Modelfile
        modelfile_path = os.path.join(os.getcwd(), "Modelfile")
        with open(modelfile_path, "w") as f:
            f.write(modelfile_content)

        result = subprocess.run(
            ["ollama", "create", CUSTOM_MODEL_NAME, "-f", modelfile_path],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print(f"✅ Custom model '{CUSTOM_MODEL_NAME}' created successfully!")
            LOCAL_MODEL = CUSTOM_MODEL_NAME
        else:
            print(f"Error creating model: {result.stderr}")
            # Keep using the fallback model
    else:
        print(f"✅ Custom model '{CUSTOM_MODEL_NAME}' already exists")
        LOCAL_MODEL = CUSTOM_MODEL_NAME

except Exception as e:
    print(f"Error setting up custom model: {e}")
    # Continue with default model
    print("Using fallback model: llama3")

# Replace Google embeddings with HuggingFace embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")

os.makedirs("./chroma_db", exist_ok=True)

# --- Configure Logging ---
router = APIRouter()


# --- Pydantic Models for Data Validation ---
class Message(BaseModel):
    role: str  # Keep as str, validation happens later if needed
    text: str


class ChatRequest(BaseModel):
    user_text: str = Field(..., min_length=1)  # Ensure user_text is not empty
    history: List[Message]  # Expects a list of Message objects
    notebookID: str = Field(..., min_length=1)  # Ensure notebookID is not empty
    excluded_files: Optional[List[str]] = Field(
        default=[]
    )  # Add excluded files field with default empty list


class ChatResponse(BaseModel):
    reply: str


class GenerationResponse(BaseModel):
    content: str


async def generate_single_turn(prompt: str) -> str:
    """
    Sends a single prompt to Ollama and returns the text response.
    """
    return await generate_with_ollama(prompt=prompt, temperature=0.7)


async def generate_with_ollama(
    prompt: str,
    system_prompt: str = None,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 40,
    num_predict: int = 2048,
    stop_sequences: List[str] = None,
    repeat_penalty: float = 1.1,
    presence_penalty: float = 0.0,
    frequency_penalty: float = 0.0,
    seed: int = None,
) -> str:
    """
    Sends a prompt to Ollama and returns the text response.
    """
    try:
        print(
            f"Sending prompt (length: {len(prompt)} chars) to Ollama model: {LOCAL_MODEL}"
        )

        # Configure parameters for Ollama - UPDATED STRUCTURE
        params = {
            "model": LOCAL_MODEL,
            "prompt": prompt,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
                "num_predict": num_predict,
                "repeat_penalty": repeat_penalty,
            },
            "stream": False,
        }

        # Only add optional parameters if they're provided
        if system_prompt:
            params["system"] = system_prompt

        if stop_sequences:
            if "options" not in params:
                params["options"] = {}
            params["options"]["stop"] = stop_sequences

        if presence_penalty != 0.0:
            if "options" not in params:
                params["options"] = {}
            params["options"]["presence_penalty"] = presence_penalty

        if frequency_penalty != 0.0:
            if "options" not in params:
                params["options"] = {}
            params["options"]["frequency_penalty"] = frequency_penalty

        if seed is not None:
            if "options" not in params:
                params["options"] = {}
            params["options"]["seed"] = seed

        # Generate response from Ollama
        response = ollama.generate(**params)

        if response and "response" in response:
            reply_text = response["response"]
            print("Generation successful.")
            return reply_text
        else:
            print("Generation resulted in empty response.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI model returned an empty response.",
            )

    except Exception as e:
        print(f"Error during Ollama API call: {e}")
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
    Receives user text and chat history, calls Ollama,
    and returns the model's reply.
    """
    context = ""
    try:
        # Context retrieval stays mostly the same
        vectorDB = Chroma(
            collection_name=request.notebookID,
            embedding_function=embeddings,
            client_settings=get_chroma_settings(),
        )

        context = await query_file(
            vectorDB,
            request.user_text,
            excluded_files=request.excluded_files,
            num_docs=100,
        )
        if not context:
            context = "No relevant context found."
        else:
            # Format context with clear section markers
            context = "\n".join([doc.page_content for doc in context])
            # Truncate context if it's too long (optional)
            if len(context) > 15000:  # Adjust this value based on your needs
                context = context[:15000] + "..."
            print(f"Context retrieved: {context[:100]}...")

        # Format history for Ollama (simpler format than Gemini)
        chat_history = ""
        for msg in request.history:
            if msg.role == "user":
                chat_history += f"User: {msg.text}\n"
            elif msg.role == "model":
                chat_history += f"Assistant: {msg.text}\n"

        # Create a more structured system prompt
        system_prompt = f"""You are an AI assistant that always bases answers on the provided CONTEXT ONLY.

<context>
{context}
</context>

RULES:
- Read the context above carefully before answering
- Only use information found in the context
- If information is not in the context, say "I don't have that information"
- Never make up facts or details not present in the context
- Answer with specific details and direct quotes from the context when possible
"""
        # Create the user prompt separately
        full_prompt = f"{chat_history}User: {request.user_text}\nAssistant:"

        # Generate response with Ollama
        reply_text = await generate_with_ollama(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=1.0,
            top_p=0.95,
            top_k=40,
            num_predict=512,
        )

        # Save conversation to database
        await insert_message(
            notebook_id=request.notebookID,
            responder="user",
            message=request.user_text,
            user_id=user_id,
        )
        await insert_message(
            notebook_id=request.notebookID,
            responder=LOCAL_MODEL,
            message=reply_text,
        )

        return ChatResponse(reply=reply_text)

    except Exception as e:
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
    Delete a notebook and all associated data (files, metadata, messages).
    """
    print("Deleting notebook with ID:", notebookID)

    try:
        # 1. Get all files for this notebook
        files = await get_files(notebookID)

        # 2. Delete each file from storage
        if files:
            for file in files:
                file_name = file.get("file_name")
                print(f"Deleting file from storage: {notebookID}/{file_name}")
                await delete_file(f"{notebookID}/{file_name}", "files")

        # 3. Delete all file metadata for this notebook (batch operation)
        print(f"Deleting all file metadata for notebook: {notebookID}")
        await delete_all_file_metadata(notebookID)

        # 4. Delete all messages for this notebook
        print(f"Deleting all messages for notebook: {notebookID}")
        await delete_notebook_messages(notebookID)

        # 5. Finally delete the notebook itself
        response = await delete_notebook(notebookID)
        if response is None:
            raise HTTPException(status_code=500, detail="Error deleting notebook")

        res.status_code = status.HTTP_200_OK
        return {"detail": "Notebook and all associated data deleted successfully"}

    except Exception as e:
        print(f"Error during notebook deletion: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting notebook: {str(e)}"
        )


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
    vectorDB = Chroma(
        collection_name=notebookID,
        embedding_function=embeddings,
        client_settings=get_chroma_settings(),
    )
    source_content = await query_file(
        vectorDB,
        "Generate a list of 3-5 frequently asked questions (FAQs) and their answers.",
        num_docs=100,
    )
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
    vectorDB = Chroma(
        collection_name=notebookID,
        embedding_function=embeddings,
        client_settings=get_chroma_settings(),
    )
    source_content = await query_file(
        vectorDB,
        "Generate a study guide with key topics and potential questions.",
        num_docs=100,
    )
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
    vectorDB = Chroma(
        collection_name=notebookID,
        embedding_function=embeddings,
        client_settings=get_chroma_settings(),
    )
    source_content = await query_file(
        vectorDB,
        "Generate a concise briefing summarizing the key points and findings.",
        num_docs=100,
    )
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
