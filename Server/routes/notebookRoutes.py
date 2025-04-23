from fastapi import APIRouter, Request, Response, status
from models.notebookModel import create_notebook
import uuid

router = APIRouter()
@router.post("/create-notebook")
async def create_notebook_route(req: Request, res: Response):
    """
    Create a new notebook.
    """
    print("Creating a new notebook")
    notebook_id = str(uuid.uuid4())
    notebook_collection = await create_notebook(notebook_id, '0') # user_id is hardcoded to 0 for now TODO: Receive user_id from the frontend
    res.status_code = status.HTTP_201_CREATED
    return {"notebook_id": notebook_id} # this is the response body