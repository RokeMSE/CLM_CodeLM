import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)


def upload(file: bytes, file_name: str, bucket_name: str, notebook_id: str):
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
            return response
        else:
            print(f"Error uploading file: {response.error}")
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None
