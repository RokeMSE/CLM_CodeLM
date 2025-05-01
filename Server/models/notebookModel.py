from http.client import HTTPException
from pymongo import AsyncMongoClient
import datetime
import os

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
            notebook_id
        ]  # Create a new collection for the notebook
        await notebook_collection.insert_one(
            {
                "metadata": {
                    "notebook_id": notebook_id,
                    "owner": "user_id",  # Replace with actual user ID
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


async def get_notebook(notebook_id: str):  # get messages in the notebook
    """
    Get a notebook by its ID.
    """
    notebook_collection = db[notebook_id]
    if notebook_collection is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook_collection


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
):
    """
    Insert file metadata into the notebook.
    """
    try:
        notebook_collection = db[notebook_id]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        await notebook_collection.insert_one(
            {
                "file_name": file_name,
                "file_type": file_type,
                "file_size": file_size,
                "file_original_name": file_original_name,
                "created_at": datetime.datetime.utcnow(),
            }
        )
        return {"detail": "File metadata inserted"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error inserting file metadata: {str(e)}"
        )


async def get_files(notebook_id: str):
    """
    Get all files in the notebook.
    """
    try:
        notebook_collection = db[notebook_id]
        if notebook_collection is None:
            raise HTTPException(status_code=404, detail="Notebook not found")
        files = await notebook_collection.find(
            {"file_name": {"$exists": True}}
        ).to_list(length=None)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching files: {str(e)}")
