# Como Tornar Seu Usuário Admin

## 🎯 Objetivo
Você criou uma conta na aplicação web, mas não é admin. Este guia vai te tornar administrador.

## ⏱️ Tempo: 3 minutos

---

## 📋 Passo a Passo

### Passo 1: Obter a URL do Banco de Dados

1. Acesse: https://dashboard.render.com
2. Faça login
3. Clique no banco de dados **"phdplan-db"**
4. Na seção **"Connections"**, localize **"Internal Database URL"**
5. Clique no ícone de **copiar** (📋)
6. **Guarde essa URL** - vamos usar daqui a pouco

A URL será algo como:
```
postgresql://phdplan:SENHA@dpg-xxxxx.oregon-postgres.render.com/phdplan
```

⚠️ **Mantenha esta URL em segredo!**

---

### Passo 2: Executar o Script

1. Abra o Prompt de Comando (**Windows + R** → `cmd`)

2. Navegue até a pasta do projeto:
   ```bash
   cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
   ```

3. Execute o script:
   ```bash
   python tornar_admin.py
   ```

4. O script vai pedir dois dados:

   **a) DATABASE_URL:**
   - Cole a URL que você copiou do Render (Passo 1)
   - Pressione Enter

   **b) Email:**
   - Digite o email que você usa para fazer login na aplicação
   - Pressione Enter

5. Confirme digitando **"sim"**

6. Aguarde a mensagem de sucesso:
   ```
   ✅ Sucesso! Usuário 'seu@email.com' agora é ADMIN!
   ```

---

### Passo 3: Verificar

1. Acesse sua aplicação web
2. **Faça logout**
3. **Faça login novamente** com o mesmo email
4. Você agora deve ver a aba **"👑 Admin"** no menu!
5. Clique em Admin → você verá o botão **"📁 Importar Excel"**

---

## ❌ Problemas Comuns

### Erro: "Nenhum usuário encontrado"

**Causa**: Email digitado incorretamente ou você ainda não criou conta na web.

**Solução**:
1. Acesse a aplicação web
2. Crie uma conta (se não tiver)
3. Anote o email exato que usou
4. Execute o script novamente com o email correto

---

### Erro: "Could not connect to database"

**Causa**: DATABASE_URL incorreta ou problemas de conexão.

**Solução**:
1. Verifique se copiou a URL completa do Render
2. Certifique-se de copiar a **"Internal Database URL"**, não a External
3. Verifique sua conexão com a internet

---

### Erro: "No module named 'sqlalchemy'"

**Causa**: Dependências não instaladas.

**Solução**:
```bash
cd backend
pip install -r requirements.txt
```

---

## 🔒 Segurança

- ✅ Este script NÃO cria novos usuários
- ✅ Ele apenas PROMOVE um usuário existente a admin
- ✅ A DATABASE_URL não é salva em nenhum lugar
- ✅ Execute este script apenas UMA VEZ
- ⚠️ NUNCA compartilhe a DATABASE_URL

---

## ✅ Checklist

Após executar:

- [ ] Script executou sem erros
- [ ] Mensagem "✅ Sucesso!" apareceu
- [ ] Fiz logout na aplicação web
- [ ] Fiz login novamente
- [ ] Vejo a aba "Admin" no menu
- [ ] Consigo clicar em Admin e ver a interface
- [ ] Vejo o botão "📁 Importar Excel"

---

## 🎉 Pronto!

Agora você é administrador e pode:
- ✅ Importar dados do Excel
- ✅ Gerenciar outros usuários
- ✅ Criar novos usuários
- ✅ Acessar todas as funcionalidades admin

**Próximo passo**: Importar seus dados do Excel! 📁
