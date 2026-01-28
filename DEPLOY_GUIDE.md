# Guia Completo de Deploy do PHDPlan para a Web

## 📋 Resumo

Este guia vai te ajudar a colocar sua aplicação PHDPlan na internet de forma **100% gratuita**. Você não precisa saber programação - vou te guiar passo a passo com imagens e explicações detalhadas.

## ⏱️ Tempo Estimado
- **Primeira vez**: 40-60 minutos
- **Deploy futuro**: 5-10 minutos

## 💰 Custos
- **GitHub**: Gratuito
- **Render.com**: Gratuito
- **Total**: R$ 0,00

## ⚠️ Limitação Importante

O plano gratuito do Render tem uma característica:
- Após **15 minutos sem uso**, a aplicação "dorme"
- O **primeiro acesso** após isso demora cerca de **1 minuto** para carregar
- Acessos subsequentes são **normais e rápidos**

Para eliminar isso, seria necessário um plano pago (~$7/mês ou ~R$ 35/mês).

---

## 📝 Passo 1: Criar Conta no GitHub

O GitHub é onde vamos guardar o código da aplicação.

### 1.1 Acessar o GitHub

1. Abra seu navegador
2. Acesse: https://github.com
3. Clique em **"Sign up"** (Cadastrar-se)

### 1.2 Criar Sua Conta

1. **Email**: Digite seu melhor email
2. **Password**: Crie uma senha forte (min. 8 caracteres)
3. **Username**: Escolha um nome de usuário (ex: `prof-paulo-udemy`)
4. Clique em **"Continue"**
5. Complete a verificação (puzzle)
6. Verifique seu email e clique no link de confirmação

---

## 📝 Passo 2: Criar Repositório no GitHub

Agora vamos criar um "espaço" para guardar o código do PHDPlan.

### 2.1 Criar Novo Repositório

1. Faça login no GitHub
2. Clique no botão **"+"** no canto superior direito
3. Selecione **"New repository"** (Novo repositório)

### 2.2 Configurar o Repositório

1. **Repository name** (Nome): `phdplan` (use minúsculas, sem espaços)
2. **Description** (Descrição): `Sistema de Gestão PHDPlan`
3. **Visibilidade**: Selecione **"Private"** (Privado) para manter seguro
4. **NÃO marque** nenhuma das opções:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license
5. Clique em **"Create repository"** (Criar repositório)

### 2.3 Anotar Informações

Após criar, você verá uma página com comandos. **DEIXE ESTA ABA ABERTA** - vamos usar ela daqui a pouco.

---

## 📝 Passo 3: Instalar Git no Seu Computador

O Git é um programa que vai enviar seus arquivos para o GitHub.

### 3.1 Baixar Git

1. Acesse: https://git-scm.com/download/win
2. O download começará automaticamente
3. Execute o arquivo baixado (`Git-2.xx.x-64-bit.exe`)

### 3.2 Instalar Git

1. Clique em **"Next"** em todas as telas (aceite as configurações padrão)
2. **IMPORTANTE**: Na tela "Choosing the default editor", selecione **"Use Notepad as Git's default editor"**
3. Continue clicando **"Next"** até o final
4. Clique em **"Install"**
5. Aguarde a instalação
6. Clique em **"Finish"**

---

## 📝 Passo 4: Enviar Código para o GitHub

Agora vamos enviar os arquivos do PHDPlan para o GitHub.

### 4.1 Abrir Prompt de Comando

1. Pressione as teclas **Windows + R**
2. Digite `cmd` e pressione **Enter**
3. Uma janela preta aparecerá - este é o Prompt de Comando

### 4.2 Navegar até a Pasta do PHDPlan

No Prompt de Comando, digite o comando abaixo e pressione **Enter**:

```bash
cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
```

### 4.3 Inicializar Git

Digite os comandos abaixo, **UM POR VEZ**, pressionando **Enter** após cada um:

```bash
git init
```

