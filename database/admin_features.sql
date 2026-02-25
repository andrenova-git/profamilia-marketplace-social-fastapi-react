-- 1. Add status column to profiles for suspension
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

-- 2. Create function to delete from auth.users (Cascades to profiles)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Check if caller is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
    END IF;

    -- Delete user from auth schema (this will cascade to public.profiles)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update offers policy to hide suspended users' offers
DROP POLICY IF EXISTS "offers_select_policy" ON offers;
CREATE POLICY "offers_select_policy"
    ON offers FOR SELECT
    USING (
        (active = true AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = offers.owner_id AND p.status = 'active'))
        OR owner_id = auth.uid() 
        OR public.is_admin()
    );

-- 4. Criar uma função para o próprio usuário se suspender e suspender/ativar via admin (Helper)
CREATE OR REPLACE FUNCTION public.update_profile_status(target_user_id UUID, new_status TEXT)
RETURNS void AS $$
BEGIN
    -- Valida status
    IF new_status NOT IN ('active', 'suspended') THEN
        RAISE EXCEPTION 'Status inválido';
    END IF;

    -- Apenas o próprio usuário ou um admin pode alterar o status
    IF auth.uid() = target_user_id OR public.is_admin() THEN
        UPDATE public.profiles SET status = new_status WHERE id = target_user_id;
    ELSE
        RAISE EXCEPTION 'Acesso negado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
