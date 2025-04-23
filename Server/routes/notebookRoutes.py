from fastapi import APIRouter
from models.database import create_notebook
import uuid

router = APIRouter()
@router.post("/create-notebook")
async def create_notebook_route():
    """
    Create a new notebook.
    """
    print("Creating a new notebook")
    notebook_id = str(uuid.uuid4())
    notebook_collection = await create_notebook(notebook_id)
    return {"notebook_id": notebook_id}