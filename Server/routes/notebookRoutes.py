import os
import uuid
from typing import List, Optional
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
    BackgroundTasks,
)
import logging
from google.genai.types import GenerateContentConfig
from pydantic import BaseModel, Field  # For request/response validation

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
from models.storage import delete_file, read_file, upload
import datetime
from rag_processing import (
    process_document_for_rag,
    delete_document_from_rag,
    get_qdrant_collection_name,
)
from langchain_core.documents import Document
from langchain_qdrant import Qdrant
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

from rag_config import llm, qdrant_client, embeddings_model

load_dotenv()
# --- Load Environment Variables ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemma3:1b-it-qat"
SYSTEM_INSTRUCTION = os.getenv("SYSTEM_INSTRUCTION")

# ----------- SETTING UP THE API CALLS -----------------
# --- Configure Logging ---
router = APIRouter()
logger = logging.getLogger(__name__)


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


def format_docs(docs: List[Document]) -> str:
    """Concatenates page_content of documents for context."""
    if not docs:
        return "No relevant context found."
    return "\n\n".join(doc.page_content for doc in docs)


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
    res: Response,
    background_tasks: BackgroundTasks,
    notebookID: str = Form(...),
    files: List[UploadFile] = File(...),
):
    """
    Upload a file to the notebook.
    """
    logger.info(f"Uploading {len(files)} file(s) to notebook: {notebookID}")
    uploaded_file_details = []

    for file in files:
        try:
            file_content = await file.read()
            file_extension = file.filename.split(".")[-1]
            unique_filename = str(uuid.uuid4()) + "." + file_extension

            # 1. Upload to Supabase Storage
            public_url = await upload(
                file_content, unique_filename, "files", notebookID
            )
            if public_url is None:
                logger.error(f"Error uploading {file.filename} to Supabase.")
                continue
            await insert_file_metadata(
                notebookID,
                unique_filename,
                file.content_type if file.content_type else "application/octet-stream",
                len(file_content),
                file.filename,
                public_url,
            )

            # 2. Insert metadata into MongoDB
            uploaded_file_details.append(
                {
                    "notebook_id": notebookID,
                    "file_name_in_storage": unique_filename,
                    "original_file_name": file.filename
                    if file.filename
                    else "untitled",
                    "file_content_type": file.content_type
                    if file.content_type
                    else "application/octet-stream",
                }
            )
        except Exception as e:
            logger.error(
                f"Error processing file {file.filename} for upload: {e}", exc_info=True
            )

    if not uploaded_file_details:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No files were successfully uploaded or processed for Supabase/MongoDB.",
        )

    # 3. Trigger RAG processing for successfully uploaded files in the background
    for details in uploaded_file_details:
        background_tasks.add_task(
            process_document_for_rag,
            notebook_id=details["notebook_id"],
            file_name_in_storage=details["file_name_in_storage"],
            original_file_name=details["original_file_name"],
            file_type=details["file_content_type"],
        )
        logger.info(f"Scheduled RAG processing for {details['original_file_name']}")

    source_update_count = len(files)
    if source_update_count > 0:
        await update_notebook_metadata(notebookID, source=source_update_count)

    res.status_code = status.HTTP_200_OK
    return {"detail": "Files uploaded successfully"}


