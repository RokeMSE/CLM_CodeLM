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
                    "name": "New Notebook",  # Hardcoded, user will have to rename it
                    "owner": user_id,  # Replace with actual user ID
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow(),
                    "#_of_source": 0,
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
    notebook_collection = db["notebooks"]
    if notebook_collection is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    result = await notebook_collection.delete_one({"metadata.notebook_id": notebook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notebook not found")
    # Delete the messages and files associated with the notebook
    messages_collection = db["notebook_messages"]
    await messages_collection.delete_many({"notebook_id": notebook_id})
    files_collection = db["notebook_files"]
    await files_collection.delete_many({"notebook_id": notebook_id})
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


async def get_notebooks(user_id: str):
    """
    Get a notebook by its ID.
    """
    try:
        notebook_collection = db["notebooks"]
        notebooks = (
            await notebook_collection.find({"metadata.owner": user_id})
            .sort("metadata.created_at", -1)
            .to_list()
        )  # Sort by created_at in descending order
        # Convert ObjectId to string
        for notebook in notebooks:
            notebook["_id"] = str(notebook["_id"])
            if "owner" in notebook:
                notebook["owner"] = str(notebook["owner"])
            if "metadata" in notebook:
                notebook["metadata"]["created_at"] = str(
                    notebook["metadata"]["created_at"]
                )
                notebook["metadata"]["updated_at"] = str(
                    notebook["metadata"]["updated_at"]
                )
        return notebooks
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching notebook: {str(e)}"
        )


async def update_notebook_metadata(
    notebook_id: str,
    title: str = None,
    created_at: str = None,
    source: int = None,
):
    """
    Update the metadata of a notebook.
    """
    try:
        notebook_collection = db["notebooks"]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        update_data = {}
        if title:
            update_data["metadata.name"] = title
        if created_at:
            update_data["metadata.created_at"] = created_at
        if source:
            old_source = await notebook_collection.find_one(
                {"metadata.notebook_id": notebook_id}
            )
            if old_source is None:
                raise HTTPException(status_code=404, detail="Notebook not found")
            update_data["metadata.#_of_source"] = (
                int(old_source["metadata"]["#_of_source"]) + source
            )
        update_data["metadata.updated_at"] = datetime.datetime.utcnow()
        await notebook_collection.update_one(
            {"metadata.notebook_id": notebook_id},
            {"$set": update_data},
        )
        return {"detail": "Notebook metadata updated"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating notebook metadata: {str(e)}"
        )


async def get_notebook_metadata(notebook_id: str):
    """
    Get the metadata of a notebook.
    """
    try:
        notebook_collection = db["notebooks"]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        notebook = await notebook_collection.find_one(
            {"metadata.notebook_id": notebook_id}
        )
        # Convert ObjectId to string
        if notebook is not None:
            notebook["_id"] = str(notebook["_id"])
            if "owner" in notebook:
                notebook["owner"] = str(notebook["owner"])
            if "metadata" in notebook:
                notebook["metadata"]["created_at"] = str(
                    notebook["metadata"]["created_at"]
                )
                notebook["metadata"]["updated_at"] = str(
                    notebook["metadata"]["updated_at"]
                )
        if notebook is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return notebook
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching notebook metadata: {str(e)}"
        )


async def delete_all_file_metadata(notebook_id: str):
    """
    Delete all file metadata associated with a notebook.
    """
    try:
        result = await db.files.delete_many({"notebook_id": notebook_id})
        return result.deleted_count
    except Exception as e:
        print(f"Error deleting file metadata for notebook {notebook_id}: {e}")
        return None


async def delete_notebook_messages(notebook_id: str):
    """
    Delete all messages associated with a notebook.
    """
    try:
        result = await db.messages.delete_many({"notebook_id": notebook_id})
        return result.deleted_count
    except Exception as e:
        print(f"Error deleting messages for notebook {notebook_id}: {e}")
        return None
