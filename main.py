from __future__ import annotations

import math
import os
import random
import re
import re
import smtplib
import string
import sys
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Annotated, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jwt import encode, decode
from jwt.exceptions import DecodeError as JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("WEAVE_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION_supersecret_key_32chars!!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./weave.db")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Email config ─────────────────────────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Weave")
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))

# ── Economic value of volunteer hour (USD equivalent for India civic work) ──
VOLUNTEER_HOUR_VALUE_INR = float(os.getenv("VOLUNTEER_HOUR_VALUE_INR", "150.0"))
AVG_HOURS_PER_RESOLVED_TASK = float(os.getenv("AVG_HOURS_PER_RESOLVED_TASK", "3.5"))

# ── CORS config ──────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins.strip():
    ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    ALLOW_ORIGIN_REGEX: str | None = None
else:
    ALLOWED_ORIGINS = []
    ALLOW_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"

# ─────────────────────────────────────────────────────────────
# Database setup
# ─────────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────


class UserRole(str, Enum):
    CITIZEN = "citizen"
    VOLUNTEER = "volunteer"
    NGO = "ngo"


class IssueStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class NGOStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ─────────────────────────────────────────────────────────────
# ORM Models
# ─────────────────────────────────────────────────────────────


class UserORM(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default=UserRole.CITIZEN)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    skills = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    total_resolved = Column(Integer, default=0)

    # XP and engagement tracking for volunteer CRM
    xp_points = Column(Integer, default=0)
    last_activity_at = Column(DateTime, nullable=True)
    total_hours_contributed = Column(Float, default=0.0)

    org_name = Column(String(255), nullable=True)
    ngo_status = Column(String(20), nullable=True)
    ngo_document_url = Column(String(512), nullable=True)
    impact_score = Column(Float, default=0.0) # rolling avg of ratings

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String(100), nullable=True)

    issues_reported = relationship(
        "IssueORM", back_populates="reporter", foreign_keys="IssueORM.reporter_id"
    )
    issues_resolved = relationship(
        "IssueORM", back_populates="resolver", foreign_keys="IssueORM.resolver_id"
    )

class NotificationORM(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    desc = Column(Text, nullable=False)
    color = Column(String(50), default="bg-pastel-blue")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EmailOTPORM(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class IssueORM(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)
    status = Column(String(20), default=IssueStatus.OPEN)

    # Priority score: computed by AI triage, stored for persistence
    priority_score = Column(Float, default=0.0)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(512), nullable=True)
    city = Column(String(100), nullable=True)

    image_url = Column(String(512), nullable=True)
    proof_url = Column(String(512), nullable=True)

    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resolver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_ngo_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    reporter = relationship("UserORM", back_populates="issues_reported", foreign_keys=[reporter_id])
    resolver = relationship("UserORM", back_populates="issues_resolved", foreign_keys=[resolver_id])

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    resolved_at = Column(DateTime, nullable=True)
    required_skills = Column(Text, nullable=True)

class Upvote(Base):
    __tablename__ = "upvotes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'issue_id', name='_user_issue_uc'),)
    
class DispatchRequestORM(Base):
    __tablename__ = "dispatch_requests"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, index=True)
    volunteer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), default="PENDING") # PENDING, ACCEPTED, EXPIRED, CANCELLED
    score = Column(Float, nullable=False) # Match score
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)

    issue = relationship("IssueORM")
    volunteer = relationship("UserORM")


class ReviewORM(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, unique=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    volunteer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False) # 1-5
    review_text = Column(Text, nullable=False)
    after_image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    issue = relationship("IssueORM")


class NGOMembershipRequestORM(Base):
    __tablename__ = "ngo_membership_requests"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ngo_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    initiated_by = Column(String(20), nullable=False) # "VOLUNTEER" or "NGO"
    status = Column(String(20), default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint('volunteer_id', 'ngo_id', name='_vol_ngo_uc'),)


Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def hash_otp(otp: str) -> str:
    return pwd_context.hash(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    return pwd_context.verify(plain_otp, hashed_otp)


# ─────────────────────────────────────────────────────────────
# FastAPI app + CORS
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    seed_database()
    yield


app = FastAPI(
    title="Weave Civic Connect API",
    version="1.0.0",
    description="Tri-interface civic problem reporting and resolution platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mount static files and templates for the NGO dashboard
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)


# ─────────────────────────────────────────────────────────────
# Email utilities
# ─────────────────────────────────────────────────────────────


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def send_verification_email(to_email: str, full_name: str, otp: str) -> None:
    if not EMAIL_ENABLED:
        print("\n" + "=" * 60, flush=True)
        print(f"[Weave DEV] OTP for {to_email}", flush=True)
        print(f"  >>> OTP CODE: {otp} <<<  (valid for {OTP_EXPIRE_MINUTES} min)", flush=True)
        print("=" * 60 + "\n", flush=True)
        sys.stdout.flush()
        return

    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Weave] WARN: SMTP not configured. OTP for {to_email}: {otp}", flush=True)
        return

    subject = "Your Weave verification code"
    html_body = f"""
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto;">
        <h1>Welcome to <span style="color: #4f46e5;">Weave</span></h1>
        <p>Hi {full_name}, your verification code is:</p>
        <div style="background: #111; border-radius: 10px; padding: 24px; text-align: center;">
            <span style="font-family: monospace; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #fff;">
                {otp}
            </span>
        </div>
        <p>Expires in {OTP_EXPIRE_MINUTES} minutes.</p>
    </div>
    """
    text_body = f"Hi {full_name},\n\nYour Weave verification code is: {otp}\n\nExpires in {OTP_EXPIRE_MINUTES} minutes."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
    except Exception as exc:
        print(f"[Weave] SMTP error: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to send verification email. ({exc})")


