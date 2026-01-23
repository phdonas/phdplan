import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import timedelta
from auth import get_password_hash # Import hashing function
import traceback

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def import_data():
    db = SessionLocal()
    # Create Default User
    admin_email = "admin@phdplan.com"
    default_user = db.query(models.User).filter(models.User.email == admin_email).first()
    if not default_user:
        print("Creating default admin user...")
        default_user = models.User(
            email=admin_email,
            hashed_password=get_password_hash("admin"), # Default password
            role="admin"
        )
        db.add(default_user)
        db.commit()
        db.refresh(default_user)
    
    user_id = default_user.id
    print(f"Importing data for User ID: {user_id}")
    
    # Original path (Excel is closed now)
    # Original path 
    source_excel = r'c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\0 Plano_Acao_Growth_Udemy_Jan-Mar_2026_RegraOperacional.xlsx'
    excel_file = 'temp_import_v2.xlsx'

    import shutil
    try:
        shutil.copy2(source_excel, excel_file)
        print("Copied Excel to temp file successfully.")
    except Exception as e:
        print(f"Warning: Could not copy file (maybe open? trying anyway): {e}")
        excel_file = source_excel # Fallback
    
    print("Reading Excel file...")
    
    # Clear existing data to prevent duplication
    try:
        num_deleted = db.query(models.Atividade).delete()
        db.query(models.Estrategia).delete()
        db.commit()
        print(f"Cleared {num_deleted} existing tasks and strategies.")
    except Exception as e:
        print(f"Error clearing data: {e}. Proceeding...")
        db.rollback()

    # Import Atividades
    try:
        df_atividades = pd.read_excel(excel_file, sheet_name='Plano Diário')
        # Deduplicate rows based on all columns to avoid strict duplicates in source
        initial_count = len(df_atividades)
        df_atividades = df_atividades.drop_duplicates()
        if len(df_atividades) < initial_count:
            print(f"Removed {initial_count - len(df_atividades)} duplicate rows.")
            
        print(f"Found {len(df_atividades)} unique rows in Plano Diário")
        print(f"Columns: {df_atividades.columns.tolist()}") # DEBUG
        
        for index, row in df_atividades.iterrows():
            # Check for existing to avoid duplicates if re-run (simplified check)
            # ideally check by unique fields, but for now we trust the init.
            
            # Map fields
            # We focus on Data as the primary key for existence check mostly
            pass

            data_val = row.get('Data')
            if pd.isna(data_val):
                continue
            
            # Ensure correct date format
            data_date = pd.to_datetime(data_val).date()
            
            # Status normalization
            status_raw = row.get('Status')
            status = 'A fazer'
            if str(status_raw).lower() in ['ok', 'feito', 'concluído', 'concluido']:
                status = 'Feito'
            
            # Mapping new fields
            o_que = str(row.get('O que') if not pd.isna(row.get('O que')) else '')
            descricao_original = str(row.get('Descrição da ação') if not pd.isna(row.get('Descrição da ação')) else '')
            
            # User wants "O QUE" to be the main description visible
            # If O Que is empty, fallback to Descricao da acao, then O que (empty)
            final_descricao = o_que if o_que.strip() else descricao_original
            
            atividade = models.Atividade(
                descricao=final_descricao,
                data=data_date,
                status=status,
                prioridade=str(row.get('Prioridade', 'Média')),
                categoria=str(row.get('Categoria', 'Geral')),
                
                # New Fields
                o_que=o_que,
                descricao_original=descricao_original,
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
                user_id=user_id # Assign to default user
            )
            db.add(atividade)
            
        print("Atividades imported (pending commit).")

        # Import Estrategia
        df_estrategia = pd.read_excel(excel_file, sheet_name='Temas Semanais')
        print(f"Found {len(df_estrategia)} rows in Temas Semanais")

        for index, row in df_estrategia.iterrows():
            semana_inicio_val = row.get('Semana (início)')
            if pd.isna(semana_inicio_val):
                continue
            
            # Ensure it is a datetime object
            semana_inicio = pd.to_datetime(semana_inicio_val)

            tema = str(row.get('Tema macro', ''))
            
            # Combine angles for description
            angles = [
                f"Financeiro: {row.get('Ângulo Financeiro', '')}",
                f"Negociação: {row.get('Ângulo Negociação/Vendas', '')}",
                f"Gestão: {row.get('Ângulo Gestão Comercial', '')}"
            ]
            descricao_detalhada = " | ".join([a for a in angles if 'nan' not in a.lower()])

            estrategia = models.Estrategia(
                tema=tema,
                semana_inicio=semana_inicio.date(), # Store as date
                semana_fim=(semana_inicio + timedelta(days=6)).date(),
                descricao_detalhada=descricao_detalhada,
                user_id=user_id
            )
            db.add(estrategia)
        
        print("Estrategia imported (pending commit).")
        
        db.commit()
        print("Database successfully populated!")
        
    except Exception as e:
        with open('import_error.txt', 'w') as f:
            f.write(f"Error: {e}\n")
            traceback.print_exc(file=f)
        print(f"Error importing data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_data()
