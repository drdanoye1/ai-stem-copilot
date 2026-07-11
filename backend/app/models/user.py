import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    parent  = "parent"
    admin   = "admin"


class EducationLevel(str, enum.Enum):
    pre_k          = "pre_k"           # Ages 3–6 (Pre-K / Kindergarten)
    middle_school  = "middle_school"
    high_school    = "high_school"
    ap_ib          = "ap_ib"
    university     = "university"
    graduate       = "graduate"
    professional   = "professional"


class User(Base):
    __tablename__ = "users"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name      = Column(String)
    role           = Column(Enum(UserRole,  name="user_role"),  nullable=False, default=UserRole.student)
    level          = Column(Enum(EducationLevel, name="education_level"), default=EducationLevel.high_school)
    is_active      = Column(Boolean, default=True)
    sessions_count = Column(String, default="0")   # total AI sessions used
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
