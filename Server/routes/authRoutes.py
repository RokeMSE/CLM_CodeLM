from fastapi import APIRouter, Response, status, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from models.authModel import create_user, get_user_by_email
import uuid
import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256" # Hash 256
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    userID: str | None = None
    
class User(BaseModel):
    userID: str
    email: str

class UserInDB(User):
    hashed_password: str
    
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
  
def hash_password(password):
    return pwd_context.hash(password)
  
def create_access_token(data: dict, expires_delta: int | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "access", "random": str(uuid.uuid4())})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: int | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire, "token_type": "refresh", "random": str(uuid.uuid4())})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
  
def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(userID=payload.get("sub"))
    except InvalidTokenError:
        return None

router = APIRouter()
@router.post("/register")
async def register_user_route(res: Response, email: str = Form(...), password: str = Form(...)):
    """
    Register a new user.
    """
    try:
        print("Registering a new user")
        # Check if the email is already registered
        user = await get_user_by_email(email)
        if user:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {"message": "Email already registered"}
        user_id = str(uuid.uuid4())
        password = hash_password(password)
        # print("here is the password", password)
        user_collection = await create_user(user_id, password, email)
        res.status_code = status.HTTP_201_CREATED
        return {"user_id": user_id}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"error": str(e)}
      
@router.post("/login")
async def login_user_route(res: Response, form_data: OAuth2PasswordRequestForm = Form(...)):
    """
    Login a user and return an access token.
    """
    try:
        email = form_data.email
        password = form_data.password
        user = await get_user_by_email(email)
        if not user or not verify_password(password, user["password"]):
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "Invalid credentials"}
        user_id = user["userID"]
        access_tk = create_access_token(data={"sub": user_id})
        refresh_tk = create_refresh_token(data={"sub": access_tk}) # first part supposed to look like the access token, as it is used to refresh the access token
        res.set_cookie(key="access_token", value=access_tk, httponly=True, secure=False, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60)
        res.set_cookie(key="refresh_token", value=refresh_tk, httponly=True, secure=False, samesite="lax", max_age=30*24*60*60) # 30 days
        return {"message": "Login successful"}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"error": str(e)}