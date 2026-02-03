from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import traceback

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def count_data():
    db = SessionLocal()
    try:
        task_count = db.query(models.Atividade).count()
        strategy_count = db.query(models.Estrategia).count()
        insight_count = db.query(models.Insight).count()
        user_count = db.query(models.User).count()
        
        print(f"--- USER DATA ---")
        for user in db.query(models.User).all():
            count = db.query(models.Atividade).filter(models.Atividade.user_id == user.id).count()
            print(f"User ID: {user.id} | Email: {user.email} | Role: {user.role} | Tasks: {count}")
        print(f"-----------------")
            
        print(f"--- RAW TASK DATA ---")
        tasks = db.query(models.Atividade).limit(5).all()
        for t in tasks:
            print(f"Task ID: {t.id} | User ID: {t.user_id} | Desc: {t.descricao}")
        print(f"---------------------")
        
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    count_data()
