"""
Weave Civic Connect — FastAPI Backend  (main.py)
=================================================
Tri-interface platform: Citizens report issues, Volunteers resolve them, NGOs coordinate.

Setup & Run:
    pip install "fastapi[standard]" sqlalchemy "passlib[bcrypt]" "python-jose[cryptography]" python-multipart
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Annotated, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("WEAVE_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION_supersecret_key_32chars!!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./weave.db")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Volunteer-specific
    skills = Column(Text, nullable=True)   # comma-separated skill tags
    bio = Column(Text, nullable=True)
    total_resolved = Column(Integer, default=0)

    # NGO-specific
    org_name = Column(String(255), nullable=True)
    ngo_status = Column(String(20), nullable=True)
    ngo_document_url = Column(String(512), nullable=True)

    # Location
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String(100), nullable=True)

    issues_reported = relationship(
        "IssueORM", back_populates="reporter", foreign_keys="IssueORM.reporter_id"
    )
    issues_resolved = relationship(
        "IssueORM", back_populates="resolver", foreign_keys="IssueORM.resolver_id"
    )


class IssueORM(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)   # e.g. "road", "water", "electricity"
    status = Column(String(20), default=IssueStatus.OPEN)

    # Geolocation
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(512), nullable=True)
    city = Column(String(100), nullable=True)

    # Media
    image_url = Column(String(512), nullable=True)
    proof_url = Column(String(512), nullable=True)   # uploaded by volunteer on resolve

    # Foreign keys
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

    # Tags for skill matching (comma-separated)
    required_skills = Column(Text, nullable=True)


# Create all tables
Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

# ─────────────────────────────────────────────────────────────
# FastAPI app + CORS
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Weave Civic Connect API",
    version="1.0.0",
    description="Tri-interface civic problem reporting and resolution platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")



# ─────────────────────────────────────────────────────────────
# Startup seed
# ─────────────────────────────────────────────────────────────

def seed_database():
    db = SessionLocal()
    try:
        if db.query(UserORM).count() > 0:
            return  # Already seeded

        # ── Users ────────────────────────────────────────────
        citizen1 = UserORM(
            email="anjali@example.com",
            hashed_password=hash_password("password123"),
            full_name="Anjali Mehta",
            role=UserRole.CITIZEN,
            latitude=18.5204, longitude=73.8567, city="Pune",
        )
        citizen2 = UserORM(
            email="rahul@example.com",
            hashed_password=hash_password("password123"),
            full_name="Rahul Bose",
            role=UserRole.CITIZEN,
            latitude=18.4810, longitude=73.8533, city="Pune",
        )
        volunteer1 = UserORM(
            email="ravi@example.com",
            hashed_password=hash_password("password123"),
            full_name="Ravi Kumar",
            role=UserRole.VOLUNTEER,
            skills="Waste Management,Sanitation,Community Outreach",
            bio="Field lead with 3 years of civic volunteering.",
            total_resolved=12,
            latitude=18.5204, longitude=73.8567, city="Pune",
        )
        volunteer2 = UserORM(
            email="priya@example.com",
            hashed_password=hash_password("password123"),
            full_name="Priya Shah",
            role=UserRole.VOLUNTEER,
            skills="Road Repair,Construction",
            total_resolved=8,
            latitude=18.5362, longitude=73.8939, city="Pune",
        )
        ngo1 = UserORM(
            email="sara@greenpune.org",
            hashed_password=hash_password("password123"),
            full_name="Sara Khan",
            role=UserRole.NGO,
            org_name="Green Pune Collective",
            ngo_status=NGOStatus.APPROVED,
            latitude=18.5204, longitude=73.8567, city="Pune",
        )
        db.add_all([citizen1, citizen2, volunteer1, volunteer2, ngo1])
        db.flush()  # get IDs without commit

        # ── Issues ───────────────────────────────────────────
        issues = [
            IssueORM(
                title="Overflowing garbage near market",
                description="Pile of garbage uncleared for 4 days, attracting stray dogs.",
                category="Sanitation",
                required_skills="Waste Management,Sanitation",
                latitude=18.5204, longitude=73.8567,
                address="MG Road Market", city="Pune",
                status=IssueStatus.IN_PROGRESS,
                reporter_id=citizen1.id,
                resolver_id=volunteer1.id,
            ),
            IssueORM(
                title="Broken streetlight on Lane 4",
                description="Streetlight has been out for 2 weeks, road is unsafe at night.",
                category="Electrical",
                required_skills="Electrical",
                latitude=18.5362, longitude=73.8939,
                address="Koregaon Park Lane 4", city="Pune",
                status=IssueStatus.OPEN,
                reporter_id=citizen1.id,
            ),
            IssueORM(
                title="Pothole near school entrance",
                description="Large pothole causing daily accidents to scooter riders.",
                category="Road Repair",
                required_skills="Road Repair,Construction",
                latitude=18.5590, longitude=73.8076,
                address="Aundh Main Rd", city="Pune",
                status=IssueStatus.RESOLVED,
                reporter_id=citizen1.id,
                resolver_id=volunteer2.id,
                resolved_at=datetime.now(timezone.utc),
            ),
            IssueORM(
                title="Stray dog injured near park",
                description="Limping dog needs urgent rescue and vet care.",
                category="Animal Rescue",
                required_skills="Animal Rescue,Healthcare",
                latitude=18.4810, longitude=73.8533,
                address="Sahakar Nagar Park", city="Pune",
                status=IssueStatus.OPEN,
                reporter_id=citizen2.id,
                assigned_ngo_id=ngo1.id,
            ),
        ]
        db.add_all(issues)
        db.commit()
        print("[Weave] Database seeded with demo data.")
    except Exception as e:
        db.rollback()
        print(f"[Weave] Seed failed: {e}")
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    seed_database()

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
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exc
    except JWTError:
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
    # Volunteer
    skills: Optional[str] = None
    bio: Optional[str] = None
    # NGO
    org_name: Optional[str] = None
    # Location
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


class UserProfile(BaseModel):
    id: int
    uid: str
    email: str
    full_name: str
    role: str
    skills: Optional[str] = None
    bio: Optional[str] = None
    org_name: Optional[str] = None
    ngo_status: Optional[str] = None
    total_resolved: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


class VolunteerMatchResponse(BaseModel):
    issue: IssueResponse
    distance_km: float
    skill_match_score: float


class NGOMemberStats(BaseModel):
    volunteer_id: int
    volunteer_name: str
    total_resolved: int
    skills: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two lat/lon points in km."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def skill_match_score(volunteer_skills: str | None, issue_skills: str | None) -> float:
    if not volunteer_skills or not issue_skills:
        return 0.5  # neutral
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
    """Register as Citizen, Volunteer (with skills), or NGO (document pending)."""
    if db.query(UserORM).filter(UserORM.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = UserORM(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        skills=body.skills,
        bio=body.bio,
        org_name=body.org_name,
        ngo_status=NGOStatus.PENDING if body.role == UserRole.NGO else None,
        latitude=body.latitude,
        longitude=body.longitude,
        city=body.city,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
    )


@app.post("/api/auth/token", response_model=TokenResponse, tags=["Auth"])
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    """Login with email+password; returns JWT token."""
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
    )


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/users
# ═══════════════════════════════════════════════════════════════


@app.get("/api/users/me", response_model=UserProfile, tags=["Users"])
def get_my_profile(current_user: CurrentUser):
    """Fetch the authenticated user's own profile."""
    return current_user


