# PHDPlan

Sistema de gestão e planejamento de atividades com Kanban, Calendário, Insights e Estratégia.

## Tecnologias

- **Backend**: FastAPI (Python)
- **Frontend**: HTML, CSS (Tailwind), JavaScript
- **Banco de Dados**: PostgreSQL (produção) / SQLite (desenvolvimento)
- **Deploy**: Render.com

## Desenvolvimento Local

### Requisitos
- Python 3.11+
- pip

### Instalação

1. Clone o repositório
2. Entre na pasta backend:
```bash
cd PHDPlan/backend
```

3. Crie um ambiente virtual (recomendado):
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# ou
source venv/bin/activate  # Linux/Mac
```

4. Instale as dependências:
```bash
pip install -r requirements.txt
```

5. Execute o servidor:
```bash
uvicorn main:app --reload
```

6. Acesse: http://localhost:8000/app

## Deploy em Produção

Veja o guia completo em [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

## Funcionalidades

- ✅ Sistema de autenticação com JWT
- ✅ Gestão de usuários (Admin)
- ✅ Kanban Board com drag-and-drop
- ✅ Visualização em Calendário
- ✅ Banco de Insights
- ✅ Estratégia Semanal
- ✅ Visão Tabela detalhada
- ✅ Exportação para Excel
- ✅ Filtros por data e semana
- ✅ Compartilhamento de planos

## Estrutura de Pastas

```
PHDPlan/
├── backend/           # API FastAPI
│   ├── main.py       # Aplicação principal
│   ├── models.py     # Modelos de dados
│   ├── database.py   # Configuração do banco
│   ├── auth.py       # Autenticação JWT
│   └── ...
├── frontend/         # Interface web
│   ├── index.html
│   ├── js/
│   └── css/
└── automation/       # Scripts de automação
```

## Licença

Uso privado
