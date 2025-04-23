from typing import Union
from pymongo import AsyncMongoClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.notebookRoutes import router as notebook_router


app = FastAPI()
client = AsyncMongoClient("mongodb://localhost:27017")
app.include_router(notebook_router, prefix="/api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # or ["*"] during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)