@app.patch("/api/users/me", response_model=UserProfile, tags=["Users"])
def update_my_profile(body: UpdateProfileRequest, current_user: CurrentUser, db: DB):
    """Update mutable profile fields for the logged-in user."""
    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/users/{user_id}", response_model=UserProfile, tags=["Users"])
def get_user_profile(user_id: int, db: DB):
    """Fetch a public user profile by ID."""
    user = db.query(UserORM).filter(UserORM.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/issues
# ═══════════════════════════════════════════════════════════════


@app.post("/api/issues", response_model=IssueResponse, status_code=201, tags=["Issues"])
def create_issue(body: IssueCreate, current_user: CurrentUser, db: DB):
    """
    Citizen submits a new civic problem.
    Accepts geolocation coordinates, description, category, and optional skill tags.
    """
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
    """Upload a photo/document alongside an issue (reporter only)."""
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
    status: Optional[str] = Query(None, description="Filter: open | in_progress | resolved"),
    category: Optional[str] = Query(None),
    reporter_id: Optional[int] = Query(None),
    resolver_id: Optional[int] = Query(None),
    assigned_ngo_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
):
    """
    Activity log — filterable by status, category, reporter, resolver, NGO, or city.
    Used by all three interfaces.
    """
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
    """Fetch a single issue by ID."""
    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    return issue_to_response(issue)


