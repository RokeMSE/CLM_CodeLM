import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)


async def upload(file: bytes, file_name: str, bucket_name: str, notebook_id: str):
    """
    Upload a file to Supabase storage.
    """
    try:
        # Upload the file
        response = supabase.storage.from_(bucket_name).upload(
            f"{notebook_id}/{file_name}", file
        )
        print(response)
        if response and response.full_path:
            print(f"File {file_name} uploaded successfully.")
            public_url = supabase.storage.from_(bucket_name).get_public_url(
                response.full_path
            )
            return public_url
        else:
            print(f"Error uploading file: {response.error}")
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None


async def delete_file(file_path: str, bucket_name: str):
    """
    Delete a file from Supabase storage.
    """
    try:
        # Delete the file
        response = supabase.storage.from_(bucket_name).remove([file_path])
        if response:
            print(f"File {file_path} deleted successfully.")
            return response
        else:
            print(f"Error deleting file: {response.error}")
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None