Este comando inicializa o Git na pasta.

### 4.4 Configurar Git (Primeira Vez)

Se for a primeira vez usando Git, configure seu nome e email:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

**Substitua** "Seu Nome" e "seu@email.com" pelos seus dados reais.

### 4.5 Adicionar Arquivos

```bash
git add .
```

Este comando prepara todos os arquivos para envio.

### 4.6 Fazer Commit

```bash
git commit -m "Deploy inicial do PHDPlan"
```

Este comando "empacota" os arquivos com uma descrição.

### 4.7 Conectar ao GitHub

Volte para a **aba do GitHub que você deixou aberta** no Passo 2.3.

Você verá um comando parecido com:
```
git remote add origin https://github.com/SEU-USUARIO/phdplan.git
```

**COPIE** esse comando exatamente como aparece na sua tela e **COLE** no Prompt de Comando, depois pressione **Enter**.

### 4.8 Enviar para o GitHub

```bash
git branch -M main
git push -u origin main 
```

Você precisará fazer login:
1. Se aparecer uma janela do navegador, faça login com sua conta GitHub
2. Autorize o Git Credential Manager

Aguarde o upload dos arquivos. Quando finalizar, você verá uma mensagem de sucesso.

### 4.9 Verificar

1. Volte para o navegador, na aba do GitHub
2. Pressione **F5** para atualizar a página
3. Você deve ver todos os arquivos do PHDPlan!

---

## 📝 Passo 5: Criar Conta no Render

O Render é onde a aplicação vai "morar" na internet.

### 5.1 Acessar Render

1. Abra uma nova aba
2. Acesse: https://render.com
3. Clique em **"Get Started for Free"**

### 5.2 Criar Conta

**OPÇÃO RECOMENDADA**: Cadastrar com GitHub

1. Clique em **"GitHub"**
2. Faça login com sua conta GitHub (se solicitado)
3. Clique em **"Authorize Render"**

Pronto! Sua conta está criada.

---

## 📝 Passo 6: Criar Banco de Dados no Render

Primeiro vamos criar o banco de dados PostgreSQL.

### 6.1 Criar Novo Banco

1. No Dashboard do Render, clique em **"New +"**
2. Selecione **"PostgreSQL"**

### 6.2 Configurar Banco

1. **Name**: Digite `phdplan-db`
2. **Database**: `phdplan` (será preenchido automaticamente)
3. **User**: `phdplan` (será preenchido automaticamente)
4. **Region**: Selecione **"Oregon (US West)"** (é grátis)
5. **PostgreSQL Version**: Deixe a versão mais recente
6. **Instance Type**: Selecione **"Free"**
7. Role até o final e clique em **"Create Database"**

### 6.3 Aguardar Criação

- Aparecerá uma tela mostrando "Creating..."
- Aguarde até aparecer **"Available"** (geralmente 1-2 minutos)

### 6.4 Copiar URL de Conexão

1. Na página do banco de dados, role até encontrar **"Connections"**
2. Clique para mostrar **"Internal Database URL"**
3. Clique no ícone de **copiar** ao lado da URL
4. **COLE** essa URL em um bloco de notas temporário - vamos usar daqui a pouco

A URL será algo como:
```
postgresql://phdplan:SENHA@dpg-xxxxx.oregon-postgres.render.com/phdplan
```

**IMPORTANTE**: Mantenha esta URL em segredo - ela dá acesso ao seu banco de dados!

---

## 📝 Passo 7: Fazer Deploy do Backend

Agora vamos colocar a aplicação no ar!

### 7.1 Criar Web Service

1. No Dashboard do Render, clique em **"New +"**
2. Selecione **"Web Service"**

### 7.2 Conectar ao GitHub

1. Se for a primeira vez, clique em **"Connect GitHub Account"**
2. Autorize o Render a acessar seus repositórios
3. Na lista de repositórios, encontre **"phdplan"**
4. Clique em **"Connect"**

