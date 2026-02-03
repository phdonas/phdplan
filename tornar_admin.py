"""
Script para tornar um usuário existente em Admin
Execute este script UMA VEZ para promover seu usuário a administrador
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys

def make_user_admin(database_url, user_email):
    """Torna um usuário admin no banco de dados de produção"""
    
    try:
        # Ajustar URL se necessário
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        
        # Conectar ao banco
        engine = create_engine(database_url)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Executar SQL diretamente (usando text() para SQLAlchemy 2.x)
        result = session.execute(
            text("UPDATE users SET role = 'admin' WHERE email = :email"),
            {"email": user_email}
        )
        
        session.commit()
        
        if result.rowcount > 0:
            print(f"✅ Sucesso! Usuário '{user_email}' agora é ADMIN!")
            print(f"   {result.rowcount} usuário(s) atualizado(s)")
            print("\nFaça logout e login novamente para ver a aba Admin.")
        else:
            print(f"❌ Nenhum usuário encontrado com o email: {user_email}")
            print("\nVerifique se você digitou o email corretamente.")
            print("Ou certifique-se que você já criou uma conta na aplicação web.")
        
        session.close()
        
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        print("\nVerifique se:")
        print("1. A DATABASE_URL está correta")
        print("2. Você tem permissão para acessar o banco")
        print("3. O firewall/rede permite a conexão")

if __name__ == "__main__":
    print("=" * 60)
    print("🔐 SCRIPT PARA TORNAR USUÁRIO ADMIN")
    print("=" * 60)
    
    # Solicitar DATABASE_URL
    print("\n📋 Passo 1: Obter DATABASE_URL do Render")
    print("-" * 60)
    print("1. Acesse: https://dashboard.render.com")
    print("2. Clique no banco de dados 'phdplan-db'")
    print("3. Na seção 'Connections', copie a 'Internal Database URL'")
    print("4. Cole aqui (a URL não será exibida por segurança):")
    
    database_url = input("\nDATABASE_URL: ").strip()
    
    if not database_url:
        print("❌ DATABASE_URL não pode estar vazia!")
        sys.exit(1)
    
    # Solicitar email do usuário
    print("\n📋 Passo 2: Email do Usuário")
    print("-" * 60)
    print("Digite o email que você usa para fazer login na aplicação:")
    
    user_email = input("\nEmail: ").strip().lower()
    
    if not user_email:
        print("❌ Email não pode estar vazio!")
        sys.exit(1)
    
    # Confirmar
    print("\n⚠️  CONFIRMAÇÃO")
    print("-" * 60)
    print(f"Você vai tornar o usuário '{user_email}' um ADMINISTRADOR.")
    print("Administradores podem:")
    print("  • Criar e gerenciar outros usuários")
    print("  • Importar dados do Excel")
    print("  • Acessar todas as funcionalidades admin")
    
    confirmacao = input("\nDeseja continuar? (sim/não): ").strip().lower()
    
    if confirmacao not in ['sim', 's', 'yes', 'y']:
        print("\n❌ Operação cancelada.")
        sys.exit(0)
    
    # Executar
    print("\n🔄 Processando...")
    print("-" * 60)
    make_user_admin(database_url, user_email)
    print("\n" + "=" * 60)
