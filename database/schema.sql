-- ====================================================================
-- PRÓ-FAMÍLIA CONECTA - SCRIPT SQL MESTRE
-- Execute este script no Supabase SQL Editor para configurar o banco
-- Versão: 1.0.0 | Data: 2025-02
-- ====================================================================
-- IMPORTANTE: Este script é IDEMPOTENTE - pode ser executado múltiplas
-- vezes sem causar erros ou duplicar dados.
-- ====================================================================

-- ====================================================================
-- PARTE 1: CRIAR TABELAS PRINCIPAIS
-- ====================================================================

-- Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    name TEXT,
    whatsapp TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Ofertas (Produtos/Serviços)
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    images TEXT[] DEFAULT '{}',
    category TEXT DEFAULT 'outros' CHECK (category IN ('alimentacao', 'servicos', 'artesanato', 'outros')),
    neighborhood TEXT,
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Avaliações
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    evaluation_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Disputas/Mediações
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
    complainant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    defendant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    resolution TEXT,
    messages JSONB DEFAULT '[]',
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Logs de Contato
CREATE TABLE IF NOT EXISTS contact_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Relatórios de Vendas
CREATE TABLE IF NOT EXISTS sales_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    sale_type TEXT NOT NULL CHECK (sale_type IN ('venda', 'servico')),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    proof_image TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- PARTE 2: CRIAR ÍNDICES PARA PERFORMANCE
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_offers_owner_id ON offers(owner_id);
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(active);
CREATE INDEX IF NOT EXISTS idx_offers_category ON offers(category);
CREATE INDEX IF NOT EXISTS idx_reviews_offer_id ON reviews(offer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_sales_reports_user_id ON sales_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_reports_status ON sales_reports(status);
CREATE INDEX IF NOT EXISTS idx_sales_reports_created_at ON sales_reports(created_at DESC);

-- ====================================================================
-- PARTE 3: FUNÇÃO AUXILIAR PARA VERIFICAR ADMIN
-- Esta função usa SECURITY DEFINER para evitar recursão em políticas RLS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- PARTE 4: HABILITAR ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reports ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PARTE 5: POLÍTICAS RLS - PROFILES
-- ====================================================================

-- Limpeza de políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Permitir que admins atualizem qualquer perfil" ON profiles;

-- SELECT: Todos podem ver perfis (necessário para ver nomes de vendedores/autores)
CREATE POLICY "profiles_select_policy"
    ON profiles FOR SELECT
    USING (true);

-- INSERT: Usuário pode criar seu próprio perfil durante o cadastro
CREATE POLICY "profiles_insert_policy"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- UPDATE: Usuário pode atualizar seu próprio perfil OU um admin pode atualizar qualquer perfil
-- Esta regra permite que o admin aprove usuários e promova outros a admin
CREATE POLICY "profiles_update_policy"
    ON profiles FOR UPDATE
    USING (
        auth.uid() = id 
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- ====================================================================
-- PARTE 6: POLÍTICAS RLS - OFFERS
-- ====================================================================

DROP POLICY IF EXISTS "offers_select_policy" ON offers;
DROP POLICY IF EXISTS "offers_insert_policy" ON offers;
DROP POLICY IF EXISTS "offers_update_policy" ON offers;
DROP POLICY IF EXISTS "offers_delete_policy" ON offers;

-- SELECT: Ofertas ativas são públicas, donos veem suas ofertas, admin vê tudo
CREATE POLICY "offers_select_policy"
    ON offers FOR SELECT
    USING (active = true OR owner_id = auth.uid() OR public.is_admin());

-- INSERT: Usuários aprovados podem criar ofertas
CREATE POLICY "offers_insert_policy"
    ON offers FOR INSERT
    WITH CHECK (
        auth.uid() = owner_id AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
    );

-- UPDATE: Dono ou admin podem atualizar
CREATE POLICY "offers_update_policy"
    ON offers FOR UPDATE
    USING (owner_id = auth.uid() OR public.is_admin());

-- DELETE: Dono ou admin podem deletar
CREATE POLICY "offers_delete_policy"
    ON offers FOR DELETE
    USING (owner_id = auth.uid() OR public.is_admin());

-- ====================================================================
-- PARTE 7: POLÍTICAS RLS - REVIEWS
-- ====================================================================

DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;

-- SELECT: Reviews aprovadas são públicas, autor vê suas reviews, admin vê tudo
CREATE POLICY "reviews_select_policy"
    ON reviews FOR SELECT
    USING (status = 'approved' OR author_id = auth.uid() OR public.is_admin());

-- INSERT: Usuários autenticados podem criar reviews
CREATE POLICY "reviews_insert_policy"
    ON reviews FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- UPDATE: Apenas admin pode moderar reviews
CREATE POLICY "reviews_update_policy"
    ON reviews FOR UPDATE
    USING (public.is_admin());

-- ====================================================================
-- PARTE 8: POLÍTICAS RLS - DISPUTES
-- ====================================================================

DROP POLICY IF EXISTS "disputes_select_policy" ON disputes;
DROP POLICY IF EXISTS "disputes_insert_policy" ON disputes;
DROP POLICY IF EXISTS "disputes_update_policy" ON disputes;

-- SELECT: Participantes e admin podem ver disputas
CREATE POLICY "disputes_select_policy"
    ON disputes FOR SELECT
    USING (complainant_id = auth.uid() OR defendant_id = auth.uid() OR public.is_admin());

-- INSERT: Usuários autenticados podem criar disputas
CREATE POLICY "disputes_insert_policy"
    ON disputes FOR INSERT
    WITH CHECK (auth.uid() = complainant_id);

-- UPDATE: Participantes ou admin podem atualizar
CREATE POLICY "disputes_update_policy"
    ON disputes FOR UPDATE
    USING (complainant_id = auth.uid() OR defendant_id = auth.uid() OR public.is_admin());

-- ====================================================================
-- PARTE 9: POLÍTICAS RLS - CONTACT_LOGS
-- ====================================================================

DROP POLICY IF EXISTS "contact_logs_select_policy" ON contact_logs;
DROP POLICY IF EXISTS "contact_logs_insert_policy" ON contact_logs;

-- SELECT: Apenas admin pode ver logs
CREATE POLICY "contact_logs_select_policy"
    ON contact_logs FOR SELECT
    USING (public.is_admin());

-- INSERT: Qualquer um pode criar log
CREATE POLICY "contact_logs_insert_policy"
    ON contact_logs FOR INSERT
    WITH CHECK (true);

-- ====================================================================
-- PARTE 10: POLÍTICAS RLS - SALES_REPORTS
-- ====================================================================

DROP POLICY IF EXISTS "sales_select" ON sales_reports;
DROP POLICY IF EXISTS "sales_insert" ON sales_reports;
DROP POLICY IF EXISTS "sales_update" ON sales_reports;
DROP POLICY IF EXISTS "sales_delete" ON sales_reports;

-- SELECT: Usuário vê suas vendas, admin vê todas
CREATE POLICY "sales_select"
    ON sales_reports FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

-- INSERT: Usuário pode criar suas vendas
CREATE POLICY "sales_insert"
    ON sales_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Admin pode aprovar/rejeitar
CREATE POLICY "sales_update"
    ON sales_reports FOR UPDATE
    USING (public.is_admin());

-- DELETE: Admin pode deletar
CREATE POLICY "sales_delete"
    ON sales_reports FOR DELETE
    USING (public.is_admin());

-- ====================================================================
-- PARTE 11: TRIGGER PARA AUTO-CRIAR PERFIL NO CADASTRO
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, whatsapp)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'whatsapp', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- PARTE 12: CONFIGURAR STORAGE BUCKET
-- Execute esta parte manualmente se o bucket não existir
-- ====================================================================

-- No Supabase Dashboard > Storage > New Bucket:
-- Nome: offer-images
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Políticas de Storage (execute no SQL Editor):
-- INSERT (upload): authenticated users can upload to their folder
-- SELECT (download): anyone can view
-- DELETE: users can delete their own files

-- ====================================================================
-- VERIFICAÇÃO FINAL
-- ====================================================================

SELECT 'Tabelas criadas:' as info, count(*) as total 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Políticas RLS:' as info, count(*) as total 
FROM pg_policies 
WHERE schemaname = 'public';

SELECT '✅ Script SQL Mestre executado com sucesso!' as resultado;

-- ====================================================================
-- FIM DO SCRIPT
-- ====================================================================
