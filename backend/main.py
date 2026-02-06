from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
import models, database, auth
from datetime import date, timedelta
from pydantic import BaseModel
import pandas as pd
import os
from dotenv import load_dotenv
import tempfile
import shutil

from fastapi.staticfiles import StaticFiles

from sqlalchemy import text

# Load environment variables
load_dotenv()

# Schema migration logic
def apply_migrations():
    """Manually apply migrations for new columns to avoid data loss on Render"""
    db = database.SessionLocal()
    try:
        # Check and add new columns to Atividade
        columns_to_add = {
            "recorrencia_tipo": "VARCHAR",
            "recorrencia_intervalo": "INTEGER",
            "recorrencia_dia_mes": "INTEGER",
            "recorrencia_dias_semana": "VARCHAR",
            "recorrencia_inicio": "DATE",
            "recorrencia_fim": "DATE"
        }
        
        for col, col_type in columns_to_add.items():
            try:
                db.execute(text(f"ALTER TABLE atividades ADD COLUMN {col} {col_type}"))
                db.commit()
                print(f"Added column {col} to atividades")
            except Exception as e:
                db.rollback()
                # Ignore if column already exists
                if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
                    print(f"Migration error for {col}: {e}")

        # Insights extended fields migration
        insight_cols = {
            "o_que": "VARCHAR",
            "como": "VARCHAR",
            "onde": "VARCHAR",
            "cta": "VARCHAR",
            "duracao": "VARCHAR",
            "kpi_meta": "VARCHAR",
            "tipo_dia": "VARCHAR",
            "dia_semana": "VARCHAR",
            "tema_macro": "VARCHAR",
            "angulo": "VARCHAR",
            "canal_area": "VARCHAR",
            "prioridade": "VARCHAR"
        }
        for col, col_type in insight_cols.items():
            try:
                db.execute(text(f"ALTER TABLE insights ADD COLUMN {col} {col_type}"))
                db.commit()
            except Exception:
                db.rollback()

    finally:
        db.close()

# Create tables
models.Base.metadata.create_all(bind=database.engine)
apply_migrations()

app = FastAPI(title="PHDPlan API")

# Configure CORS for production and development
# In production, Render will provide the frontend from the same domain
allowed_origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "*")  # Allow environment variable for frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if os.getenv("ENVIRONMENT") == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine static files path (local vs production)
static_dir = "../frontend"
if os.path.exists("frontend"):
    static_dir = "frontend"

app.mount("/app", StaticFiles(directory=static_dir, html=True), name="frontend")


# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "PHDPlan Backend Operational"}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "PHDPlan API"}

# --- AUTH ENDPOINTS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: str
    password: str

@app.post("/auth/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Login immediately
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "role": current_user.role}

@app.get("/users")
def read_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    users = db.query(models.User).all()
    # Don't return password hashes!
    # Don't return password hashes!
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]

@app.post("/users")
def create_user_admin(user: UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    # Default role is 'user', unless we want to allow specifying it here. 
    # For simplicity, let's allow updating role later or assume 'user' for now.
    # Actually, let's create as 'user' and they can edit it.
    new_user = models.User(email=user.email, hashed_password=hashed_password, role="user")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": new_user.id, "email": new_user.email, "role": new_user.role}

class UserUpdate(BaseModel):
    role: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

@app.put("/users/{user_id}")
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_update.role:
        db_user.role = user_update.role
    if user_update.email:
        db_user.email = user_update.email
    if user_update.password:
        db_user.hashed_password = auth.get_password_hash(user_update.password)
        
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "email": db_user.email, "role": db_user.role}

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.id == current_user.id:
         raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}


