import os
from typing import List
from dotenv import load_dotenv
from supabase import Client, create_client
from langchain_community.document_loaders import (
    TextLoader,
    PyPDFLoader,
    UnstructuredWordDocumentLoader,
    CSVLoader,
    UnstructuredHTMLLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai.embeddings import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from chromadb.config import Settings

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

loader_mapping = {
    ".txt": TextLoader,
    ".pdf": PyPDFLoader,
    ".docx": UnstructuredWordDocumentLoader,
    ".csv": CSVLoader,
    ".html": UnstructuredHTMLLoader,
    ".json": TextLoader,
    ".md": TextLoader,
    ".markdown": TextLoader,
    ".py": TextLoader,
    ".js": TextLoader,
    ".ts": TextLoader,
    ".css": TextLoader,
    ".xml": TextLoader,
    ".yaml": TextLoader,
    ".yml": TextLoader,
    ".cpp": TextLoader,
    ".c": TextLoader,
    ".java": TextLoader,
    ".go": TextLoader,
    ".rb": TextLoader,
    ".php": TextLoader,
    ".swift": TextLoader,
    ".kt": TextLoader,
    ".log": TextLoader,
}

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001", google_api_key=os.getenv("GEMINI_API_KEY")
)


async def upload(file: bytes, file_name: str, bucket_name: str, notebook_id: str):
    """Upload a file to Supabase storage and add to vector database."""
    try:
        # Upload the file to Supabase
        response = supabase.storage.from_(bucket_name).upload(
            f"{notebook_id}/{file_name}", file
        )

        if response and response.full_path:
            print(f"File {file_name} uploaded successfully.")
            public_url = supabase.storage.from_(bucket_name).get_public_url(
                response.full_path
            )

            # Process the file for the vector database
            file_extension = os.path.splitext(file_name)[1].lower()
            loader_class = loader_mapping.get(file_extension, TextLoader)

            # Save temporarily and process
            temp_dir = "temp"
            os.makedirs(temp_dir, exist_ok=True)
            temp_path = os.path.join(temp_dir, file_name)

            with open(temp_path, "wb") as f:
                f.write(file)

            try:
                loader = loader_class(temp_path)
                documents = loader.load()

                # Split into chunks
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000, chunk_overlap=100
                )
                chunks = splitter.split_documents(documents)

                # Add metadata to each chunk to identify its source file
                for chunk in chunks:
                    if not chunk.metadata:
                        chunk.metadata = {}
                    chunk.metadata["source"] = file_name

                # Store in vector database
                vectorDB = Chroma.from_documents(
                    chunks,
                    embeddings,
                    collection_name=notebook_id,
                    persist_directory="./chroma_db",
                    client_settings=Settings(
                        persist_directory="./chroma_db",
                        is_persistent=True,
                        anonymized_telemetry=False,  # Add this to prevent telemetry issues
                    ),
                )
                vectorDB.persist()
                print(f"Added {len(chunks)} chunks to vector database for {file_name}")

            except Exception as processing_error:
                print(f"Error processing file for vector database: {processing_error}")
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)

            return public_url
        else:
            print(
                f"Error uploading file: {getattr(response, 'error', 'Unknown error')}"
            )
            return None

    except Exception as e:
        print(f"Exception in upload: {str(e)}")
        return None


async def delete_file(file_path: str, bucket_name: str):
    """
    Delete a file from Supabase storage and clean up its vector embeddings.
    """
    try:
        # Extract notebook_id from file_path (format: notebook_id/file_name)
        notebook_id = file_path.split("/")[0] if "/" in file_path else None
        if not notebook_id:
            print(f"Could not extract notebook ID from path: {file_path}")
            return None

        # Delete the file from storage
        response = supabase.storage.from_(bucket_name).remove([file_path])

        if response:
            print(f"File {file_path} deleted successfully from storage.")

            # Remove vectors from Chroma for this file
            try:
                # Initialize Chroma client for this notebook collection
                chroma_client = Chroma(
                    collection_name=notebook_id,
                    embedding_function=embeddings,
                    persist_directory="./chroma_db",
                    client_settings=Settings(
                        persist_directory="./chroma_db",
                        is_persistent=True,
                        anonymized_telemetry=False,  # Add this to prevent telemetry issues
                    ),
                )

                # Get the file name from the path
                file_name = file_path.split("/")[-1]

                # Query for documents containing this filename in metadata
                # If we've stored metadata about which file each chunk belongs to
                results = chroma_client.get(where={"source": {"$eq": file_name}})

                if results and results["ids"]:
                    # Delete the specific chunks for this file
                    chroma_client.delete(ids=results["ids"])
                    print(
                        f"Removed {len(results['ids'])} chunks from vector database for {file_name}"
                    )
                else:
                    print(f"No chunks found for {file_name} in vector database.")

                # Persist the changes
                chroma_client.persist()

            except Exception as ve:
                print(f"Error removing vectors for {file_path}: {ve}")
                # Continue with the deletion process even if vector removal fails

            return response
        else:
            print(f"Error deleting file: {getattr(response, 'error', 'Unknown error')}")
            return None

    except Exception as e:
        print(f"Exception occurred during file deletion: {e}")
        return None


async def query_file(
    vectorDB: Chroma, query: str, excluded_files: List[str] = [], num_docs: int = 50
):
    """
    Query the vector database for relevant documents.
    """
    retriever = vectorDB.as_retriever(
        search_kwargs={
            "k": num_docs,  # Number of documents to retrieve
            **(
                {"filter": {"source": {"$nin": excluded_files}}}
                if excluded_files and len(excluded_files) > 0
                else {}
            ),
        }
    )
    context = await retriever.ainvoke(query)
    return context
