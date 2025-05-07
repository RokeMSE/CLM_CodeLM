import logging

from rag_config import embeddings_model, qdrant_client

from models.storage import read_file
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_qdrant_collection_name(notebook_id: str) -> str:
    """Generates a Qdrant-compatible collection name from a notebook ID."""
    return f"notebook_{notebook_id.replace('-', '_')}"


async def process_document_for_rag(
    notebook_id: str,
    file_name_in_storage: str,
    original_file_name: str,
    file_type: str,
):
    """
    Processes a single document for RAG: loads, chunks, embeds, and stores in Qdrant.
    """
    if not embeddings_model or not qdrant_client:
        logger.error(
            "Embeddings model or Qdrant client not initialized. Skipping RAG processing."
        )
        return

    logger.info(
        f"Starting RAG processing for file: {original_file_name} in notebook: {notebook_id}"
    )
    try:
        supabase_file_path = f"{notebook_id}/{file_name_in_storage}"
        bucket_name = "files"

        raw_content = await read_file(supabase_file_path, bucket_name, file_type)

        if raw_content is None:
            logger.error(
                f"Could not read content for file {original_file_name} from Supabase."
            )
            return

        docs_to_process = [
            Document(
                page_content=raw_content,
                metadata={
                    "source": original_file_name,
                    "notebook_id": notebook_id,
                    "file_name_in_storage": file_name_in_storage,
                },
            )
        ]

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            is_separator_regex=False,
            add_start_index=True,
        )

        all_splits = text_splitter.split_documents(docs_to_process)
        logger.info(f"Split {original_file_name} into {len(all_splits)} chunks.")

        collection_name = get_qdrant_collection_name(notebook_id)

        qdrant_vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=collection_name,
            embedding=embeddings_model,
        )

        await qdrant_vector_store.aadd_documents(documents=all_splits)
    except Exception as e:
        logger.error(
            f"Error during RAG processing for {original_file_name} in notebook {notebook_id}: {e}",
            exc_info=True,
        )


async def delete_document_from_rag(
    notebook_id: str,
    original_file_name: str,
):
    """
    Deletes all chunks/vectors associated with a specific original file name from Qdrant.
    """

    if not qdrant_client:
        logger.error("Qdrant client not initialized. Skipping RAG deletion.")
        return

    collection_name = get_qdrant_collection_name(notebook_id)
    logger.info(
        f"Attempting to delete documents for source: {original_file_name} from Qdrant collection: {collection_name}"
    )
    try:
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue

        qdrant_client.delete(
            collection_name=collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="metadata.source",
                        match=MatchValue(value=original_file_name),
                    )
                ]
            ),
        )
        logger.info(
            f"Successfully deleted documents for source: {original_file_name} from Qdrant collection: {collection_name}"
        )
    except Exception as e:
        logger.error(
            f"Error deleting documents for source: {original_file_name} from Qdrant collection {collection_name}: {e}",
            exc_info=True,
        )
