import datetime
import os
from http.client import HTTPException

from pymongo import AsyncMongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

mongo_client = AsyncMongoClient(MONGO_URI)
db = mongo_client["CodeLM"]
# each notebook is a collection that holds the user's input and the model's output


async def create_notebook(notebook_id: str, user_id: str):
    """
    Create a new notebook.
    """
    try:
        notebook_collection = db[
            "notebooks"
        ]  # Create a new collection for the notebook
        await notebook_collection.insert_one(
            {
                "metadata": {
                    "notebook_id": notebook_id,
                    "owner": user_id,  # Replace with actual user ID
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow(),
                    "number of documents": 0,
                },
            }
        )
        return notebook_collection
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating notebook: {str(e)}"
        )


async def get_notebook_messages(notebook_id: str):  # get messages in the notebook
    """
    Get a notebook by its ID.
    """
    notebook_collection = db["notebook_messages"]
    messages = notebook_collection.find({"notebook_id": notebook_id}).sort(
        "metadata.created_at", 1
    )  # Sort by created_at in ascending order
    messages = await messages.to_list(length=None)
    # Convert ObjectId to string
    for message in messages:
        message["_id"] = str(message["_id"])
        if "user_id" in message:
            message["user_id"] = str(message["user_id"])
        if "notebook_id" in message:
            message["notebook_id"] = str(message["notebook_id"])
        if "metadata" in message:
            message["metadata"]["created_at"] = str(message["metadata"]["created_at"])
            message["metadata"]["updated_at"] = str(message["metadata"]["updated_at"])
    return messages


async def delete_notebook(notebook_id: str):
    """
    Delete a notebook by its ID.
    """
    notebook_collection = db[notebook_id]
    if notebook_collection is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await notebook_collection.drop()
    return {"detail": "Notebook deleted"}


async def insert_file_metadata(
    notebook_id: str,
    file_name: str,
    file_type: str,
    file_size: int,
    file_original_name: str,
    public_url: str = None,
):
    """
    Insert file metadata into the notebook.
    """
    try:
        notebook_collection = db["notebook_files"]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        await notebook_collection.insert_one(
            {
                "file_name": file_name,
                "file_type": file_type,
                "file_size": file_size,
                "file_original_name": file_original_name,
                "notebook_id": notebook_id,
                "public_url": public_url,
                "metadata": {
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow(),
                },
            }
        )
        return {"detail": "File metadata inserted"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error inserting file metadata: {str(e)}"
        )


async def delete_file_metadata(file_name: str, notebook_id: str):
    """
    Delete file metadata from the notebook.
    """
    try:
        notebook_collection = db["notebook_files"]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        result = await notebook_collection.delete_one(
            {"file_name": file_name, "notebook_id": notebook_id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="File not found")
        return {"detail": "File metadata deleted"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting file metadata: {str(e)}"
        )


async def get_files(notebook_id: str):
    """
    Get all files in the notebook.
    """
    try:
        notebook_collection = db["notebook_files"]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        files = await notebook_collection.find({"notebook_id": notebook_id}).to_list(
            length=None
        )
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching files: {str(e)}")


async def insert_message(
    notebook_id: str, message: str, responder: str, user_id: str = None
):
    """
    Insert a message into the notebook.
    """
    try:
        notebook_collection = db["notebook_messages"]
        # Check if the notebook collection exists
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        await notebook_collection.insert_one(
            {
                "text": message,
                "by": responder,  # user or gemini model
                "role": "user" if user_id is not None else "model",
                "notebook_id": notebook_id,
                "metadata": {
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow(),
                },
                "user_id": user_id,  # Replace with actual user ID, if it is gemini model, it will be None
            }
        )
        return {"detail": "Message inserted"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error inserting message: {str(e)}"
        )
