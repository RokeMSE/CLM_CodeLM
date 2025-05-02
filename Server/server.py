from pymongo import AsyncMongoClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.notebookRoutes import router as notebook_router
from routes.authRoutes import router as auth_router
from dotenv import load_dotenv
import os

# --- Load Environment Variables ---
load_dotenv()  # Get the local one
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- FastAPI App Initialization ---
app = FastAPI()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

mongo_client = AsyncMongoClient(MONGO_URI)

app.include_router(notebook_router, prefix="/api")
app.include_router(auth_router)  # does not need a prefix

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, etc.
    allow_headers=["*"],  # Allows all headers
)

# --- Add a root endpoint for basic testing ---
@app.get("/")
def read_root():
    return {"message": "Chat API Backend is running"}