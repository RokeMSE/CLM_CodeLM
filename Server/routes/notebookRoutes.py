from fastapi import APIRouter, Request, Response, status, HTTPException, UploadFile, File, Form, Query
from models.notebookModel import create_notebook, insert_file_metadata, get_files
from models.storage import upload
from typing import List
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

@router.post("/upload")
async def upload_file_route(res: Response, notebookID: str = Form(...), files: List[UploadFile] = File(...)):
    """
    Upload a file to the notebook.
    """
    print("Uploading files to the notebook")
    for file in files:
        file_content = await file.read()
        file_extension = file.filename.split(".")[-1]
        unique_filename = str(uuid.uuid4()) + "." + file_extension
        # Call the upload function from storage.py
        response = upload(file_content, unique_filename, "files", notebookID)
        if response is None:
            raise HTTPException(status_code=500, detail="Error uploading file")
        else:
            insert = await insert_file_metadata(notebookID, unique_filename, file.content_type, file.size, file.filename)
            if insert is None:
                raise HTTPException(status_code=500, detail="Error inserting file metadata")
    # If all files are uploaded successfully, return a success message
    res.status_code = status.HTTP_200_OK
    return {"detail": "Files uploaded successfully"}

@router.get("/notebook_files")
async def get_files_route(res: Response, notebookID: str = Query(...)):
    """
    Get all files in the notebook.
    """
    print("Getting all files in the notebook")
    # Call the get_file function from notebookModel.py
    files = await get_files(notebookID)
    if files is None:
        return {"detail": "No files found"}
    files_names = []
    for file in files:
        files_names.append(file["file_original_name"])
    res.status_code = status.HTTP_200_OK
    return {"files": files_names}