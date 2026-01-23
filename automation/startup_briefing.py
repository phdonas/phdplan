import tkinter as tk
from tkinter import ttk
import sys
import os
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Date

# Fix path to access database from sibling directory
current_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(current_dir, '../backend/phdplan.db')
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Atividade(Base):
    __tablename__ = "atividades"
    id = Column(Integer, primary_key=True)
    descricao = Column(String)
    data = Column(Date)
    status = Column(String)
    prioridade = Column(String)

def main():
    root = tk.Tk()
    root.title(f"Briefing Diário - {date.today().strftime('%d/%m/%Y')}")
    root.geometry("600x500")
    
    # Header
    header = tk.Label(root, text=f"🎯 Foco de Hoje", font=("Segoe UI", 20, "bold"), fg="#4B0082")
    header.pack(pady=10)
    
    # Fetch Data
    db = SessionLocal()
    # Mock date for testing if today has no tasks, OR use date.today()
    # INSTRUCTION: "Tasks do dia atual".
    today = date.today()
    # For demo purpose, if db is from future/past excel, we might want to fetch all or a specific date?
    # The Excel has dates like 02/02/2026.
    # Today is 2026-01-09.
    # So querying today might return nothing.
    # I will query EVERYTHING for now as a fallback or query today.
    # Let's query today first.
    
    tasks = db.query(Atividade).filter(Atividade.data == today).all()
    
    if not tasks:
         # Fallback Message
         lbl = tk.Label(root, text="Nenhuma tarefa agendada para hoje (2026-01-09).", font=("Segoe UI", 12))
         lbl.pack()
    
    # Sort Priority: Alta > Média > Baixa
    priority_map = {'Alta': 0, 'Média': 1, 'Baixa': 2, 'Media': 1}
    tasks.sort(key=lambda x: priority_map.get(x.prioridade, 3))
    
    # Scrollable frame (simplified)
    frame = tk.Frame(root)
    frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
    
    for task in tasks:
        p_color = "red" if task.prioridade == 'Alta' else ("orange" if "Média" in task.prioridade or "Media" in task.prioridade else "green")
        
        t_frame = tk.Frame(frame, borderwidth=1, relief="solid", bg="white")
        t_frame.pack(fill=tk.X, pady=5)
        
        lbl_prio = tk.Label(t_frame, text=task.prioridade.upper(), fg="white", bg=p_color, width=10, font=("Segoe UI", 8, "bold"))
        lbl_prio.pack(side=tk.LEFT, padx=5)
        
        lbl_desc = tk.Label(t_frame, text=task.descricao, font=("Segoe UI", 10), bg="white", wraplength=400, justify="left")
        lbl_desc.pack(side=tk.LEFT, padx=10, pady=5)
        
        lbl_status = tk.Label(t_frame, text=task.status, fg="gray", bg="white", font=("Segoe UI", 8))
        lbl_status.pack(side=tk.RIGHT, padx=5)

    btn_frame = tk.Frame(root)
    btn_frame.pack(pady=20)

    def open_dashboard():
        import webbrowser
        webbrowser.open("http://localhost:8000/app/index.html")

    btn_dashboard = tk.Button(btn_frame, text="Abrir Dashboard", command=open_dashboard, bg="#4F46E5", fg="white", font=("Segoe UI", 10, "bold"))
    btn_dashboard.pack(side=tk.LEFT, padx=10)

    btn_close = tk.Button(btn_frame, text="Fechar", command=root.destroy, bg="gray", fg="white", font=("Segoe UI", 10))
    btn_close.pack(side=tk.LEFT, padx=10)
    
    root.mainloop()

if __name__ == "__main__":
    main()