def create_and_store_otp(user_id: int, email: str, db: Session) -> str:
    existing = db.query(EmailOTPORM).filter(
        EmailOTPORM.user_id == user_id,
        EmailOTPORM.used == False,
    ).all()
    for otp_row in existing:
        otp_row.used = True

    plain_otp = generate_otp()
    otp_row = EmailOTPORM(
        user_id=user_id,
        email=email,
        otp_hash=hash_otp(plain_otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    db.add(otp_row)
    db.commit()
    return plain_otp


# ─────────────────────────────────────────────────────────────
# ██████████████████████████████████████████████████████████
# AI TRIAGE ENGINE  (zero external ML deps — pure Python NLP)
# ██████████████████████████████████████████████████████████
# ─────────────────────────────────────────────────────────────

# Urgency lexicon: keyword → weight multiplier
_URGENCY_LEXICON: dict[str, float] = {
    # Life/safety critical
    "injury": 3.0, "injured": 3.0, "dead": 3.5, "death": 3.5, "accident": 2.8,
    "bleeding": 3.2, "fire": 3.5, "gas leak": 3.5, "electrocution": 3.5,
    "collapse": 3.2, "flood": 2.9, "flooding": 2.9, "overflow": 2.2,
    "dangerous": 2.5, "hazardous": 2.5, "unsafe": 2.3, "emergency": 3.0,
    "urgent": 2.5, "critical": 2.7, "immediate": 2.4, "severe": 2.3,
    # Infrastructure
    "broken": 1.8, "damaged": 1.7, "blocked": 1.9, "clogged": 1.8,
    "pothole": 1.6, "sewage": 2.1, "stench": 1.9, "smell": 1.5,
    "dark": 1.7, "no light": 2.0, "no water": 2.2, "power cut": 2.0,
    # Time signals
    "days": 1.4, "weeks": 1.7, "month": 2.0, "months": 2.2, "years": 2.5,
    # Crowd/scale
    "many": 1.3, "everyone": 1.5, "whole": 1.4, "entire": 1.5,
    "children": 2.0, "elderly": 2.0, "school": 2.0, "hospital": 2.5,
}

# Category base urgency (pre-seeded civic knowledge)
_CATEGORY_BASE: dict[str, float] = {
    "Animal Rescue": 0.55,
    "Electrical": 0.65,
    "Flooding": 0.80,
    "Road Repair": 0.50,
    "Sanitation": 0.60,
    "Water Supply": 0.70,
    "Fire Hazard": 0.90,
    "Gas Leak": 0.95,
    "Medical": 0.85,
    "Tree Fall": 0.75,
    "Noise Pollution": 0.30,
    "Illegal Construction": 0.40,
    "Encroachment": 0.35,
}


def compute_urgency_score(
    title: str,
    description: str,
    category: str,
    created_at: datetime,
    status: str,
) -> float:
    """
    Returns a normalized urgency score [0.0, 1.0].

    Algorithm (inverted-pyramid weighted):
      1. Category base score         → 25%
      2. NLP keyword scan            → 40%
      3. Age decay (older = more urgent if unresolved) → 20%
      4. Status signal               → 15%
    """
    # 1. Category base
    cat_score = _CATEGORY_BASE.get(category, 0.45)

    # 2. NLP keyword scan on title + description
    text = f"{title} {description}".lower()
    # Tokenize: split on non-alphanumeric, also check bigrams
    tokens = re.findall(r"\b\w+\b", text)
    bigrams = [f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens) - 1)]
    all_terms = tokens + bigrams

    keyword_hits: list[float] = []
    for term in all_terms:
        if term in _URGENCY_LEXICON:
            keyword_hits.append(_URGENCY_LEXICON[term])

    if keyword_hits:
        # Use top-3 weighted average (diminishing returns)
        keyword_hits.sort(reverse=True)
        top = keyword_hits[:3]
        nlp_raw = sum(w * (0.6 ** i) for i, w in enumerate(top))
        # Normalize: max possible ≈ 3.5 + 3.5*0.6 + 3.5*0.36 ≈ 8.26
        nlp_score = min(nlp_raw / 8.26, 1.0)
    else:
        nlp_score = 0.2  # neutral baseline

    # 3. Age decay — unresolved issues grow more urgent over time
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = max((now - created_at).total_seconds() / 3600, 0)
    # Logarithmic growth: saturates at ~720h (30 days)
    age_score = min(math.log1p(age_hours) / math.log1p(720), 1.0)

    # 4. Status signal
    status_weights = {
        IssueStatus.OPEN: 1.0,
        IssueStatus.IN_PROGRESS: 0.5,
        IssueStatus.RESOLVED: 0.0,
    }
    status_score = status_weights.get(status, 0.5)

    final = (
        cat_score * 0.25
        + nlp_score * 0.40
        + age_score * 0.20
        + status_score * 0.15
    )
    return round(min(max(final, 0.0), 1.0), 4)


def get_urgency_label(score: float) -> str:
    if score >= 0.75:
        return "CRITICAL"
    elif score >= 0.55:
        return "HIGH"
    elif score >= 0.35:
        return "MEDIUM"
    return "LOW"


# ─────────────────────────────────────────────────────────────
# ██████████████████████████████████████████████████████████
# VOLUNTEER CHURN RISK ENGINE (engagement velocity model)
# ██████████████████████████████████████████████████████████
# ─────────────────────────────────────────────────────────────


def compute_churn_risk(volunteer: UserORM) -> dict:
    """
    Returns churn risk score [0.0, 1.0] and label.

    Engagement velocity model:
      - Days since last activity (recency)
      - Resolved tasks trend (frequency)
      - XP accumulation rate
      - Account age normalization
    """
    now = datetime.now(timezone.utc)

    created_at = volunteer.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    account_age_days = max((now - created_at).total_seconds() / 86400, 1) if created_at else 30

    # Recency score — penalizes long gaps
    last_active = volunteer.last_activity_at
    if last_active:
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)
        days_since_active = (now - last_active).total_seconds() / 86400
    else:
        # Never active beyond account creation → high churn signal
        days_since_active = account_age_days

    # Recency risk: 0 = very active, 1 = totally inactive
    recency_risk = min(days_since_active / 60, 1.0)  # 60 days = full churn

    # Frequency score — total resolved vs account age
    total_resolved = volunteer.total_resolved or 0
    expected_resolved = account_age_days / 14  # expect ~2 tasks/month baseline
    frequency_ratio = total_resolved / max(expected_resolved, 1)
    frequency_risk = max(0.0, 1.0 - min(frequency_ratio, 1.0))

    # XP risk — low XP relative to account age
    xp = volunteer.xp_points or 0
    expected_xp = account_age_days * 5  # 5 XP/day baseline
    xp_ratio = xp / max(expected_xp, 1)
    xp_risk = max(0.0, 1.0 - min(xp_ratio, 1.0))

    # Weighted composite
    churn_score = (
        recency_risk * 0.50
        + frequency_risk * 0.30
        + xp_risk * 0.20
    )
    churn_score = round(min(max(churn_score, 0.0), 1.0), 4)

    if churn_score >= 0.70:
        label = "HIGH RISK"
    elif churn_score >= 0.40:
        label = "AT RISK"
    else:
        label = "HEALTHY"

    # XP tier
    if xp >= 500:
        xp_tier = "GOLD"
    elif xp >= 200:
        xp_tier = "SILVER"
    elif xp >= 50:
        xp_tier = "BRONZE"
    else:
        xp_tier = "RECRUIT"

    return {
        "churn_score": churn_score,
        "churn_label": label,
        "recency_risk": round(recency_risk, 3),
        "frequency_risk": round(frequency_risk, 3),
        "xp_risk": round(xp_risk, 3),
        "xp_tier": xp_tier,
        "days_since_active": round(days_since_active, 1),
    }


