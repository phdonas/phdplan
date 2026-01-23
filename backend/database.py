from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Define Base first to avoid circular imports if models imports this
Base = declarative_base()

# Use absolute path to guarantee same DB is accessed
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Priority: Environment Variable (Prod) > Local SQLite (Dev)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    DB_PATH = os.path.join(BASE_DIR, "phdplan.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    connect_args = {"check_same_thread": False}
else:
    # Postgres adjustments (Render provides 'postgres://' but SQLAlchemy needs 'postgresql://')
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    connect_args = {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
