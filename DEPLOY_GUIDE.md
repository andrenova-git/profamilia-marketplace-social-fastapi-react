# 🚀 Guia de Deploy - Pró-Família Conecta

Este guia contém instruções passo a passo para publicar o projeto em um novo repositório GitHub e fazer deploy na Vercel.

---

## 📥 Passo 1: Baixar o Projeto

Use a função de download/export da sua plataforma de desenvolvimento para obter o projeto, ou baixe o ZIP do projeto.

Se baixou o ZIP:
1. Extraia o arquivo
2. Remova a pasta `.emergent` (se existir)
3. Remova a pasta `frontend/build` (será regerada)

---

## 📦 Passo 2: Criar Repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Dê um nome ao repositório (ex: `pro-familia-conecta`)
3. Escolha **Private** ou **Public**
4. NÃO inicialize com README (você já tem um)
5. Clique em **Create repository**

### Enviar o código:

```bash
cd pro-familia-conecta

# Inicializar Git (se necessário)
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "Initial commit - Pró-Família Conecta"

# Adicionar remote
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git

# Enviar para GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 Passo 3: Deploy na Vercel (Frontend)

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório que você criou
4. Configure o projeto:

   | Campo | Valor |
   |-------|-------|
   | **Framework Preset** | Create React App |
   | **Root Directory** | `frontend` |
   | **Build Command** | `yarn build` |
   | **Output Directory** | `build` |

5. Adicione as **variáveis de ambiente**:

   ```
   REACT_APP_SUPABASE_URL=https://seu-projeto.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=sua-anon-key-aqui
   REACT_APP_BACKEND_URL=https://seu-backend.railway.app
   ```

6. Clique em **Deploy**

---

## 🔧 Passo 4: Deploy do Backend (Railway/Render)

### Opção A: Railway

1. Acesse [railway.app](https://railway.app)
2. Crie um novo projeto
3. Selecione "Deploy from GitHub repo"
4. Configure:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Adicione variáveis de ambiente:
   ```
   MONGO_URL=sua-url-mongodb
   DB_NAME=profamilia_conecta
   ```

### Opção B: Render

1. Acesse [render.com](https://render.com)
2. Crie um novo **Web Service**
3. Configure similar ao Railway

---

## 🗄️ Passo 5: Configurar Supabase

1. Crie projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o arquivo `/database/schema.sql`
3. Crie o bucket de storage:
   - Nome: `offer-images`
   - Public: ✅
   - File size limit: 5MB

4. Copie as credenciais em **Settings > API**

---

## ✅ Checklist Final

- [ ] Repositório criado no GitHub
- [ ] Frontend deployado na Vercel
- [ ] Backend deployado (Railway/Render/VPS)
- [ ] Supabase configurado com schema SQL
- [ ] Variáveis de ambiente configuradas
- [ ] Primeiro usuário admin criado

---

## 🛠️ Criar Administrador

Após o primeiro cadastro, execute no SQL Editor do Supabase:

```sql
UPDATE profiles 
SET role = 'admin', is_approved = true 
WHERE email = 'seu-email@exemplo.com';
```

---

## 🔄 Atualizações Futuras

Para atualizar o projeto:

```bash
# Fazer alterações nos arquivos
git add .
git commit -m "Descrição das alterações"
git push
```

A Vercel fará redeploy automaticamente!

---

**Dúvidas?** Consulte a documentação completa em `DOCUMENTATION.md`
