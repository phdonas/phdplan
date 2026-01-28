# Comandos Git Rápidos - PHDPlan

Este arquivo contém os comandos Git que você vai usar com frequência.

## 🚀 Primeiro Deploy (Executar UMA VEZ)

Abra o Prompt de Comando (Windows + R, digite `cmd`, Enter) e execute:

```bash
cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
git init
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
git add .
git commit -m "Deploy inicial do PHDPlan"
git remote add origin https://github.com/SEU-USUARIO/phdplan.git
git branch -M main
git push -u origin main
```

**IMPORTANTE**: Substitua:
- `"Seu Nome"` pelo seu nome
- `"seu@email.com"` pelo seu email
- `SEU-USUARIO` pelo seu nome de usuário do GitHub

---

## 🔄 Atualizações Futuras (Usar SEMPRE que alterar código)

Quando você fizer mudanças e quiser atualizar a aplicação na web:

```bash
cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
git add .
git commit -m "Descrição do que você mudou"
git push
```

**Exemplo de descrições**:
- `"Adicionada nova funcionalidade X"`
- `"Corrigido bug no Kanban"`
- `"Atualização de dados"`

---

## ✅ Verificar Status

Para ver quais arquivos foram modificados:

```bash
cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
git status
```

---

## 📜 Ver Histórico

Para ver as últimas mudanças:

```bash
cd /d "c:\Users\Lenovo\OneDrive\0 Paulo\1 ATUAL\0 UDEMY GROWTH\PHDPlan"
git log --oneline
```

---

## 🆘 Problemas Comuns

### "Permission denied" ou "Authentication failed"

**Solução**: Você precisa fazer login no GitHub novamente.

1. Quando der o comando `git push`, uma janela do navegador abrirá
2. Faça login com sua conta GitHub
3. Autorize o acesso

---

### "Your branch is behind"

**Solução**: Alguém fez mudanças no GitHub. Você precisa "puxar" essas mudanças primeiro:

```bash
git pull
```

Depois pode fazer seu push normalmente.

---

### "Merge conflict"

**Solução**: Dois lugares alteraram o mesmo arquivo. Você precisa resolver manualmente:

1. Abra os arquivos que estão em conflito (Git mostrará quais são)
2. Edite os arquivos e escolha qual versão manter
3. Depois:
   ```bash
   git add .
   git commit -m "Resolvido conflito"
   git push
   ```

---

## 💡 Dica: Usar GitHub Desktop

Se você não se sente confortável com comandos, use o **GitHub Desktop** (interface gráfica):

1. Baixe em: https://desktop.github.com
2. Instale
3. Faça login com sua conta GitHub
4. Clone seu repositório `phdplan`
5. Use os botões para fazer commit e push!

É muito mais fácil para iniciantes! 😊

---

**LEMBRE-SE**: Cada vez que você faz `git push`, o Render detecta automaticamente e atualiza sua aplicação web em ~3-5 minutos!
