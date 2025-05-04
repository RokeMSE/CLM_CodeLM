import os
import requests
from dotenv import load_dotenv
from supabase import Client, create_client
import fitz

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


async def read_file(file_path: str, bucket_name: str, file_type: str):
    """
    Read a file from Supabase storage and return its content.
    """
    try:
        # Get the public URL for the file
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        if not public_url:
            print(f"Could not generate public URL for {file_path}")
            return None

        # Fetch the file content
        response = requests.get(public_url)
        response.raise_for_status()  # Raise exception for HTTP errors

        # Process based on file type

        # Handle document files that need conversion to markdown
        if file_type == "application/pdf":
            try:
                doc = fitz.open(stream=response.content, filetype="pdf")
                md_text = ""
                for page in doc:
                    md_text += page.get_text("text")
                doc.close()
                return md_text
            except Exception as e:
                print(f"Error converting document to markdown: {e}")
                return None

        # Handle text-based files
        elif file_type in [
            "text/plain",
            "application/json",
            "text/markdown",
        ] or file_type.startswith("text/"):
            return response.text
        else:
            print(f"Unsupported file type: {file_type}")
            return None

    except requests.RequestException as e:
        print(f"Error fetching file from URL: {e}")
        return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None
