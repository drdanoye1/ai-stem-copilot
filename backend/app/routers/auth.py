"""
Auth router — register, login, /me
Identical pattern to Promptivia for easy code sharing.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, EducationLevel

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.student
    level: EducationLevel = EducationLevel.high_school


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str]
    role: str
    level: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    level: str
    sessions_count: str
    created_at: str

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise exc
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _resolve_role(email: str, requested: UserRole) -> UserRole:
    """Force admin role for any address in the ADMIN_EMAILS list."""
    if email.strip().lower() in settings.admin_email_list():
        return UserRole.admin
    return requested


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    role = _resolve_role(req.email, req.role)

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=role,
        level=req.level,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenOut(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        level=user.level.value,
    )


@router.post("/login", response_model=TokenOut)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    return TokenOut(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        level=user.level.value,
    )


@router.post("/token")
async def token(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(str(user.id)), "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        level=current_user.level.value,
        sessions_count=current_user.sessions_count or "0",
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    level: Optional[EducationLevel] = None


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allow authenticated users to update their display name and education level."""
    if req.full_name is not None:
        current_user.full_name = req.full_name.strip() or current_user.full_name
    if req.level is not None:
        current_user.level = req.level
    await db.commit()
    await db.refresh(current_user)
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        level=current_user.level.value,
        sessions_count=current_user.sessions_count or "0",
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )


# ── Google OAuth sync endpoint ────────────────────────────────────────────────

class GoogleOAuthRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    id_token: Optional[str] = None


@router.post("/oauth/google", response_model=TokenOut, status_code=200)
async def oauth_google(req: GoogleOAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Called by NextAuth after a successful Google sign-in.
    Finds an existing user by email or creates a new one (no password needed).
    Returns a backend JWT for use in subsequent API calls.
    """
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user:
        role = _resolve_role(req.email, UserRole.student)
        user = User(
            email=req.email,
            hashed_password=hash_password(req.google_id or "oauth-no-password"),
            full_name=req.full_name or req.email.split("@")[0].title(),
            role=role,
            level=EducationLevel.high_school,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif req.full_name and not user.full_name:
        user.full_name = req.full_name
        await db.commit()
        await db.refresh(user)

    return TokenOut(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        level=user.level.value,
    )


# ── Password reset (JWT-based, no extra DB columns needed) ───────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", status_code=200)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate a password-reset token.
    In production: send this token via email.
    For MVP dev: the token is returned directly in the response.
    Always returns 200 so we don't leak whether an email exists.
    """
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return {"message": "If that email is registered, a reset link will be sent.", "dev_token": None}

    payload = {
        "sub": user.email,
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return {
        "message": "If that email is registered, a reset link will be sent.",
        "dev_token": token,   # ← remove in production; use SMTP/Resend to email this
    }


@router.post("/reset-password", status_code=200)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Verify a password-reset token and update the user's password."""
    try:
        payload = jwt.decode(req.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(400, "Invalid reset token")
        email: str = payload.get("sub", "")
        if not email:
            raise HTTPException(400, "Invalid reset token")
    except JWTError:
        raise HTTPException(400, "Reset token is invalid or has expired")

    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "User not found")

    user.hashed_password = hash_password(req.new_password)
    await db.commit()
    return {"message": "Password updated successfully. You can now log in."}


# ── One-time admin setup ──────────────────────────────────────────────────────

@router.post("/setup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def setup_admin(db: AsyncSession = Depends(get_db)):
    """
    Create the primary admin account the first time the system is deployed.

    - Only works when NO admin account exists yet (safe to call on a cold DB).
    - Email and password are taken from config (ADMIN_EMAILS / ADMIN_PASSWORD).
    - Returns a token so you can immediately log in without a second request.
    - Once an admin exists, this endpoint returns 409 — it becomes a no-op.

    Call once after deploy:
        curl -X POST https://<your-backend>/api/v1/auth/setup
    """
    admin_email = settings.admin_email_list()[0] if settings.admin_email_list() else "admin@aimathcopilot.com"

    # Guard: refuse if any admin already exists
    existing_admin = await db.execute(
        select(User).where(User.role == UserRole.admin)
    )
    if existing_admin.scalar_one_or_none():
        raise HTTPException(409, "Admin account already exists. Use /auth/login instead.")

    # Also guard against duplicate email (edge case)
    existing_email = await db.execute(select(User).where(User.email == admin_email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(409, f"Account {admin_email} already registered.")

    admin = User(
        email=admin_email,
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        full_name="Platform Administrator",
        role=UserRole.admin,
        level="professional",
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    return TokenOut(
        access_token=create_token(str(admin.id)),
        user_id=str(admin.id),
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role.value,
        level=admin.level.value,
    )


@router.post("/promote")
async def promote_to_admin(
    email: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Promote any existing user to admin role.
    Requires an existing admin to be logged in.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(403, "Only admins can promote other users.")

    result = await db.execute(select(User).where(User.email == email))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, f"User {email} not found.")

    target.role = UserRole.admin
    await db.commit()
    return {"message": f"{email} has been promoted to admin.", "role": "admin"}
