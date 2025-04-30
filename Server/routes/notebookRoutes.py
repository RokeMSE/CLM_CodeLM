from fastapi import APIRouter, Request, Response, status
import uuid

router = APIRouter()


@router.post("/create-notebook")
async def create_notebook_route(req: Request, res: Response):
    """
    Create a new notebook.
    """
    print("Creating a new notebook")
    notebook_id = str(uuid.uuid4())
    res.status_code = status.HTTP_201_CREATED
    return {"notebook_id": notebook_id}  # this is the response body
