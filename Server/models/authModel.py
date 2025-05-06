import datetime
import os
from fastapi import HTTPException
from pymongo import AsyncMongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
mongo_client = AsyncMongoClient(MONGO_URI)
db = mongo_client["CodeLM"]


async def create_user(user_id: str, password: str, email: str):
    """
    Create a new user.
    """
    try:
        user_collection = db["users"]  # Use a separate collection for users
        await user_collection.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "password": password,  # hashed of course
                "created_at": datetime.datetime.utcnow(),
            }
        )
        return user_collection
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")


async def get_user_by_email(email: str):
    """
    Get a user by email.
    """
    try:
        user_collection = db["users"]
        user = await user_collection.find_one({"email": email})
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")


async def get_user_by_id(user_id: str):
    """
    Get a user by ID.
    """
    try:
        user_collection = db["users"]
        user = await user_collection.find_one({"user_id": user_id})
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")