**NOTA**: Se não aparecer, clique em "Configure account" e dê permissão ao repositório phdplan.

### 7.3 Configurar Web Service

Preencha os campos:

1. **Name**: `phdplan-backend`
2. **Region**: **Oregon (US West)** (mesmo do banco)
3. **Branch**: `main`
4. **Root Directory**: `backend` (IMPORTANTE!)
5. **Runtime**: **Python 3**
6. **Build Command**: 
   ```
   pip install -r requirements.txt
   ```
7. **Start Command**: 
   ```
   gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT
   ```
8. **Instance Type**: Selecione **"Free"**

### 7.4 Adicionar Variáveis de Ambiente

Role até a seção **"Environment Variables"** e clique em **"Add Environment Variable"**. Adicione CADA uma das variáveis abaixo:

**Variável 1:**
- **Key**: `ENVIRONMENT`
- **Value**: `production`

**Variável 2:**
- **Key**: `DATABASE_URL`
- **Value**: Cole aqui a URL do banco que você copiou no Passo 6.4

**Variável 3:**
- **Key**: `SECRET_KEY`
- **Value**: Crie uma senha complexa aleatória, por exemplo: `PHD_2026_SecureKey_98765_XyZ`

**Variável 4:**
- **Key**: `PYTHON_VERSION`
- **Value**: `3.11.0`

### 7.5 Configurar Health Check (Opcional mas recomendado)

Role até **"Health Check Path"** e digite:
```
/health
```

### 7.6 Criar Web Service

1. Role até o final
2. Clique em **"Create Web Service"**

### 7.7 Aguardar Deploy

- O Render começará a fazer o deploy
- Você verá logs aparecendo na tela
- Aguarde até ver **"Your service is live 🎉"** (geralmente 3-5 minutos)

### 7.8 Testar

1. Na parte superior, você verá a URL do seu serviço, algo como:
   ```
   https://phdplan-backend.onrender.com
   ```
2. Clique nessa URL (ou copie e cole no navegador)
3. Adicione `/health` no final:
   ```
   https://phdplan-backend.onrender.com/health
   ```
4. Você deve ver:
   ```json
   {"status":"healthy","service":"PHDPlan API"}
   ```

**Se viu isso, PARABÉNS! O backend está funcionando! 🎉**

---

## 📝 Passo 8: Acessar a Aplicação

### 8.1 URL da Aplicação

Sua aplicação está acessível em:
```
https://phdplan-backend.onrender.com/app
```

Note o `/app` no final - ele carrega o frontend.

### 8.2 Primeiro Acesso

1. Acesse a URL acima
2. Você verá a tela de login do PHDPlan
3. Como é a primeira vez, clique em **"Não tem conta? Crie agora"**
4. Digite seu email e crie uma senha
5. Clique em **"Registrar"**

Pronto! Você está dentro da aplicação!

### 8.3 Criar Atalho

Para facilitar o acesso:

**No celular:**
1. Abra a URL no navegador
2. No Chrome: Toque nos 3 pontinhos → "Adicionar à tela inicial"
3. No Safari (iPhone): Toque no ícone de compartilhar → "Adicionar à Tela de Início"

**No computador:**
1. Salve a URL nos favoritos
2. Ou crie um atalho na área de trabalho

---

## 📝 Passo 9: Importar Dados (Opcional)

Se você tem dados na versão local e quer migrar para a produção:

### 9.1 Opção 1: Via Interface (Recomendado)

1. Acesse a aplicação web
2. Crie manualmente as tarefas mais importantes
3. Use a funcionalidade de importação se disponível

### 9.2 Opção 2: Via Banco de Dados (Avançado)

**ATENÇÃO**: Só faça isso se souber usar ferramentas de banco de dados!

1. Use uma ferramenta como pgAdmin ou TablePlus
2. Conecte ao banco usando a URL do Passo 6.4
3. Exporte dados do SQLite local
4. Importe no PostgreSQL de produção

