-- ================================================
-- Migration RLS: Privar dados para usuários comuns e manter globais para Admins
-- ================================================

-- 1. Helper Function to check if user is admin based on email
CREATE OR REPLACE FUNCTION public.is_admin_email() RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := auth.jwt() ->> 'email';
  RETURN (v_email = 'contatobcmedia@gmail.com' OR v_email LIKE 'planetaassessoria%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add user_id column to tables that need to track ownership
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.licencas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.outorgas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.contratos_mensais ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.faturas_nfe ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.itens_fatura ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 3. Auto-assign user_id on INSERT using a trigger (if DEFAULT auth.uid() isn't enough, but it usually is)
-- DEFAULT auth.uid() is generally sufficient for INSERTs.

-- 4. Enable RLS on tables and define strict policies
-- Drop any generic anon/authenticated policies first
DROP POLICY IF EXISTS "anon_read_clientes" ON public.clientes;
DROP POLICY IF EXISTS "anon_read_licencas" ON public.licencas;
DROP POLICY IF EXISTS "anon_read_financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "anon_read_kanban" ON public.kanban_cards;
DROP POLICY IF EXISTS "anon_write_kanban" ON public.kanban_cards;
DROP POLICY IF EXISTS "anon_write_financeiro" ON public.financeiro;

DROP POLICY IF EXISTS "authenticated_all_outorgas" ON public.outorgas;



-- Ensure RLS is active
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outorgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas_nfe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_fatura ENABLE ROW LEVEL SECURITY;

-- Note: We used `user_id IS NULL` in USING/WITH CHECK so existing seed data that has NO user_id 
-- remains accessible until ownership is claimed or assigned. However, the user said:
-- "quem logar sem esses emais so podera usar os proprios dados, pois os dados da planilha, 
-- sao privados para nos (Murrilo, Ronaldo e Denilson)"
-- THIS MEANS existing data (from the spreadsheet migration) should ONLY be visible to ADMINS, NOT normal users.
-- So we MUST REMOVE `OR user_id IS NULL` for normal users, but keep it for admins!

CREATE OR REPLACE PROCEDURE apply_strict_rls_policies(table_name text)
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_policy" ON public.%I', table_name, table_name);
  EXECUTE format('
    CREATE POLICY "%s_tenant_policy" ON public.%I
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (
      public.is_admin_email() OR (user_id = auth.uid() AND user_id IS NOT NULL)
    )
    WITH CHECK (
      public.is_admin_email() OR (user_id = auth.uid() AND user_id IS NOT NULL)
    );
  ', table_name, table_name);
END;
$$;

CALL apply_strict_rls_policies('clientes');
CALL apply_strict_rls_policies('licencas');
CALL apply_strict_rls_policies('financeiro');
CALL apply_strict_rls_policies('kanban_cards');
CALL apply_strict_rls_policies('outorgas');
CALL apply_strict_rls_policies('contratos_mensais');
CALL apply_strict_rls_policies('faturas_nfe');
CALL apply_strict_rls_policies('itens_fatura');