# ─────────────────────────────────────────────────────────────
# Startup seed
# ─────────────────────────────────────────────────────────────

_CITIES_BHUBANESWAR = [
    ("Patia", 20.3533, 85.8265),
    ("Sahid Nagar", 20.2892, 85.8433),
    ("Khandagiri", 20.2604, 85.7861),
    ("Jayadev Vihar", 20.3050, 85.8200),
    ("Nayapalli", 20.2960, 85.8050),
    ("Old Town", 20.2345, 85.8300),
    ("Unit 9", 20.2850, 85.8250),
    ("Chandrasekharpur", 20.3250, 85.8150),
]

_CATEGORIES = [
    "Sanitation", "Road Repair", "Electrical", "Water Supply",
    "Flooding", "Animal Rescue", "Tree Fall", "Noise Pollution",
    "Illegal Construction", "Encroachment", "Fire Hazard",
]

_ISSUE_TEMPLATES = [
    ("Overflowing garbage near {loc}", "Pile of garbage uncleared for {n} days, attracting stray animals and spreading disease."),
    ("Broken streetlight on {loc}", "Streetlight has been out for {n} weeks. Residents fear crime and accidents at night."),
    ("Dangerous pothole at {loc}", "Large pothole causing accidents to two-wheelers near the school entrance."),
    ("Stray dog injured at {loc}", "Injured stray dog limping, needs urgent rescue and veterinary care."),
    ("Sewage overflow on {loc}", "Raw sewage overflowing onto road for {n} days. Unbearable stench and health hazard."),
    ("Flooded underpass at {loc}", "Underpass completely submerged. Vehicles and pedestrians unable to pass."),
    ("Illegal dumping at {loc}", "Contractor dumping construction debris on public road for {n} weeks."),
    ("Water supply disrupted in {loc}", "No water supply for {n} days. Residents struggling severely."),
    ("Tree fallen on {loc}", "Large tree blocking road and power lines after last night's storm."),
    ("Encroachment on footpath {loc}", "Shopkeeper has permanently blocked footpath forcing pedestrians onto road."),
    ("Gas leak smell near {loc}", "Strong gas smell reported by multiple residents. Potential explosion risk."),
    ("Open manhole at {loc}", "Manhole cover missing for {n} days. Extremely dangerous at night."),
]

_SKILLS_POOL = [
    "Waste Management", "Sanitation", "Community Outreach",
    "Road Repair", "Construction", "Electrical", "Plumbing",
    "Animal Rescue", "Healthcare", "First Aid", "Counselling",
    "Legal Aid", "Environmental Management", "Water Management",
]

_VOLUNTEER_NAMES = [
    ("Ravi Kumar", "ravi@example.com"),
    ("Priya Shah", "priya@example.com"),
    ("Arjun Nair", "arjun@example.com"),
    ("Meera Joshi", "meera@example.com"),
    ("Suresh Patil", "suresh@example.com"),
    ("Kavya Iyer", "kavya@example.com"),
    ("Deepak Reddy", "deepak@example.com"),
    ("Ananya Singh", "ananya@example.com"),
]


