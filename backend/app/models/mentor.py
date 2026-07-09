"""
MentorConversation — persists multi-turn Socratic dialogue sessions.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class MentorConversation(Base):
    __tablename__ = "mentor_conversations"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    topic       = Column(String, nullable=False)
    subject     = Column(String, default="algebra")
    level       = Column(String, default="high_school")
    model_name  = Column(String, default="gpt-4o")
    # [{role: "mentor"|"user", content: str}]
    messages    = Column(JSONB, default=list)
    turn_count  = Column(Integer, default=0)
    is_complete = Column(Boolean, default=False)
    # Final "aha" summary revealed on completion
    completion_insight = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(),
                         onupdate=func.now())
