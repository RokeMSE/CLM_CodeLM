from server import app
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import uuid
import asyncio
from pymongo import AsyncMongoClient


controller = {}

# Define the function first, then assign it to the controller dictionary
async def create_notebook():
    """
    Create a new notebook.
    """
    notebook_id = str(uuid.uuid4())
    notebook_path = f"/chat/{notebook_id}"
    

controller['create_notebook'] = create_notebook