@app.get("/tasks")
def read_tasks(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Filter by user
    if current_user.role == 'admin':
         tasks = db.query(models.Atividade).offset(skip).limit(limit).all()
    else:
         # Generic tasks (own) + Shared tasks
         # Get IDs of owners who shared with me
         shares = db.query(models.PlanShare).filter(models.PlanShare.shared_with_email == current_user.email).all()
         shared_owner_ids = [s.owner_id for s in shares]
         
         # Combined query
         # user_id == my_id OR user_id IN shared_owner_ids
         tasks = db.query(models.Atividade).filter(
             (models.Atividade.user_id == current_user.id) | 
             (models.Atividade.user_id.in_(shared_owner_ids))
         ).offset(skip).limit(limit).all()
    
    # Sort by ID desc
    tasks.sort(key=lambda x: x.id, reverse=True)
    return tasks

class TaskCreate(BaseModel):
    descricao: str
    data: Optional[date] = None
    status: str = "A fazer"
    prioridade: str = "Média"
    categoria: str = "Geral"
    # New Fields
    como: Optional[str] = ""
    onde: Optional[str] = ""
    cta: Optional[str] = ""
    duracao: Optional[str] = ""
    kpi_meta: Optional[str] = ""
    tipo_dia: Optional[str] = "" 
    dia_semana: Optional[str] = ""
    tema_macro: Optional[str] = ""
    angulo: Optional[str] = ""
    canal_area: Optional[str] = ""
    o_que: Optional[str] = ""
    # Recurrence
    recorrencia_tipo: Optional[str] = None
    recorrencia_intervalo: Optional[int] = None
    recorrencia_dia_mes: Optional[int] = None
    recorrencia_dias_semana: Optional[str] = None
    recorrencia_inicio: Optional[date] = None
    recorrencia_fim: Optional[date] = None

class TaskUpdate(BaseModel):
    descricao: Optional[str] = None
    data: Optional[date] = None
    status: Optional[str] = None
    prioridade: Optional[str] = None
    categoria: Optional[str] = None
    # New Fields
    como: Optional[str] = None
    onde: Optional[str] = None
    cta: Optional[str] = None
    duracao: Optional[str] = None
    kpi_meta: Optional[str] = None
    tipo_dia: Optional[str] = None 
    dia_semana: Optional[str] = None
    tema_macro: Optional[str] = None
    angulo: Optional[str] = None
    canal_area: Optional[str] = None
    o_que: Optional[str] = None
    descricao_original: Optional[str] = None
    # Recurrence
    recorrencia_tipo: Optional[str] = None
    recorrencia_intervalo: Optional[int] = None
    recorrencia_dia_mes: Optional[int] = None
    recorrencia_dias_semana: Optional[str] = None
    recorrencia_inicio: Optional[date] = None
    recorrencia_fim: Optional[date] = None

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_data = task.dict()
    
    # Handle Recurrence logic
    if task.recorrencia_tipo and task.recorrencia_inicio and task.recorrencia_fim:
        start_date = task.recorrencia_inicio
        end_date = task.recorrencia_fim
        current_date = start_date
        
        tasks_to_create = []
        
        while current_date <= end_date:
            should_create = False
            
            if task.recorrencia_tipo == 'n_dias' and task.recorrencia_intervalo:
                # This logic is slightly complex for "every n days" starting from start_date
                delta = (current_date - start_date).days
                if delta % task.recorrencia_intervalo == 0:
                    should_create = True
            
            elif task.recorrencia_tipo == 'dia_mes' and task.recorrencia_dia_mes:
                if current_date.day == task.recorrencia_dia_mes:
                    should_create = True
                    
            elif task.recorrencia_tipo == 'dia_semana' and task.recorrencia_dias_semana:
                # 0=Monday, etc.
                allowed_days = [int(d) for d in task.recorrencia_dias_semana.split(',') if d.strip()]
                if current_date.weekday() in allowed_days:
                    should_create = True
            
            if should_create:
                # Create a task instance for this date
                instance_data = task_data.copy()
                instance_data['data'] = current_date
                # Remove recurrence metadata or keep it? Let's keep it for reference but maybe not needed for generated instances
                # Actually, better to keep it so we know they are part of a series.
                tasks_to_create.append(models.Atividade(**instance_data, user_id=current_user.id))
            
            current_date += timedelta(days=1)
            
        if tasks_to_create:
            db.add_all(tasks_to_create)
            db.commit()
            return {"message": f"{len(tasks_to_create)} recurrent tasks created"}
        else:
            raise HTTPException(status_code=400, detail="No tasks match the recurrence criteria in the given date range.")

    db_task = models.Atividade(**task_data, user_id=current_user.id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.post("/tasks/{task_id}/duplicate")
def duplicate_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Atividade).filter(models.Atividade.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != 'admin' and db_task.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create copy
    # Exclude id and user_id to let them be set automatically or manually
    task_data = {c.name: getattr(db_task, c.name) for c in db_task.__table__.columns if c.name not in ['id', 'user_id']}
    
    # Reset status to 'A fazer' for the duplicate
    task_data['status'] = 'A fazer'
    
    new_task = models.Atividade(**task_data, user_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Atividade).filter(models.Atividade.id == task_id)
    db_task = query.first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != 'admin' and db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Atividade).filter(models.Atividade.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != 'admin' and db_task.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}

@app.get("/strategies")
def read_strategies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == 'admin':
        strategies = db.query(models.Estrategia).offset(skip).limit(limit).all()
    else:
        strategies = db.query(models.Estrategia).filter(models.Estrategia.user_id == current_user.id).offset(skip).limit(limit).all()
    return strategies

class InsightCreate(BaseModel):
    descricao: str
    categoria: str
    data_prevista: Optional[date] = None
    status: Optional[str] = "Ideia"
    # Extended fields
    o_que: Optional[str] = ""
    como: Optional[str] = ""
    onde: Optional[str] = ""
    cta: Optional[str] = ""
    duracao: Optional[str] = ""
    kpi_meta: Optional[str] = ""
    tipo_dia: Optional[str] = ""
    dia_semana: Optional[str] = ""
    tema_macro: Optional[str] = ""
    angulo: Optional[str] = ""
    canal_area: Optional[str] = ""
    prioridade: Optional[str] = "Baixa"

@app.post("/insights")
def create_insight(insight: InsightCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_insight = models.Insight(
        **insight.dict(),
        user_id=current_user.id
    )
    db.add(db_insight)
    db.commit()
    db.refresh(db_insight)
    return db_insight

@app.get("/insights")
def read_insights(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == 'admin':
        insights = db.query(models.Insight).offset(skip).limit(limit).all()
    else:
        insights = db.query(models.Insight).filter(models.Insight.user_id == current_user.id).offset(skip).limit(limit).all()
    
    # Sort by ID desc
    insights.sort(key=lambda x: x.id, reverse=True)
    return insights

class InsightUpdate(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    data_prevista: Optional[date] = None
    status: Optional[str] = None
    # Extended fields
    o_que: Optional[str] = None
    como: Optional[str] = None
    onde: Optional[str] = None
    cta: Optional[str] = None
    duracao: Optional[str] = None
    kpi_meta: Optional[str] = None
    tipo_dia: Optional[str] = None
    dia_semana: Optional[str] = None
    tema_macro: Optional[str] = None
    angulo: Optional[str] = None
    canal_area: Optional[str] = None
    prioridade: Optional[str] = None

@app.put("/insights/{insight_id}")
def update_insight(insight_id: int, insight: InsightUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_insight = db.query(models.Insight).filter(models.Insight.id == insight_id).first()
    if not db_insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    
    if current_user.role != 'admin' and db_insight.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generic update
    for key, value in insight.dict(exclude_unset=True).items():
        setattr(db_insight, key, value)

    db.commit()
    db.refresh(db_insight)
    return db_insight

@app.delete("/insights/{insight_id}")
def delete_insight(insight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_insight = db.query(models.Insight).filter(models.Insight.id == insight_id).first()
    if not db_insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    
    if current_user.role != 'admin' and db_insight.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(db_insight)
    db.commit()
    return {"message": "Insight deleted"}

@app.get("/export")
def export_data(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Export all tasks to Excel
    if current_user.role == 'admin':
        tasks = db.query(models.Atividade).all()
    else:
        tasks = db.query(models.Atividade).filter(models.Atividade.user_id == current_user.id).all()
        
    data = []
    for t in tasks:
        data.append({
            "id": t.id,
            "descricao": t.descricao,
            "data": t.data,
            "status": t.status,
            "prioridade": t.prioridade,
            "categoria": t.categoria
        })
    
    df = pd.DataFrame(data)
    
    # Save to buffer
    import io
    from fastapi.responses import StreamingResponse
    
    output = io.BytesIO()
    # requires openpyxl
    df.to_excel(output, index=False)
    output.seek(0)
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=phdplan_export.xlsx"}
    )

@app.post("/insights/{insight_id}/convert")
def convert_insight(insight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    insight = db.query(models.Insight).filter(models.Insight.id == insight_id).first()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    
    if current_user.role != 'admin' and insight.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create Task from Insight
    task = models.Atividade(
        descricao=insight.descricao,
        data=insight.data_prevista if insight.data_prevista else date.today(),
        status="A fazer",
        prioridade="Média", # Default
        categoria=insight.categoria,
        user_id=current_user.id, # Assign same user
        
        # Extended Fields
        o_que=insight.o_que,
        como=insight.como,
        onde=insight.onde,
        cta=insight.cta,
        duracao=insight.duracao,
        kpi_meta=insight.kpi_meta,
        tipo_dia=insight.tipo_dia,
        dia_semana=insight.dia_semana,
        tema_macro=insight.tema_macro,
        angulo=insight.angulo,
        canal_area=insight.canal_area
    )
    db.add(task)
    
    insight.status = "Convertido"
    
    db.commit()
    db.refresh(task)
    return task

# --- SHARING ENDPOINTS ---
class ShareRequest(BaseModel):
    email: str
    permission: str = "read"

@app.post("/share")
def share_plan(share_data: ShareRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if target user exists (optional, but good UX)
    # If not exists, maybe just store the email and wait for register? 
    # For now, let's allow sharing even if not registered? 
    # Or restrict? Let's restrict to existing for simplicity or just store.
    # Model stores email. So it's fine.
    
    # Check if already shared
    existing = db.query(models.PlanShare).filter(
        models.PlanShare.owner_id == current_user.id,
        models.PlanShare.shared_with_email == share_data.email
    ).first()
    
    if existing:
        existing.permission = share_data.permission # Update permission
    else:
        new_share = models.PlanShare(
            owner_id=current_user.id,
            shared_with_email=share_data.email,
            permission=share_data.permission
        )
        db.add(new_share)
    
    db.commit()
    return {"message": f"Plan shared with {share_data.email}"}

@app.get("/shares")
def get_shares(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Who I shared with
    my_shares = db.query(models.PlanShare).filter(models.PlanShare.owner_id == current_user.id).all()
    # Who shared with me
    shared_with_me = db.query(models.PlanShare).filter(models.PlanShare.shared_with_email == current_user.email).all()
    return {"my_shares": my_shares, "shared_with_me": shared_with_me}

# --- IMPORT ENDPOINT ---
@app.post("/import/excel")
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Import data from Excel file (Admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can import data")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_path = tmp_file.name
    
    try:
        # Clear existing data for this user to avoid duplicates
        db.query(models.Atividade).filter(models.Atividade.user_id == current_user.id).delete()
        db.query(models.Estrategia).filter(models.Estrategia.user_id == current_user.id).delete()
        db.commit()
        
        tasks_imported = 0
        strategies_imported = 0
        
        # Import Atividades (Tasks)
        try:
            df_atividades = pd.read_excel(tmp_path, sheet_name='Plano Diário')
            df_atividades = df_atividades.drop_duplicates()
            
            for index, row in df_atividades.iterrows():
                data_val = row.get('Data')
                if pd.isna(data_val):
                    continue
                
                data_date = pd.to_datetime(data_val).date()
                
                # Status normalization
                status_raw = row.get('Status')
                status = 'A fazer'
                if str(status_raw).lower() in ['ok', 'feito', 'concluído', 'concluido']:
                    status = 'Feito'
                
                # Get description
                o_que = str(row.get('O que') if not pd.isna(row.get('O que')) else '')
                descricao_original = str(row.get('Descrição da ação') if not pd.isna(row.get('Descrição da ação')) else '')
                final_descricao = o_que if o_que.strip() else descricao_original
                
                atividade = models.Atividade(
                    descricao=final_descricao,
                    data=data_date,
                    status=status,
                    prioridade=str(row.get('Prioridade', 'Média')),
                    categoria=str(row.get('Categoria', 'Geral')),
                    o_que=o_que,
                    como=str(row.get('Como', '')),
                    onde=str(row.get('Onde', '')),
                    cta=str(row.get('CTA', '')),
                    duracao=str(row.get('Duração (min)', '')),
                    kpi_meta=str(row.get('KPI/Meta', '')),
                    tipo_dia=str(row.get('Tipo de dia', '')),
                    dia_semana=str(row.get('Dia da semana', '')),
                    tema_macro=str(row.get('Tema macro', '')),
                    angulo=str(row.get('Ângulo/Trilha', '')),
                    canal_area=str(row.get('Canal/Área', '')),
                    user_id=current_user.id
                )
                db.add(atividade)
                tasks_imported += 1
        except Exception as e:
            print(f"Error importing tasks: {e}")
        
        # Import Estratégia (Weekly Strategies)
        try:
            df_estrategia = pd.read_excel(tmp_path, sheet_name='Temas Semanais')
            
            for index, row in df_estrategia.iterrows():
                semana_inicio_val = row.get('Semana (início)')
                if pd.isna(semana_inicio_val):
                    continue
                
                semana_inicio = pd.to_datetime(semana_inicio_val)
                tema = str(row.get('Tema macro', ''))
                
                angles = [
                    f"Financeiro: {row.get('Ângulo Financeiro', '')}",
                    f"Negociação: {row.get('Ângulo Negociação/Vendas', '')}",
                    f"Gestão: {row.get('Ângulo Gestão Comercial', '')}"
                ]
                descricao_detalhada = " | ".join([a for a in angles if 'nan' not in a.lower()])
                
                estrategia = models.Estrategia(
                    tema=tema,
                    semana_inicio=semana_inicio.date(),
                    semana_fim=(semana_inicio + timedelta(days=6)).date(),
                    descricao_detalhada=descricao_detalhada,
                    user_id=current_user.id
                )
                db.add(estrategia)
                strategies_imported += 1
        except Exception as e:
            print(f"Error importing strategies: {e}")
        
        db.commit()
        
        return {
            "message": "Import successful",
            "tasks_imported": tasks_imported,
            "strategies_imported": strategies_imported
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        # Clean up temporary file
        try:
            os.unlink(tmp_path)
        except:
            pass

@app.get("/briefing/today")
def get_today_briefing(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Get today's tasks for briefing popup"""
    today = date.today()
    
    tasks = db.query(models.Atividade).filter(
        models.Atividade.user_id == current_user.id,
        models.Atividade.data == today,
        models.Atividade.status != 'Feito'
    ).all()
    
    # Sort by priority: Alta > Média > Baixa
    priority_order = {'Alta': 0, 'Média': 1, 'Baixa': 2}
    tasks_sorted = sorted(tasks, key=lambda x: priority_order.get(x.prioridade, 3))
    
    return {
        "date": today,
        "total_tasks": len(tasks_sorted),
        "tasks": tasks_sorted
    }

# --- TEMPORARY SETUP ENDPOINT ---
@app.get("/setup/make-admin/{email}")
def setup_make_admin(email: str, code: str, db: Session = Depends(get_db)):
    """Temporary endpoint to fix admin access"""
    # Simple security check to prevent accidental usage
    if code != "phdplan2026":
        raise HTTPException(status_code=403, detail="Invalid code")
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {email} not found. Please register first.")
    
    user.role = "admin"
    db.commit()
    
    return {"message": f"SUCCESS! User {email} is now an ADMIN. Please logout and login again."}