def seed_database():
    db = SessionLocal()
    try:
        if db.query(UserORM).count() > 0:
            return

        now = datetime.now(timezone.utc)

        # ── Citizens ──────────────────────────────────────────
        citizen1 = UserORM(
            email="anjali@example.com",
            hashed_password=hash_password("password123"),
            full_name="Anjali Mehta",
            role=UserRole.CITIZEN,
            is_email_verified=True,
            latitude=20.2721, longitude=85.8338, city="Bhubaneswar", # Unit 2 Area
            created_at=now - timedelta(days=90),
        )
        citizen2 = UserORM(
            email="rahul@example.com",
            hashed_password=hash_password("password123"),
            full_name="Rahul Bose",
            role=UserRole.CITIZEN,
            is_email_verified=True,
            latitude=20.2850, longitude=85.8500, city="Bhubaneswar", # Laxmi Sagar
            created_at=now - timedelta(days=60),
        )

        # ── Volunteers (rich engagement data) ─────────────────
        volunteers_data = [
            {
                "name": "Ravi Kumar", "email": "ravi@example.com",
                "skills": "Waste Management,Sanitation,Community Outreach",
                "bio": "Field lead with 3 years of civic volunteering.",
                "total_resolved": 28,
                "xp_points": 840,
                "last_activity_days_ago": 2,
                "account_age_days": 180,
                "lat": 20.2892, "lng": 85.8433, # Sahid Nagar
            },
            {
                "name": "Priya Shah", "email": "priya@example.com",
                "skills": "Road Repair,Construction",
                "bio": "Civil engineer volunteering on weekends.",
                "total_resolved": 14,
                "xp_points": 420,
                "last_activity_days_ago": 8,
                "account_age_days": 120,
                "lat": 20.3533, "lng": 85.8265, # Patia
            },
            {
                "name": "Arjun Nair", "email": "arjun@example.com",
                "skills": "Electrical,Plumbing",
                "bio": "Electrician helping with civic infrastructure.",
                "total_resolved": 9,
                "xp_points": 270,
                "last_activity_days_ago": 25,
                "account_age_days": 90,
                "lat": 20.2960, "lng": 85.8050, # Nayapalli
            },
            {
                "name": "Meera Joshi", "email": "meera@example.com",
                "skills": "Animal Rescue,Healthcare,First Aid",
                "bio": "Veterinary nurse and animal welfare activist.",
                "total_resolved": 31,
                "xp_points": 930,
                "last_activity_days_ago": 1,
                "account_age_days": 200,
                "lat": 20.2604, "lng": 85.7861, # Khandagiri
            },
            {
                "name": "Suresh Patil", "email": "suresh@example.com",
                "skills": "Community Outreach,Legal Aid",
                "bio": "Retired government officer supporting local governance.",
                "total_resolved": 6,
                "xp_points": 180,
                "last_activity_days_ago": 45,
                "account_age_days": 150,
                "lat": 20.3050, "lng": 85.8200, # Jayadev Vihar
            },
            {
                "name": "Kavya Iyer", "email": "kavya@example.com",
                "skills": "Environmental Management,Water Management,Sanitation",
                "bio": "Environmental science graduate.",
                "total_resolved": 19,
                "xp_points": 570,
                "last_activity_days_ago": 5,
                "account_age_days": 130,
                "lat": 20.3250, "lng": 85.8150, # Chandrasekharpur
            },
            {
                "name": "Deepak Reddy", "email": "deepak@example.com",
                "skills": "Road Repair,Construction,Community Outreach",
                "bio": "Construction supervisor volunteering on infrastructure.",
                "total_resolved": 3,
                "xp_points": 90,
                "last_activity_days_ago": 60,
                "account_age_days": 75,
                "lat": 20.2450, "lng": 85.7750, # Dumduma
            },
            {
                "name": "Ananya Singh", "email": "ananya@example.com",
                "skills": "Counselling,Community Outreach,First Aid",
                "bio": "Social worker and youth coordinator.",
                "total_resolved": 22,
                "xp_points": 660,
                "last_activity_days_ago": 3,
                "account_age_days": 160,
                "lat": 20.2750, "lng": 85.8650, # Jharapada
            },
        ]

        volunteer_objs = []
        for vd in volunteers_data:
            v = UserORM(
                email=vd["email"],
                hashed_password=hash_password("password123"),
                full_name=vd["name"],
                role=UserRole.VOLUNTEER,
                is_email_verified=True,
                skills=vd["skills"],
                bio=vd["bio"],
                total_resolved=vd["total_resolved"],
                impact_score=round(random.uniform(4.1, 4.9), 1),
                xp_points=vd["xp_points"],
                last_activity_at=now - timedelta(days=vd["last_activity_days_ago"]),
                total_hours_contributed=round(vd["total_resolved"] * AVG_HOURS_PER_RESOLVED_TASK, 1),
                is_active=True,
                latitude=vd["lat"],
                longitude=vd["lng"],
                city="Bhubaneswar",
                created_at=now - timedelta(days=vd["account_age_days"]),
            )
            volunteer_objs.append(v)

        # ── NGO ───────────────────────────────────────────────
        ngo1 = UserORM(
            email="sara@greenbbsr.org",
            hashed_password=hash_password("password123"),
            full_name="Sara Khan",
            role=UserRole.NGO,
            is_email_verified=True,
            org_name="Green Bhubaneswar Collective",
            ngo_status=NGOStatus.APPROVED,
            latitude=20.2950, longitude=85.8400, city="Bhubaneswar", # Near Vani Vihar
            created_at=now - timedelta(days=365),
        )

        db.add_all([citizen1, citizen2] + volunteer_objs + [ngo1])
        db.flush()

        all_demo_users = [citizen1, citizen2, ngo1] + volunteer_objs
        for user in all_demo_users:
            db.add_all([
                NotificationORM(
                    user_id=user.id, 
                    title="Welcome to Weave", 
                    desc="Start reporting or resolving issues in Bhubaneswar!", 
                    color="bg-pastel-green"
                ),
                NotificationORM(
                    user_id=user.id, 
                    title="Bhubaneswar Hub Active", 
                    desc="New issues found in Patia and Sahid Nagar.", 
                    color="bg-pastel-blue"
                )
            ])    

        # ── Issues (rich spread across Bhubaneswar) ──────────────────
        random.seed(42)
        issues = []
        statuses = [IssueStatus.OPEN, IssueStatus.IN_PROGRESS, IssueStatus.RESOLVED]
        status_weights = [0.5, 0.3, 0.2]

        for i, (loc_name, lat, lng) in enumerate(_CITIES_BHUBANESWAR):
            n_issues = random.randint(2, 5)
            for j in range(n_issues):
                tpl_title, tpl_desc = random.choice(_ISSUE_TEMPLATES)
                category = random.choice(_CATEGORIES)
                n_days = random.randint(1, 14)
                title = tpl_title.format(loc=loc_name)
                desc = tpl_desc.format(n=n_days, loc=loc_name)

                jitter_lat = lat + random.uniform(-0.008, 0.008)
                jitter_lng = lng + random.uniform(-0.008, 0.008)

                chosen_status = random.choices(statuses, weights=status_weights)[0]
                created_days_ago = random.randint(1, 45)
                created = now - timedelta(days=created_days_ago)

                resolver = random.choice(volunteer_objs) if chosen_status != IssueStatus.OPEN else None
                resolved_at = created + timedelta(days=random.randint(1, 7)) if chosen_status == IssueStatus.RESOLVED else None

                priority = compute_urgency_score(title, desc, category, created, chosen_status)

                issue = IssueORM(
                    title=title,
                    description=desc,
                    category=category,
                    required_skills=random.choice(_SKILLS_POOL),
                    latitude=jitter_lat,
                    longitude=jitter_lng,
                    address=f"{loc_name}, Bhubaneswar",
                    city="Bhubaneswar",
                    status=chosen_status,
                    reporter_id=random.choice([citizen1.id, citizen2.id]),
                    resolver_id=resolver.id if resolver else None,
                    assigned_ngo_id=ngo1.id if random.random() > 0.4 else None,
                    created_at=created,
                    updated_at=created + timedelta(hours=random.randint(1, 48)),
                    resolved_at=resolved_at,
                    priority_score=priority,
                )
                issues.append(issue)

        db.add_all(issues)
        db.commit()
        print(f"[Weave] Database seeded: {len(issues)} issues, {len(volunteer_objs)} volunteers.", flush=True)
    except Exception as e:
        db.rollback()
        print(f"[Weave] Seed failed: {e}", flush=True)
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Auth utilities
# ─────────────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode["exp"] = expire
    return encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ─────────────────────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────────────────────


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DB = Annotated[Session, Depends(get_db)]


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DB) -> UserORM:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exc
    except Exception as exc:
        # Covers ExpiredSignatureError, DecodeError, and any other JWT issue
        if "expired" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise credentials_exc

    user = db.query(UserORM).filter(UserORM.email == email).first()
    if user is None:
        raise credentials_exc
    return user


CurrentUser = Annotated[UserORM, Depends(get_current_user)]


# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole = UserRole.CITIZEN
    skills: Optional[str] = None
    bio: Optional[str] = None
    org_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str
    email: str
    is_email_verified: bool = False


class VerifyEmailRequest(BaseModel):
    email: str
    otp: str


class ResendOtpRequest(BaseModel):
    email: str


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    uid: str
    email: str
    full_name: str
    role: str
    is_email_verified: bool
    skills: Optional[str] = None
    bio: Optional[str] = None
    org_name: Optional[str] = None
    ngo_status: Optional[str] = None
    total_resolved: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None


class IssueCreate(BaseModel):
    title: str
    description: str
    category: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    city: Optional[str] = None
    required_skills: Optional[str] = None


class IssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    uid: str
    title: str
    description: str
    category: str
    status: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    city: Optional[str] = None
    image_url: Optional[str] = None
    proof_url: Optional[str] = None
    reporter_id: int
    reporter_name: Optional[str] = None
    resolver_id: Optional[int] = None
    resolver_name: Optional[str] = None
    assigned_ngo_id: Optional[int] = None
    required_skills: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None


class VolunteerMatchResponse(BaseModel):
    issue: IssueResponse
    distance_km: float
    skill_match_score: float


class NGOMemberStats(BaseModel):
    volunteer_id: int
    volunteer_name: str
    total_resolved: int
    skills: Optional[str] = None
    impact_score: float = 0.0

class DispatchRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    issue_id: int
    volunteer_id: int
    status: str
    score: float
    created_at: datetime
    expires_at: datetime
    issue: IssueResponse

class ReviewCreate(BaseModel):
    rating: int
    review_text: str

class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    issue_id: int
    reviewer_id: int
    volunteer_id: int
    rating: int
    review_text: str
    after_image_url: Optional[str] = None
    created_at: datetime

class NGOMembershipRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    volunteer_id: int
    volunteer_name: str
    ngo_id: int
    ngo_name: str
    initiated_by: str
    status: str
    created_at: datetime


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def skill_match_score(volunteer_skills: str | None, issue_skills: str | None) -> float:
    if not volunteer_skills or not issue_skills:
        return 0.5
    v = {s.strip().lower() for s in volunteer_skills.split(",")}
    i = {s.strip().lower() for s in issue_skills.split(",")}
    return len(v & i) / len(i) if i else 0.5


def issue_to_response(issue: IssueORM) -> IssueResponse:
    return IssueResponse(
        id=issue.id,
        uid=issue.uid,
        title=issue.title,
        description=issue.description,
        category=issue.category,
        status=issue.status,
        latitude=issue.latitude,
        longitude=issue.longitude,
        address=issue.address,
        city=issue.city,
        image_url=issue.image_url,
        proof_url=issue.proof_url,
        reporter_id=issue.reporter_id,
        reporter_name=issue.reporter.full_name if issue.reporter else None,
        resolver_id=issue.resolver_id,
        resolver_name=issue.resolver.full_name if issue.resolver else None,
        assigned_ngo_id=issue.assigned_ngo_id,
        required_skills=issue.required_skills,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        resolved_at=issue.resolved_at,
    )


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/auth
# ═══════════════════════════════════════════════════════════════


