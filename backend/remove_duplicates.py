from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import traceback

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def remove_duplicates():
    db = SessionLocal()
    try:
        print("Checking for duplicate tasks...")
        
        # We define a duplicate as having the same:
        # descricao, data, categoria, prioridade
        
        # Fetch all tasks
        all_tasks = db.query(models.Atividade).all()
        print(f"Total tasks in DB: {len(all_tasks)}")
        
        seen_tasks = {}
        duplicates_to_delete = []
        
        for task in all_tasks:
            # Create a unique key for the task content
            # We ignore status because they might have moved one but kept the other stuck
            # But usually duplicates are exact clones.
            # Let's check exact clones first.
            
            key = (
                task.descricao,
                task.data,
                task.categoria,
                task.prioridade,
                task.user_id
            )
            
            if key in seen_tasks:
                # This is a duplicate.
                # Usually keep the one with higher ID (newer) or lower?
                # Let's keep the one with higher ID as it might be the most recent import/edit?
                # Actually, if I imported twice, the second one is the duplicate technically, but they are identical.
                # Let's keep the FIRST one we saw (which is usually lower ID if we iterated by default order, but .all() order isn't guaranteed without sort)
                # Let's check IDs.
                existing_id = seen_tasks[key]
                
                if task.id > existing_id:
                     duplicates_to_delete.append(task.id)
                else:
                     # This shouldn't happen if we iterate in order, but just in case
                     duplicates_to_delete.append(existing_id)
                     seen_tasks[key] = task.id
            else:
                seen_tasks[key] = task.id
                
        print(f"Found {len(duplicates_to_delete)} duplicates.")
        
        if duplicates_to_delete:
            # Delete them
            batch_size = 100
            for i in range(0, len(duplicates_to_delete), batch_size):
                batch = duplicates_to_delete[i:i+batch_size]
                db.query(models.Atividade).filter(models.Atividade.id.in_(batch)).delete(synchronize_session=False)
                db.commit()
                print(f"Deleted batch {i}-{i+len(batch)}")
                
            print("Cleanup complete.")
        else:
            print("No duplicates found.")
            
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    remove_duplicates()
