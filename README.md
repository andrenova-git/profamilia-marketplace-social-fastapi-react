# 🤝 Pró-Família Conecta

Plataforma de marketplace social para comunidades, permitindo que membros ofertem produtos e serviços, avaliem uns aos outros e gerem renda local.

## 📋 Funcionalidades

### Para Usuários
- ✅ Cadastro com aprovação de administrador
- ✅ Publicação de ofertas (produtos/serviços) com imagens
- ✅ Sistema de categorias (Alimentação, Serviços, Artesanato, Outros)
- ✅ Avaliações de vendedores (1-5 estrelas)
- ✅ Sistema de mediação de disputas
- ✅ Relatório de vendas realizadas com comprovante

### Para Administradores
- ✅ Painel completo de gestão
- ✅ Aprovação de novos usuários
- ✅ Moderação de ofertas e avaliações
- ✅ Gestão de mediações
- ✅ Aprovação de vendas reportadas
- ✅ Métricas e relatórios em PDF
- ✅ Notificações via WhatsApp (Evolution API)

## 🛠️ Stack Tecnológica

### Frontend
- React 19
- Tailwind CSS + Shadcn/UI
- React Router DOM
- jsPDF (relatórios)

### Backend
- FastAPI (Python)
- MongoDB (via Motor async)

### Banco de Dados / Auth / Storage
- Supabase (PostgreSQL + Auth + Storage)

### Integrações Opcionais
- Evolution API v2 (Notificações WhatsApp)

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- Python 3.10+
- Conta no [Supabase](https://supabase.com) (gratuito)
- MongoDB local ou Atlas (para backend)

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/pro-familia-conecta.git
cd pro-familia-conecta
```

### 2. Configure o Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Acesse o **SQL Editor** e execute o script:
   ```
   /database/schema.sql
   ```
3. No **Storage**, crie um bucket chamado `offer-images`:
   - Public: ✅
   - File size limit: 5MB
   - Allowed types: image/jpeg, image/png, image/webp
4. Copie as credenciais do projeto (Settings > API)

### 3. Configure o Frontend

```bash
cd frontend

# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas credenciais
nano .env
```

Configurações necessárias:
```env
REACT_APP_SUPABASE_URL=https://seu-projeto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sua-anon-key
REACT_APP_BACKEND_URL=http://localhost:8001
```

Instale as dependências e inicie:
```bash
yarn install
yarn start
```

### 4. Configure o Backend

```bash
cd backend

# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env
nano .env
```

Configurações:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=profamilia_conecta
```

Instale as dependências e inicie:
```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## 📁 Estrutura do Projeto

```
pro-familia-conecta/
├── frontend/                 # React App
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   │   └── ui/           # Shadcn/UI components
│   │   ├── lib/              # Utilitários (supabase, whatsapp)
│   │   ├── pages/            # Páginas da aplicação
│   │   └── App.js            # Rotas principais
│   ├── .env.example          # Template de variáveis
│   └── package.json
│
├── backend/                  # FastAPI
│   ├── server.py             # API principal
│   ├── .env.example          # Template de variáveis
│   └── requirements.txt
│
├── database/
│   └── schema.sql            # Script SQL mestre (Supabase)
│
└── README.md
```

## 🔧 Configuração WhatsApp (Opcional)

Para habilitar notificações via WhatsApp:

1. Instale a [Evolution API v2](https://doc.evolution-api.com/)
2. Configure as variáveis de ambiente:

**Frontend (.env):**
```env
REACT_APP_WHATSAPP_API_URL=http://sua-evolution-api:8080
REACT_APP_WHATSAPP_API_KEY=sua-api-key
REACT_APP_ADMIN_WHATSAPP=5511999999999
```

**Backend (.env):**
```env
WHATSAPP_API_URL=http://sua-evolution-api:8080
WHATSAPP_API_KEY=sua-api-key
```

## 🚀 Deploy

### Frontend (Vercel/Netlify)

1. Conecte seu repositório GitHub
2. Configure as variáveis de ambiente no painel
3. Build command: `yarn build`
4. Output directory: `build`

### Backend (Railway/Render/VPS)

1. Configure as variáveis de ambiente
2. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

## 👤 Criando Administrador

Após o primeiro cadastro, execute no SQL Editor do Supabase:

```sql
UPDATE profiles 
SET role = 'admin', is_approved = true 
WHERE id = 'UUID-DO-USUARIO';
```

## 📝 Licença

MIT License - Sinta-se livre para usar e modificar.

## 🤝 Contribuições

Pull requests são bem-vindos! Para mudanças maiores, abra uma issue primeiro.

---

Desenvolvido com ❤️ para fortalecer comunidades locais.
