from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
import models, database, auth
from datetime import date, timedelta
from pydantic import BaseModel
import pandas as pd

from fastapi.staticfiles import StaticFiles

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="PHDPlan API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/app", StaticFiles(directory="../frontend", html=True), name="frontend")


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

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_data = task.dict()
    db_task = models.Atividade(**task_data, user_id=current_user.id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Atividade).filter(models.Atividade.id == task_id)
    db_task = query.first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != 'admin' and db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in task.dict().items():
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