# --- API Endpoint ---
@router.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest, user_id: str = Cookie(None)):
    """
    Receives user text and chat history, calls the RAG chain with Ollama LLM,
    and returns the model's reply.
    """
    if not llm or not qdrant_client or not embeddings_model:
        logger.error(
            "LLM, Qdrant client, or Embeddings model not initialized. Cannot process chat request."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A core AI service is not available. Please try again later.",
        )

    notebook_id = request.notebookID
    user_query = request.user_text

    try:
        collection_name = get_qdrant_collection_name(notebook_id)
        try:
            qdrant_client.get_collection(collection_name=collection_name)
            logger.info(f"Accessing Qdrant collection: {collection_name}")
        except Exception as e:
            logger.warning(
                f"Qdrant collection {collection_name} not found or Qdrant error: {e}. Retrieval might yield no results."
            )

        qdrant_vector_store = Qdrant(
            client=qdrant_client,
            collection_name=collection_name,
            embeddings=embeddings_model,
        )

        retriever = qdrant_vector_store.as_retriever(search_kwargs={"k": 3})

        template = """
        Answer the following question based only on the provided context.
        If the context does not contain the answer, say "I cannot answer this question based on the provided documents."
        Do not make up information.

        Context:
        {context}

        Question: {question}
        """
        prompt = ChatPromptTemplate.from_template(template)

        rag_chain = (
            {
                "context": retriever | RunnableLambda(format_docs),
                "question": RunnablePassthrough(),
            }
            | prompt
            | llm
            | StrOutputParser()
        )

        llm_response_text = await rag_chain.ainvoke(user_query)

        if user_id:
            await insert_message(
                notebook_id=notebook_id,
                responder="user",
                message=user_query,
                user_id=user_id,
            )
            await insert_message(
                notebook_id=notebook_id,
                responder=MODEL_NAME,
                message=llm_response_text,
                user_id=None,  #
            )
            logger.info("User query and LLM response stored in conversation history.")
        else:
            logger.warning(
                "No user_id found (user might not be logged in). Skipping message storage."
            )

        return ChatResponse(reply=llm_response_text)

    except HTTPException as http_exc:
        logger.error(
            f"HTTPException during chat processing: {http_exc.detail}", exc_info=True
        )
        raise http_exc  # Re-raise FastAPI's HTTPException
    except Exception as e:
        logger.error(
            f"An unexpected error occurred during chat processing: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing your request: {str(e)}",
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
    res: Response,
    background_tasks: BackgroundTasks,
    files: List[str] = Form(...),
    notebookID: str = Form(...),
):
    """
    Delete a file from the notebook.
    """
    logger.info(f"Deleting {len(files)} file(s) from notebook: {notebookID}")
    deleted_count_db = 0
    source_reduction_count = 0

    all_files_metadata = await get_files(
        notebookID
    )  # Fetch all file metadata for this notebook
    file_metadata_map = {fmeta["file_name"]: fmeta for fmeta in all_files_metadata}

    for file_name_in_storage_to_delete in files:
        try:
            # 1. Delete from Supabase Storage
            supabase_file_path = f"{notebookID}/{file_name_in_storage_to_delete}"
            await delete_file(supabase_file_path, "files")

            # Get original file name for RAG deletion and logging
            original_file_name = "unknown_file"
            if file_name_in_storage_to_delete in file_metadata_map:
                original_file_name = file_metadata_map[
                    file_name_in_storage_to_delete
                ].get("file_original_name", "unknown_file")

            # 2. Delete from MongoDB
            await delete_file_metadata(file_name_in_storage_to_delete, notebookID)
            deleted_count_db += 1
            source_reduction_count += 1

            # 3. Trigger RAG data deletion in the background
            background_tasks.add_task(
                delete_document_from_rag,
                notebook_id=notebookID,
                original_file_name=original_file_name,  # Pass the original name for metadata matching in Qdrant
            )
            logger.info(
                f"Scheduled RAG data deletion for original file: {original_file_name}"
            )
        except HTTPException as http_exc:
            logger.warning(
                f"Skipping deletion of {file_name_in_storage_to_delete} due to model error: {http_exc.detail}"
            )
        except Exception as e:
            logger.error(
                f"Error deleting file {file_name_in_storage_to_delete}: {e}",
                exc_info=True,
            )

    if source_reduction_count > 0:
        await update_notebook_metadata(notebookID, source=-source_reduction_count)

    if deleted_count_db == 0 and len(files) > 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching files found to delete from database.",
        )

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