---

## 🔧 Manutenção e Atualizações

### Como Atualizar a Aplicação

Quando você quiser fazer mudanças no código:

1. Faça as alterações nos arquivos locais
2. Abra o Prompt de Comando
3. Navegue até a pasta do PHDPlan:
   ```bash
   cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
   ```
4. Execute os comandos:
   ```bash
   git add .
   git commit -m "Descrição da mudança"
   git push
   ```
5. O Render detectará a mudança e fará o deploy automaticamente!

---

## ❓ Problemas Comuns

### "A aplicação está muito lenta ou não carrega"

**Causa**: A aplicação "dormiu" após 15 minutos sem uso.

**Solução**: Aguarde 1 minuto. É o tempo para o servidor "acordar". Isso é normal no plano gratuito.

---

### "Erro 503 Service Unavailable"

**Causa**: O deploy ainda está em andamento ou o serviço está reiniciando.

**Solução**: Aguarde 2-3 minutos e tente novamente. Verifique os logs no Render Dashboard.

---

### "Erro ao fazer login ou registrar"

**Possíveis causas e soluções:**

1. **Banco de dados não conectado**:
   - Vá ao Render Dashboard
   - Verifique se o banco está "Available"
   - Verifique se a variável `DATABASE_URL` está correta

2. **SECRET_KEY não configurada**:
   - Vá ao Render Dashboard → seu Web Service
   - Clique em "Environment"
   - Verifique se `SECRET_KEY` existe e tem um valor

---

### "Não consigo fazer git push"

**Erro: "Permission denied"**

**Solução**:
1. Configure suas credenciais do GitHub novamente
2. Ou use GitHub Desktop (interface gráfica mais fácil)

---

### "Os dados desapareceram"

**Causa**: Isso NÃO deve acontecer. O PostgreSQL mantém os dados permanentemente.

**Se acontecer**:
1. Verifique se você está acessando a URL correta de produção
2. Entre em contato com o suporte do Render
3. Verifique se o banco de dados está "Available" no Dashboard

---

## 🎯 Domínio Personalizado (Opcional)

Se quiser uma URL personalizada tipo `phdplan.com.br` ao invés de `phdplan-backend.onrender.com`:

### Custo
- Domínio `.com.br`: ~R$ 40/ano
- Render custom domain: Gratuito (incluído)

### Passos

1. Compre um domínio em: Registro.br, Hostinger, ou similar
2. No Render Dashboard, vá em seu Web Service
3. Clique em "Settings" → "Custom Domain"
4. Adicione seu domínio
5. Configure os DNS conforme instrução do Render

---

## 📞 Suporte

### Render
- Documentação: https://render.com/docs
- Status: https://status.render.com

### GitHub
- Documentação: https://docs.github.com

---

## ✅ Checklist Final

Confirme que tudo está funcionando:

- [ ] Consigo acessar a aplicação pela URL do Render
- [ ] Consigo fazer login
- [ ] Consigo criar uma tarefa
- [ ] Consigo mover tarefas no Kanban
- [ ] Consigo criar Insights
- [ ] Os dados persistem após logout/login
- [ ] O HTTPS está ativo (cadeado verde no navegador)

---

## 🎉 Parabéns!

Sua aplicação PHDPlan agora está na web e acessível de qualquer lugar!

**URL da sua aplicação:**
```
https://phdplan-backend.onrender.com/app
```

Salve esta URL e compartilhe com quem precisar ter acesso (se for o caso).

---

## 📝 Próximos Passos Recomendados

1. **Testar completamente** todas as funcionalidades em produção
2. **Fazer backup** regular dos dados (exportar para Excel)
3. **Monitorar** o uso e desempenho
4. **Documentar** processos específicos do seu workflow
5. **Considerar upgrade** para plano pago se o sleep/wake incomodar

---

**Última atualização**: Janeiro 2026
**Versão do guia**: 1.0