@app.post("/api/auth/register", response_model=TokenResponse, tags=["Auth"])
def register(body: RegisterRequest, db: DB):
    existing = db.query(UserORM).filter(UserORM.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserORM(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        skills=body.skills,
        bio=body.bio,
        org_name=body.org_name,
        latitude=body.latitude,
        longitude=body.longitude,
        city=body.city,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    plain_otp = create_and_store_otp(user.id, user.email, db)
    send_verification_email(user.email, user.full_name, plain_otp)

    access_token = create_access_token(data={"sub": user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
        is_email_verified=False,
    )


@app.post("/api/auth/verify-email", tags=["Auth"])
def verify_email(body: VerifyEmailRequest, db: DB):
    user = db.query(UserORM).filter(UserORM.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        return {"detail": "Email already verified."}

    otp_row = (
        db.query(EmailOTPORM)
        .filter(EmailOTPORM.user_id == user.id, EmailOTPORM.used == False)
        .order_by(EmailOTPORM.created_at.desc())
        .first()
    )

    if not otp_row:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new one.")

    now = datetime.now(timezone.utc)
    expires_at = otp_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        otp_row.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired. Please request a new one.")

    if not verify_otp(body.otp, otp_row.otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    otp_row.used = True
    user.is_email_verified = True
    db.commit()

    return {"detail": "Email verified successfully."}


@app.post("/api/auth/resend-otp", tags=["Auth"])
def resend_otp(body: ResendOtpRequest, db: DB):
    user = db.query(UserORM).filter(UserORM.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

    plain_otp = create_and_store_otp(user.id, user.email, db)
    send_verification_email(user.email, user.full_name, plain_otp)

    return {"detail": f"A new verification code has been sent to {body.email}."}


@app.post("/api/auth/token", response_model=TokenResponse, tags=["Auth"])
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    user = db.query(UserORM).filter(UserORM.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token({"sub": user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
        is_email_verified=user.is_email_verified,
    )


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Auth"])
def login_json(body: LoginRequest, db: DB):
    user = db.query(UserORM).filter(UserORM.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token({"sub": user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
        is_email_verified=user.is_email_verified,
    )


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/users
# ═══════════════════════════════════════════════════════════════


@app.get("/api/users/me", response_model=UserProfile, tags=["Users"])
def get_my_profile(current_user: CurrentUser):
    return current_user


@app.patch("/api/users/me", response_model=UserProfile, tags=["Users"])
def update_my_profile(body: UpdateProfileRequest, current_user: CurrentUser, db: DB):
    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/users/{user_id}", response_model=UserProfile, tags=["Users"])
def get_user_profile(user_id: int, db: DB):
    user = db.query(UserORM).filter(UserORM.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/issues
# ═══════════════════════════════════════════════════════════════


@app.post("/api/issues", response_model=IssueResponse, status_code=201, tags=["Issues"])
def create_issue(body: IssueCreate, current_user: CurrentUser, db: DB):
    issue = IssueORM(
        title=body.title,
        description=body.description,
        category=body.category,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        city=body.city,
        required_skills=body.required_skills,
        reporter_id=current_user.id,
        status=IssueStatus.OPEN,
    )
    # Compute AI priority score at creation time
    issue.priority_score = compute_urgency_score(
        body.title, body.description, body.category,
        datetime.now(timezone.utc), IssueStatus.OPEN,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@app.post("/api/issues/{issue_id}/image", response_model=IssueResponse, tags=["Issues"])
async def upload_issue_image(
    issue_id: int,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reporter can upload images.")

    ext = os.path.splitext(file.filename or "")[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(await file.read())

    issue.image_url = f"/uploads/{filename}"
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@app.get("/api/issues", response_model=list[IssueResponse], tags=["Issues"])
def list_issues(
    db: DB,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    reporter_id: Optional[int] = Query(None),
    resolver_id: Optional[int] = Query(None),
    assigned_ngo_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
):
    q = db.query(IssueORM)
    if status:
        q = q.filter(IssueORM.status == status)
    if category:
        q = q.filter(IssueORM.category == category)
    if reporter_id:
        q = q.filter(IssueORM.reporter_id == reporter_id)
    if resolver_id:
        q = q.filter(IssueORM.resolver_id == resolver_id)
    if assigned_ngo_id:
        q = q.filter(IssueORM.assigned_ngo_id == assigned_ngo_id)
    if city:
        q = q.filter(func.lower(IssueORM.city).contains(city.lower()))

    issues = q.order_by(IssueORM.created_at.desc()).offset(skip).limit(limit).all()
    return [issue_to_response(i) for i in issues]


@app.get("/api/issues/{issue_id}", response_model=IssueResponse, tags=["Issues"])
def get_issue(issue_id: int, db: DB):
    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    return issue_to_response(issue)


@app.patch("/api/issues/{issue_id}/claim", response_model=IssueResponse, tags=["Issues"])
def claim_issue(issue_id: int, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can claim issues.")

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if issue.status != IssueStatus.OPEN:
        raise HTTPException(status_code=400, detail="Issue is not open.")

    issue.status = IssueStatus.IN_PROGRESS
    issue.resolver_id = current_user.id
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@app.patch("/api/issues/{issue_id}/resolve", response_model=IssueResponse, tags=["Issues"])
async def resolve_issue(
    issue_id: int,
    db: DB,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    proof: Optional[UploadFile] = File(None),
):
    if current_user.role not in (UserRole.VOLUNTEER, UserRole.NGO):
        raise HTTPException(status_code=403, detail="Only volunteers or NGOs can resolve issues.")

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if issue.status == IssueStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Issue is already resolved.")

    if proof:
        ext = os.path.splitext(proof.filename or "")[1]
        filename = f"proof_{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(await proof.read())
        issue.proof_url = f"/uploads/{filename}"

    issue.status = IssueStatus.RESOLVED
    issue.resolver_id = current_user.id
    issue.resolved_at = datetime.now(timezone.utc)
    current_user.total_resolved = (current_user.total_resolved or 0) + 1

    # Award XP to volunteer resolver
    if current_user.role == UserRole.VOLUNTEER:
        current_user.xp_points = (current_user.xp_points or 0) + 30
        current_user.total_hours_contributed = (current_user.total_hours_contributed or 0) + AVG_HOURS_PER_RESOLVED_TASK
        current_user.last_activity_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)
@app.post("/api/issues/{issue_id}/upvote", status_code=201, tags=["Issues"])
def upvote_issue(
    issue_id: int, 
    db: DB, 
    current_user: CurrentUser
):
#  Allows a citizen or volunteer to upvote/endorse an issue.
# A user can only upvote a specific issue once.

    # 1. Check if the issue actually exists
    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    # 2. Check if this user has already upvoted this specific issue
    existing_upvote = db.query(Upvote).filter(
        Upvote.issue_id == issue_id, 
        Upvote.user_id == current_user.id
    ).first()
    
    if existing_upvote:
        raise HTTPException(status_code=400, detail="You have already upvoted this issue")
        
    # 3. Save the new upvote
    new_upvote = Upvote(user_id=current_user.id, issue_id=issue_id)
    db.add(new_upvote)
    db.commit()
    
    # 4. Return the new total count so the frontend can update instantly
    total_upvotes = db.query(Upvote).filter(Upvote.issue_id == issue_id).count()
    
    return {
        "message": "Upvote added successfully", 
        "issue_id": issue_id,
        "total_upvotes": total_upvotes
    }

@app.post("/api/issues/{issue_id}/dispatch", tags=["Dispatch"])
def dispatch_issue(issue_id: int, current_user: CurrentUser, db: DB, limit: int = 5):
    """Broadcasts an issue to top matching volunteers (race condition model)."""
    if current_user.role not in (UserRole.NGO, UserRole.CITIZEN):
        # In a real app, maybe only system/NGO triggers this. For demo, citizen can too.
        pass

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if issue.status != IssueStatus.OPEN:
        raise HTTPException(status_code=400, detail="Issue is not open.")

    # Cancel any existing pending dispatches for this issue
    db.query(DispatchRequestORM).filter(
        DispatchRequestORM.issue_id == issue_id,
        DispatchRequestORM.status == "PENDING"
    ).update({"status": "CANCELLED"})

    # Find volunteers
    volunteers = db.query(UserORM).filter(
        UserORM.role == UserRole.VOLUNTEER,
        UserORM.is_active == True,
        UserORM.latitude.isnot(None),
        UserORM.longitude.isnot(None)
    ).all()

    scored_vols = []
    for vol in volunteers:
        # Distance (max radius say 25km for scoring)
        dist = haversine_km(issue.latitude, issue.longitude, vol.latitude, vol.longitude)
        if dist > 50: # Hard cutoff
            continue
        dist_norm = max(0, 1.0 - (dist / 25.0))
        
        # Skills
        s_match = skill_match_score(vol.skills, issue.required_skills)
        
        # Experience (cap at 50)
        exp_norm = min((vol.total_resolved or 0) / 50.0, 1.0)
        
        # Impact (rating is 1-5, normalize to 0-1)
        impact_norm = ((vol.impact_score or 3.0) - 1) / 4.0

        score = (s_match * 0.4) + (exp_norm * 0.2) + (dist_norm * 0.2) + (impact_norm * 0.2)
        scored_vols.append((score, vol))

    scored_vols.sort(key=lambda x: x[0], reverse=True)
    top_vols = scored_vols[:limit]

    if not top_vols:
        raise HTTPException(status_code=404, detail="No eligible volunteers found nearby.")

    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    dispatches = []
    for score, vol in top_vols:
        d = DispatchRequestORM(
            issue_id=issue_id,
            volunteer_id=vol.id,
            score=score,
            expires_at=expires,
            status="PENDING"
        )
        db.add(d)
        dispatches.append(d)

    db.commit()
    return {"message": f"Dispatched to {len(dispatches)} volunteers"}

@app.get("/api/volunteer/dispatch/pending", response_model=list[DispatchRequestResponse], tags=["Dispatch"])
def get_pending_dispatches(current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers.")

    now = datetime.now(timezone.utc)
    
    # Auto-expire old ones
    db.query(DispatchRequestORM).filter(
        DispatchRequestORM.status == "PENDING",
        DispatchRequestORM.expires_at < now
    ).update({"status": "EXPIRED"})
    db.commit()

    dispatches = db.query(DispatchRequestORM).filter(
        DispatchRequestORM.volunteer_id == current_user.id,
        DispatchRequestORM.status == "PENDING"
    ).all()

    # Build response manually to include issue_to_response
    res = []
    for d in dispatches:
        res.append(DispatchRequestResponse(
            id=d.id,
            issue_id=d.issue_id,
            volunteer_id=d.volunteer_id,
            status=d.status,
            score=d.score,
            created_at=d.created_at,
            expires_at=d.expires_at,
            issue=issue_to_response(d.issue)
        ))
    return res

@app.post("/api/volunteer/dispatch/{dispatch_id}/accept", tags=["Dispatch"])
def accept_dispatch(dispatch_id: int, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers.")

    dispatch = db.query(DispatchRequestORM).filter(
        DispatchRequestORM.id == dispatch_id,
        DispatchRequestORM.volunteer_id == current_user.id
    ).first()

    if not dispatch or dispatch.status != "PENDING":
        raise HTTPException(status_code=400, detail="Dispatch no longer available.")

    # Check if issue is already claimed (race condition check)
    issue = db.query(IssueORM).filter(IssueORM.id == dispatch.issue_id).first()
    if issue.status != IssueStatus.OPEN:
        # Someone else got it!
        dispatch.status = "CANCELLED"
        db.commit()
        raise HTTPException(status_code=400, detail="Issue was already claimed by another volunteer.")

    # Accept it
    dispatch.status = "ACCEPTED"
    issue.status = IssueStatus.IN_PROGRESS
    issue.resolver_id = current_user.id

    # Cancel other pending dispatches for this issue
    db.query(DispatchRequestORM).filter(
        DispatchRequestORM.issue_id == issue.id,
        DispatchRequestORM.id != dispatch.id,
        DispatchRequestORM.status == "PENDING"
    ).update({"status": "CANCELLED"})

    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)

@app.get("/api/volunteer/active-issue", response_model=Optional[IssueResponse], tags=["Dispatch"])
def get_active_issue(current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers.")

    issue = db.query(IssueORM).filter(
        IssueORM.resolver_id == current_user.id,
        IssueORM.status == IssueStatus.IN_PROGRESS
    ).first()

    if not issue:
        return None
    return issue_to_response(issue)

@app.post("/api/issues/{issue_id}/review", response_model=ReviewResponse, tags=["Reviews"])
async def submit_review(
    issue_id: int,
    db: DB,
    current_user: CurrentUser,
    rating: int = Form(...),
    review_text: str = Form(...),
    after_image: Optional[UploadFile] = File(None)
):
    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only reporter can review.")
    if issue.status != IssueStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Issue must be resolved first.")
    if not issue.resolver_id:
        raise HTTPException(status_code=400, detail="No volunteer to review.")
    
    existing = db.query(ReviewORM).filter(ReviewORM.issue_id == issue_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Review already submitted.")

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5.")

    img_url = None
    if after_image:
        ext = os.path.splitext(after_image.filename or "")[1]
        filename = f"after_{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(await after_image.read())
        img_url = f"/uploads/{filename}"

    review = ReviewORM(
        issue_id=issue_id,
        reviewer_id=current_user.id,
        volunteer_id=issue.resolver_id,
        rating=rating,
        review_text=review_text,
        after_image_url=img_url
    )
    db.add(review)

    # Update volunteer impact score (rolling avg)
    vol = db.query(UserORM).filter(UserORM.id == issue.resolver_id).first()
    if vol:
        # Quick avg calculation: assume total_resolved is accurate
        n = max(vol.total_resolved or 1, 1)
        current_impact = vol.impact_score or 5.0
        new_impact = ((current_impact * (n - 1)) + rating) / n
        vol.impact_score = new_impact

    db.commit()
    db.refresh(review)
    return review

@app.get("/api/issues/{issue_id}/review", response_model=Optional[ReviewResponse], tags=["Reviews"])
def get_review(issue_id: int, db: DB):
    review = db.query(ReviewORM).filter(ReviewORM.issue_id == issue_id).first()
    if not review:
        return None
    return review

# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/match
# ═══════════════════════════════════════════════════════════════


@app.get("/api/match/issues", response_model=list[VolunteerMatchResponse], tags=["Matching"])
def get_matched_issues(
    current_user: CurrentUser,
    db: DB,
    radius_km: float = Query(25.0),
    limit: int = Query(20, le=50),
):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can use matching.")

    if not current_user.latitude or not current_user.longitude:
        raise HTTPException(status_code=400, detail="Update your location in profile settings before using matching.")

    open_issues = db.query(IssueORM).filter(IssueORM.status == IssueStatus.OPEN).all()
    results: list[VolunteerMatchResponse] = []

    for issue in open_issues:
        dist = haversine_km(
            current_user.latitude, current_user.longitude,
            issue.latitude, issue.longitude,
        )
        if dist > radius_km:
            continue
        score = skill_match_score(current_user.skills, issue.required_skills)
        results.append(
            VolunteerMatchResponse(
                issue=issue_to_response(issue),
                distance_km=round(dist, 2),
                skill_match_score=round(score, 2),
            )
        )

    results.sort(key=lambda r: (-r.skill_match_score, r.distance_km))
    return results[:limit]


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/ngo  (existing endpoints)
# ═══════════════════════════════════════════════════════════════


@app.get("/api/ngo/members", response_model=list[NGOMemberStats], tags=["NGO"])
def get_ngo_members(current_user: CurrentUser, db: DB, city: Optional[str] = Query(None)):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    q = db.query(UserORM).filter(UserORM.role == UserRole.VOLUNTEER, UserORM.is_active == True)
    if city:
        q = q.filter(func.lower(UserORM.city).contains(city.lower()))

    return [
        NGOMemberStats(
            volunteer_id=v.id,
            volunteer_name=v.full_name,
            total_resolved=v.total_resolved or 0,
            skills=v.skills,
        )
        for v in q.all()
    ]


@app.get("/api/ngo/unassigned", response_model=list[IssueResponse], tags=["NGO"])
def get_unassigned_issues(current_user: CurrentUser, db: DB, city: Optional[str] = Query(None)):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    q = db.query(IssueORM).filter(IssueORM.status == IssueStatus.OPEN, IssueORM.assigned_ngo_id.is_(None))
    if city:
        q = q.filter(func.lower(IssueORM.city).contains(city.lower()))

    return [issue_to_response(i) for i in q.order_by(IssueORM.created_at.asc()).all()]


@app.patch("/api/ngo/assign/{issue_id}", response_model=IssueResponse, tags=["NGO"])
def assign_issue_to_ngo(issue_id: int, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    issue.assigned_ngo_id = current_user.id
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)

@app.post("/api/ngo/issues/{issue_id}/assign-member", tags=["NGO"])
def force_assign_to_member(issue_id: int, volunteer_id: int, current_user: CurrentUser, db: DB):
    """Force assign an issue to a specific volunteer (NGO override)"""
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue or issue.status != IssueStatus.OPEN:
        raise HTTPException(status_code=400, detail="Issue not available.")
    
    vol = db.query(UserORM).filter(UserORM.id == volunteer_id, UserORM.role == UserRole.VOLUNTEER).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found.")

    # Cancel any pending dispatches for this issue
    db.query(DispatchRequestORM).filter(
        DispatchRequestORM.issue_id == issue_id,
        DispatchRequestORM.status == "PENDING"
    ).update({"status": "CANCELLED"})

    # Force create an ACCEPTED dispatch
    d = DispatchRequestORM(
        issue_id=issue_id,
        volunteer_id=volunteer_id,
        score=1.0,
        status="ACCEPTED",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    db.add(d)

    issue.status = IssueStatus.IN_PROGRESS
    issue.resolver_id = volunteer_id
    db.commit()
    return {"message": f"Assigned to {vol.full_name}"}

@app.get("/api/ngo/discover-volunteers", response_model=list[NGOMemberStats], tags=["NGO"])
def discover_independent_volunteers(current_user: CurrentUser, db: DB, city: Optional[str] = None):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    q = db.query(UserORM).filter(
        UserORM.role == UserRole.VOLUNTEER, 
        UserORM.is_active == True,
        UserORM.ngo_status.is_(None) # Independent
    )
    if city:
        q = q.filter(func.lower(UserORM.city).contains(city.lower()))

    # Sort by impact score desc
    vols = q.order_by(UserORM.impact_score.desc()).limit(20).all()

    return [
        NGOMemberStats(
            volunteer_id=v.id,
            volunteer_name=v.full_name,
            total_resolved=v.total_resolved or 0,
            skills=v.skills,
            impact_score=v.impact_score or 0.0
        ) for v in vols
    ]

@app.post("/api/ngo/membership/invite", tags=["NGO"])
def invite_volunteer(volunteer_id: int, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    vol = db.query(UserORM).filter(UserORM.id == volunteer_id).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found.")

    existing = db.query(NGOMembershipRequestORM).filter(
        NGOMembershipRequestORM.volunteer_id == volunteer_id,
        NGOMembershipRequestORM.ngo_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Request already exists.")

    req = NGOMembershipRequestORM(
        volunteer_id=volunteer_id,
        ngo_id=current_user.id,
        initiated_by="NGO",
        status="PENDING"
    )
    db.add(req)
    db.commit()
    return {"message": "Invite sent."}

@app.post("/api/ngo/membership/apply", tags=["NGO"])
def apply_to_ngo(ngo_id: int, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can apply.")

    ngo = db.query(UserORM).filter(UserORM.id == ngo_id, UserORM.role == UserRole.NGO).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found.")

    existing = db.query(NGOMembershipRequestORM).filter(
        NGOMembershipRequestORM.volunteer_id == current_user.id,
        NGOMembershipRequestORM.ngo_id == ngo_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Request already exists.")

    req = NGOMembershipRequestORM(
        volunteer_id=current_user.id,
        ngo_id=ngo_id,
        initiated_by="VOLUNTEER",
        status="PENDING"
    )
    db.add(req)
    db.commit()
    return {"message": "Application sent."}

@app.get("/api/ngo/membership/requests", response_model=list[NGOMembershipRequestResponse], tags=["NGO"])
def get_membership_requests(current_user: CurrentUser, db: DB):
    if current_user.role == UserRole.NGO:
        reqs = db.query(NGOMembershipRequestORM).filter(
            NGOMembershipRequestORM.ngo_id == current_user.id,
            NGOMembershipRequestORM.status == "PENDING"
        ).all()
    elif current_user.role == UserRole.VOLUNTEER:
        reqs = db.query(NGOMembershipRequestORM).filter(
            NGOMembershipRequestORM.volunteer_id == current_user.id,
            NGOMembershipRequestORM.status == "PENDING"
        ).all()
    else:
        raise HTTPException(status_code=403, detail="Not authorized.")

    res = []
    for r in reqs:
        vol = db.query(UserORM).filter(UserORM.id == r.volunteer_id).first()
        ngo = db.query(UserORM).filter(UserORM.id == r.ngo_id).first()
        if vol and ngo:
            res.append(NGOMembershipRequestResponse(
                id=r.id,
                volunteer_id=r.volunteer_id,
                volunteer_name=vol.full_name,
                ngo_id=r.ngo_id,
                ngo_name=ngo.full_name,
                initiated_by=r.initiated_by,
                status=r.status,
                created_at=r.created_at
            ))
    return res

@app.post("/api/ngo/membership/{req_id}/approve", tags=["NGO"])
def approve_membership(req_id: int, current_user: CurrentUser, db: DB):
    req = db.query(NGOMembershipRequestORM).filter(NGOMembershipRequestORM.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")

    if current_user.role == UserRole.NGO and req.ngo_id == current_user.id and req.initiated_by == "VOLUNTEER":
        pass
    elif current_user.role == UserRole.VOLUNTEER and req.volunteer_id == current_user.id and req.initiated_by == "NGO":
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized to approve this request.")

    req.status = "APPROVED"
    vol = db.query(UserORM).filter(UserORM.id == req.volunteer_id).first()
    if vol:
        vol.ngo_status = "APPROVED"
        vol.org_name = str(req.ngo_id) # Store NGO ID or Name as per design

    # Auto-reject other pending requests for this volunteer
    db.query(NGOMembershipRequestORM).filter(
        NGOMembershipRequestORM.volunteer_id == req.volunteer_id,
        NGOMembershipRequestORM.id != req_id,
        NGOMembershipRequestORM.status == "PENDING"
    ).update({"status": "REJECTED"})

    db.commit()
    return {"message": "Membership approved."}

@app.get("/api/ngo/members/activity", response_model=list[IssueResponse], tags=["NGO"])
def get_members_activity(current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    # Find volunteers belonging to this NGO
    members = db.query(UserORM).filter(
        UserORM.role == UserRole.VOLUNTEER,
        UserORM.ngo_status == "APPROVED",
        UserORM.org_name == str(current_user.id)
    ).all()
    
    if not members:
        return []

    member_ids = [m.id for m in members]
    
    issues = db.query(IssueORM).filter(
        IssueORM.resolver_id.in_(member_ids)
    ).order_by(IssueORM.updated_at.desc()).limit(50).all()

    return [issue_to_response(i) for i in issues]


@app.get("/api/ngo/stats", tags=["NGO"])
def get_ngo_dashboard_stats(current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    my_issues = db.query(IssueORM).filter(IssueORM.assigned_ngo_id == current_user.id)
    total = my_issues.count()
    resolved = my_issues.filter(IssueORM.status == IssueStatus.RESOLVED).count()
    in_progress = my_issues.filter(IssueORM.status == IssueStatus.IN_PROGRESS).count()
    open_count = my_issues.filter(IssueORM.status == IssueStatus.OPEN).count()

    return {
        "total_assigned": total,
        "resolved": resolved,
        "in_progress": in_progress,
        "open": open_count,
        "resolution_rate": round(resolved / total * 100, 1) if total else 0,
    }

@app.get("/api/notifications", tags=["System"])
def get_notifications(current_user: CurrentUser, db: DB):
    return db.query(NotificationORM).filter(NotificationORM.user_id == current_user.id).order_by(NotificationORM.created_at.desc()).limit(10).all()

@app.get("/api/leaderboard", tags=["System"])
def get_leaderboard(db: DB):
    # Ranking volunteers by resolved count
    users = db.query(UserORM).filter(UserORM.role == UserRole.VOLUNTEER).order_by(UserORM.total_resolved.desc()).limit(10).all()
    return [{"name": u.full_name, "xp": (u.total_resolved or 0) * 50, "rating": 4.5 + (random.random() * 0.5), "tier": "Catalyst" if u.total_resolved > 20 else "Weaver"} for u in users]

@app.get("/api/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "Weave Civic Connect API",
        "version": "1.0.0",
        "email_sending": EMAIL_ENABLED,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