@app.patch("/api/issues/{issue_id}/claim", response_model=IssueResponse, tags=["Issues"])
def claim_issue(issue_id: int, current_user: CurrentUser, db: DB):
    """Volunteer claims an open issue, setting its status to in_progress."""
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
    """
    Volunteer marks an issue as resolved and optionally uploads proof (photo/doc).
    Increments the volunteer's total_resolved counter.
    """
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
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/match  (Volunteer skill + geo matching)
# ═══════════════════════════════════════════════════════════════


@app.get("/api/match/issues", response_model=list[VolunteerMatchResponse], tags=["Matching"])
def get_matched_issues(
    current_user: CurrentUser,
    db: DB,
    radius_km: float = Query(25.0, description="Search radius in km"),
    limit: int = Query(20, le=50),
):
    """
    Returns open issues near the volunteer, ranked by skill-match score and distance.
    Volunteer must have latitude/longitude set in their profile.
    """
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can use matching.")

    if not current_user.latitude or not current_user.longitude:
        raise HTTPException(
            status_code=400,
            detail="Update your location in profile settings before using matching.",
        )

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

    # Best skill match first, closest distance as tiebreaker
    results.sort(key=lambda r: (-r.skill_match_score, r.distance_km))
    return results[:limit]


# ═══════════════════════════════════════════════════════════════
# ROUTER: /api/ngo
# ═══════════════════════════════════════════════════════════════


@app.get("/api/ngo/members", response_model=list[NGOMemberStats], tags=["NGO"])
def get_ngo_members(
    current_user: CurrentUser,
    db: DB,
    city: Optional[str] = Query(None),
):
    """NGO views stats for all active volunteers in their area."""
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    q = db.query(UserORM).filter(
        UserORM.role == UserRole.VOLUNTEER,
        UserORM.is_active == True,
    )
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
def get_unassigned_issues(
    current_user: CurrentUser,
    db: DB,
    city: Optional[str] = Query(None),
):
    """NGO sees all open issues not yet claimed by any NGO — for manual assignment."""
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    q = db.query(IssueORM).filter(
        IssueORM.status == IssueStatus.OPEN,
        IssueORM.assigned_ngo_id.is_(None),
    )
    if city:
        q = q.filter(func.lower(IssueORM.city).contains(city.lower()))

    return [issue_to_response(i) for i in q.order_by(IssueORM.created_at.asc()).all()]


@app.patch("/api/ngo/assign/{issue_id}", response_model=IssueResponse, tags=["NGO"])
def assign_issue_to_ngo(issue_id: int, current_user: CurrentUser, db: DB):
    """NGO manually claims ownership / coordination of an issue."""
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="NGO access only.")

    issue = db.query(IssueORM).filter(IssueORM.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    issue.assigned_ngo_id = current_user.id
    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@app.get("/api/ngo/stats", tags=["NGO"])
def get_ngo_dashboard_stats(current_user: CurrentUser, db: DB):
    """Aggregate dashboard stats for the NGO's assigned issues."""
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


# ─────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────


@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "service": "Weave Civic Connect API", "version": "1.0.0"}