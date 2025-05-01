from fastapi import APIRouter, Cookie, Response, status, Form
from fastapi.security import OAuth2PasswordBearer
from models.authModel import get_user_by_email, get_user_by_id, create_user
import uuid
import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import time

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"  # Hash 256
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str


class TokenData(BaseModel):
    userID: str | None = None
    token_type: str | None = None
    exp: int | None = None
    random: str | None = None


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
    to_encode.update(
        {"exp": expire, "token_type": "access", "random": str(uuid.uuid4())}
    )
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: int | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update(
        {"exp": expire, "token_type": "refresh", "random": str(uuid.uuid4())}
    )
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(
            userID=payload.get("user_id"),
            token_type=payload.get("token_type"),
            exp=payload.get("exp"),
            random=payload.get("random"),
        )
    except InvalidTokenError:
        return None


router = APIRouter()


@router.post("/register")
async def register_user_route(
    res: Response, email: str = Form(...), password: str = Form(...)
):
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
        await create_user(user_id, password, email)
        res.status_code = status.HTTP_201_CREATED
        return {"user_id": user_id}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"error": str(e)}


@router.post("/login")
async def login_user_route(
    res: Response, email: str = Form(...), password: str = Form(...)
):
    """
    Login a user and return an access token.
    """
    try:
        print("Logging in user")
        # Check if the email is registered
        user = await get_user_by_email(email)
        if not user or not verify_password(password, user["password"]):
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "Invalid credentials"}
        user_id = user["user_id"]
        access_tk = create_access_token(data={"user_id": user_id})
        refresh_tk = create_refresh_token(
            data={"user_id": user_id}
        )  # first part supposed to look like the access token, as it is used to refresh the access token
        res.set_cookie(
            key="access_token",
            value=access_tk,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        res.set_cookie(
            key="refresh_token",
            value=refresh_tk,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=30 * 24 * 60 * 60,
        )  # 30 days
        return {"message": "Login successful"}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"message": str(e)}


@router.post("/check_token")
async def check_token_route(
    res: Response, access_token: str = Cookie(None), refresh_token: str = Cookie(None)
):
    """
    Check if the token is valid.
    """
    try:
        print("Checking token")
        if not access_token:
            print(refresh_token)
            if not refresh_token:
                res.status_code = status.HTTP_401_UNAUTHORIZED
                return {"message": "No token provided"}
            else:
                # Decode the refresh token
                payload = decode_access_token(refresh_token)
                if payload is None:
                    res.status_code = status.HTTP_401_UNAUTHORIZED
                    return {"message": "Invalid refresh token"}
                # check if payload userID is existing in the database
                user = await get_user_by_id(payload.userID)
                if not user:
                    res.status_code = status.HTTP_401_UNAUTHORIZED
                    return {"message": "User not found"}
                # Create a new access token
                if payload.token_type == "refresh":
                    print("Refresh token")
                    # Check if the refresh token is valid
                    if payload.exp < time.time():
                        res.status_code = status.HTTP_401_UNAUTHORIZED
                        return {"message": "Refresh token expired"}
                new_access_token = create_access_token(data={"user_id": payload.userID})
                res.set_cookie(
                    key="access_token",
                    value=new_access_token,
                    httponly=True,
                    secure=False,
                    samesite="lax",
                    max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                )
                return {"message": "New access token created"}
        # Decode the access token
        payload = decode_access_token(access_token)
        print(payload)
        if payload is None:
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "Invalid token"}
        if (
            payload.userID is None or get_user_by_id(payload.userID) is None
        ):  # check if the userID is existing in the database
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "User not found"}
        # Check if the token type is access
        if payload.token_type != "access":
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "Invalid token type"}
        # Check if the access token is valid
        print(payload.exp)
        if payload.exp < time.time():
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {"message": "Token expired"}
        return {"message": "Token is valid"}
    except Exception as e:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"message": str(e)}
