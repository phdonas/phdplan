from sqlalchemy import Column, Integer, String, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user") # 'user' or 'admin'

    # Relationships
    atividades = relationship("Atividade", back_populates="owner")
    estrategias = relationship("Estrategia", back_populates="owner")
    insights = relationship("Insight", back_populates="owner")
    shares = relationship("PlanShare", back_populates="owner", foreign_keys="PlanShare.owner_id")

class PlanShare(Base):
    __tablename__ = "plan_shares"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    shared_with_email = Column(String)
    permission = Column(String, default="read") # read, edit

    owner = relationship("User", back_populates="shares", foreign_keys=[owner_id])

class Atividade(Base):
    __tablename__ = "atividades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable for migration, but logic should enforce
    owner = relationship("User", back_populates="atividades")

    descricao = Column(String, index=True)
    data = Column(Date)
    status = Column(String, default="A fazer") # A fazer, Fazendo, Feito
    prioridade = Column(String) # Alta, Média, Baixa
    categoria = Column(String)
    
    # Enhanced Fields from spreadsheet
    o_que = Column(String) # Will store 'O que' specifically
    como = Column(String)
    onde = Column(String)
    cta = Column(String)
    duracao = Column(String)
    kpi_meta = Column(String)
    tipo_dia = Column(String)
    dia_semana = Column(String)
    tema_macro = Column(String)
    angulo = Column(String)
    canal_area = Column(String)
    
    # Store original 'Descrição da ação' just in case
    descricao_original = Column(String)

    # Recurrence Fields
    recorrencia_tipo = Column(String) # None, 'n_dias', 'dia_mes', 'dia_semana'
    recorrencia_intervalo = Column(Integer)
    recorrencia_dia_mes = Column(Integer)
    recorrencia_dias_semana = Column(String) # e.g., '0,2,4' for Mon,Wed,Fri
    recorrencia_inicio = Column(Date)
    recorrencia_fim = Column(Date)

class Estrategia(Base):
    __tablename__ = "estrategia"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="estrategias")

    tema = Column(String)
    semana_inicio = Column(Date)
    semana_fim = Column(Date)
    descricao_detalhada = Column(Text)

class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="insights")

    descricao = Column(String)
    data_prevista = Column(Date, nullable=True)
    status = Column(String, default="Ideia") # Ideia, Convertido
    category = Column(String)
    categoria = Column(String) # Duplicate/Alias if needed or just use one. Currently main uses 'categoria'.

    # Extended Fields matching Atividade
    o_que = Column(String)
    como = Column(String)
    onde = Column(String)
    cta = Column(String)
    duracao = Column(String)
    kpi_meta = Column(String)
    tipo_dia = Column(String)
    dia_semana = Column(String)
    tema_macro = Column(String)
    angulo = Column(String)
    canal_area = Column(String)
    prioridade = Column(String, default="Baixa")
