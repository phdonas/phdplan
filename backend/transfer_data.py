from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import traceback

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def transfer_data():
    db = SessionLocal()
    try:
        source_id = 1 # Admin
        target_id = 2 # pdonassolo@gmail.com
        
        # Verify users exist
        source = db.query(models.User).filter(models.User.id == source_id).first()
        target = db.query(models.User).filter(models.User.id == target_id).first()
        
        if not source or not target:
            print(f"Error: Users not found. Source: {source}, Target: {target}")
            return

        print(f"Transferring data from {source.email} (ID {source.id}) to {target.email} (ID {target.id})")
        
        # Update Activities
        tasks = db.query(models.Atividade).filter(models.Atividade.user_id == source_id).all()
        print(f"Found {len(tasks)} tasks to transfer.")
        for t in tasks:
            t.user_id = target_id
            
        # Update Strategies
        strats = db.query(models.Estrategia).filter(models.Estrategia.user_id == source_id).all()
        print(f"Found {len(strats)} strategies to transfer.")
        for s in strats:
            s.user_id = target_id

        # Update Insights
        insights = db.query(models.Insight).filter(models.Insight.user_id == source_id).all()
        print(f"Found {len(insights)} insights to transfer.")
        for i in insights:
            i.user_id = target_id
            
        db.commit()
        print("Transfer complete successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    transfer_data()
