import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import ChatOllama
from qdrant_client import QdrantClient

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
MODEL_NAME = "gemma3:1b-it-qat"
SYSTEM_INSTRUCTION = os.getenv("SYSTEM_INSTRUCTION")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")
if not QDRANT_URL:
    raise ValueError("QDRANT_URL not found in environment variables.")

try:
    embeddings_model = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",  # Make sure this model name is correct and available
        google_api_key=GEMINI_API_KEY,
    )
    print("Google Generative AI Embeddings model initialized successfully.")
except Exception as e:
    print(f"Error initializing Google Generative AI Embeddings model: {e}")
    embeddings_model = None

try:
    qdrant_client = QdrantClient(
        url=QDRANT_URL, api_key=QDRANT_API_KEY if QDRANT_API_KEY else None, timeout=60
    )
    print("Connected to Qdrant successfully.")
except Exception as e:
    print(
        f"Error initializing Qdrant client or connecting to Qdrant at {QDRANT_URL}: {e}"
    )
    qdrant_client = None

try:
    llm = ChatOllama(model=MODEL_NAME, temperature=0.7)
    print("ChatOllama model initialized successfully.")
except Exception as e:
    print(f"Error initializing ChatOllama model: {e}")
    llm = None

if not all([embeddings_model, qdrant_client, llm]):
    print(
        "Warning: Not all RAG components initialized successfully. RAG features may not work."
    )
