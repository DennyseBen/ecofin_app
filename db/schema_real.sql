-- ================================================
-- EcoFin Manager - Schema Limpo e Definitivo
-- Executa no SQL Editor do Supabase
-- ================================================

-- 1. DROP duplicadas/obsoletas (sem perda, estão vazias)
DROP TABLE IF EXISTS public.licenses CASCADE;
DROP TABLE IF EXISTS public.financial_records CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.alert_preferences CASCADE;
DROP TABLE IF EXISTS public.atividades CASCADE;
DROP TABLE IF EXISTS public.configuracoes CASCADE;
DROP TABLE IF EXISTS public.documentos CASCADE;
DROP TABLE IF EXISTS public.import_logs CASCADE;
DROP TABLE IF EXISTS public.license_pdfs CASCADE;
DROP TABLE IF EXISTS public.perfis CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP VIEW IF EXISTS public.vw_dashboard_stats CASCADE;
DROP VIEW IF EXISTS public.vw_licencas_completas CASCADE;
DROP VIEW IF EXISTS public.vw_resumo_financeiro CASCADE;

-- 2. DROP tabelas que serão recriadas com schema correto
DROP TABLE IF EXISTS public.kanban_cards CASCADE;
DROP TABLE IF EXISTS public.financeiro CASCADE;
DROP TABLE IF EXISTS public.licencas CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;

-- ================================================
-- 3. TABELAS DEFINITIVAS
-- ================================================

-- Clientes (empresas únicas)
CREATE TABLE public.clientes (
    id SERIAL PRIMARY KEY,
    razao_social TEXT NOT NULL,
    cnpj TEXT,
    cidade TEXT,
    bairro TEXT,
    grupo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Licenças (registro principal da planilha)
CREATE TABLE public.licencas (
    id SERIAL PRIMARY KEY,
    pasta INTEGER,
    processo TEXT,
    ano INTEGER,
    cliente_id INTEGER REFERENCES public.clientes(id) ON DELETE CASCADE,
    razao_social TEXT NOT NULL,
    cnpj TEXT,
    cidade TEXT,
    bairro TEXT,
    grupo TEXT,
    tipo TEXT NOT NULL,
    atividade_licenciada TEXT,
    departamento TEXT,
    validade DATE,
    validade_serial INTEGER,
    riaa_ral TEXT,
    renovacao TEXT,
    status TEXT DEFAULT 'Válida',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Financeiro
CREATE TABLE public.financeiro (
    id SERIAL PRIMARY KEY,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    valor NUMERIC(12,2) NOT NULL,
    data DATE NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'atrasado')),
    cliente_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Kanban / Processos
CREATE TABLE public.kanban_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    license_type TEXT NOT NULL,
    responsible TEXT,
    stage TEXT NOT NULL DEFAULT 'planejamento',
    protocol_number TEXT,
    tax_due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- 4. INDICES para performance
-- ================================================
CREATE INDEX idx_licencas_status ON public.licencas(status);
CREATE INDEX idx_licencas_tipo ON public.licencas(tipo);
CREATE INDEX idx_licencas_validade ON public.licencas(validade);
CREATE INDEX idx_licencas_razao ON public.licencas(razao_social);
CREATE INDEX idx_kanban_stage ON public.kanban_cards(stage);

-- ================================================
-- 5. ROW LEVEL SECURITY (permissivo para MVP)
-- ================================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Política: leitura pública via anon key (dados não sensíveis)
CREATE POLICY "anon_read_clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "anon_read_licencas" ON public.licencas FOR SELECT USING (true);
CREATE POLICY "anon_read_financeiro" ON public.financeiro FOR SELECT USING (true);
CREATE POLICY "anon_read_kanban" ON public.kanban_cards FOR SELECT USING (true);

-- Escrita para kanban e financeiro (MVP)
CREATE POLICY "anon_write_kanban" ON public.kanban_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_financeiro" ON public.financeiro FOR ALL USING (true) WITH CHECK (true);

-- ================================================
-- 6. VIEWS para Dashboard
-- ================================================
CREATE OR REPLACE VIEW public.vw_dashboard_stats AS
WITH lic_stats AS (
    SELECT 
        id, 
        razao_social,
        CASE 
            WHEN validade IS NOT NULL AND validade < CURRENT_DATE THEN 'Vencida'
            WHEN validade IS NOT NULL AND (validade >= CURRENT_DATE AND validade <= CURRENT_DATE + INTERVAL '90 days') THEN 'Vencendo'
            WHEN validade IS NOT NULL AND validade > CURRENT_DATE + INTERVAL '90 days' THEN 'Válida'
            WHEN status = 'Vencida' THEN 'Vencida'
            ELSE 'Válida'
        END AS dynamic_status
    FROM public.licencas
)
SELECT
    COUNT(DISTINCT razao_social) AS total_clientes,
    COUNT(*) AS total_licencas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Válida') AS licencas_validas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Vencida') AS licencas_vencidas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Vencendo') AS vencendo_90_dias,
    CASE WHEN COUNT(*) > 0 THEN 
        ROUND(100.0 * (COUNT(*) FILTER (WHERE dynamic_status IN ('Válida', 'Vencendo'))) / COUNT(*))
    ELSE 0 END AS compliance_rate
FROM lic_stats;

-- ================================================
-- 7. SEED: Financeiro (dados iniciais)
-- ================================================
INSERT INTO public.financeiro (descricao, tipo, valor, data, status, cliente_nome) VALUES
('Licenciamento - Mateus Supermercados', 'receita', 4500, '2025-02-15', 'pago', 'Mateus Supermercados S.A.'),
('Consultoria Ambiental - Fábrica Gelo Marujo', 'receita', 3200, '2025-02-12', 'pago', 'Fábrica de Gelo do Marujo LTDA'),
('RIAA - Continental Serviços', 'receita', 2800, '2025-02-10', 'pendente', 'Continental Serviços do Brasil LTDA'),
('Material de escritório', 'despesa', 450, '2025-02-08', 'pago', NULL),
('Licenciamento - Concretec Engenharia', 'receita', 6200, '2025-02-05', 'pago', 'Concretec Engenharia LTDA'),
('Transporte para vistoria', 'despesa', 380, '2025-02-03', 'pago', NULL),
('Renovação LO - Indústrias Blanco', 'receita', 5100, '2025-01-28', 'pendente', 'Indústrias Blanco LTDA'),
('Software de gestão', 'despesa', 299, '2025-01-25', 'pago', NULL),
('DLA - Invicta Distribuidora', 'receita', 3800, '2025-01-22', 'atrasado', 'Mais Invicta Distribuidora LTDA'),
('Combustível', 'despesa', 520, '2025-01-20', 'pago', NULL);

-- ================================================
-- 8. SEED: Kanban (processos iniciais)
-- ================================================
INSERT INTO public.kanban_cards (client_name, license_type, responsible, stage, protocol_number, tax_due_date, notes) VALUES
('Mateus Supermercados S.A.', 'LO', 'Anthony', 'planejamento', '', NULL, ''),
('Fábrica de Gelo do Marujo LTDA', 'LO', 'Anthony', 'coleta', '', NULL, ''),
('Concretec Engenharia LTDA', 'LI', 'Carlos', 'preenchimento', 'PROT-2025-001', '2025-04-15', 'Aguardando boleto da SEMMA'),
('Continental Serviços do Brasil LTDA', 'LO', 'Anthony', 'protocolado', 'PROT-2025-002', NULL, ''),
('Indústrias Blanco LTDA', 'LO', 'Carlos', 'exigencias', 'PROT-2025-003', NULL, 'Vistoria agendada para 20/03'),
('G H Comércio Varejista de Bebidas e Gás LTDA', 'DLA', 'Anthony', 'concluido', 'PROT-2024-099', NULL, 'Licença emitida em 10/01/2025');
-- ================================================
-- EcoFin — Features Migration (Março 2026)
-- Executa no SQL Editor do Supabase
-- ================================================

-- 1. Adiciona campos PDF e Data de Renovação nas licenças
ALTER TABLE public.licencas
  ADD COLUMN IF NOT EXISTS pdf_url       TEXT,
  ADD COLUMN IF NOT EXISTS data_renovacao DATE;

-- 2. Adiciona campos de endereço completo nos clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS numero      TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT;

-- 3. Tabela de Outorgas (controle hídrico / ANA / SEMAS)
CREATE TABLE IF NOT EXISTS public.outorgas (
  id              SERIAL PRIMARY KEY,
  razao_social    TEXT NOT NULL,
  cnpj            TEXT,
  tipo            TEXT NOT NULL DEFAULT 'Captação Superficial',
  numero_outorga  TEXT,
  orgao           TEXT,
  validade        DATE,
  data_renovacao  DATE,
  pdf_url         TEXT,
  status          TEXT DEFAULT 'Válida',
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS para outorgas
ALTER TABLE public.outorgas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_outorgas" ON public.outorgas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_outorgas_validade ON public.outorgas(validade);
CREATE INDEX IF NOT EXISTS idx_outorgas_razao_social ON public.outorgas(razao_social);

-- 4. Amplia a tabela profiles com campos de notificação e papel (role)
--    (profiles já existe — criada na migration base do auth)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS role                TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS email_notificacoes  TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_notificacoes TEXT,
  ADD COLUMN IF NOT EXISTS notify_vencimentos  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_renovacoes   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sistema      BOOLEAN DEFAULT true;

-- 5. Tabela de convites de usuário (para o painel admin)
CREATE TABLE IF NOT EXISTS public.user_invites (
  id           SERIAL PRIMARY KEY,
  invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  name         TEXT,
  status       TEXT DEFAULT 'pending',  -- pending | accepted
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_invites" ON public.user_invites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Garante que a policy de leitura de profiles existe para admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'authenticated_read_all_profiles'
  ) THEN
    CREATE POLICY "authenticated_read_all_profiles" ON public.profiles
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_update_own_profile'
  ) THEN
    CREATE POLICY "users_update_own_profile" ON public.profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

-- 7. Cria (ou garante existência de) tabela de configuração fiscal + token Focus NF-e
CREATE TABLE IF NOT EXISTS public.config_nfse (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  cnpj_prestador       TEXT    NOT NULL DEFAULT '',
  inscricao_mun        TEXT    NOT NULL DEFAULT '',
  razao_social         TEXT    NOT NULL DEFAULT '',
  municipio_ibge       TEXT    NOT NULL DEFAULT '',
  uf                   TEXT    NOT NULL DEFAULT 'PA',
  codigo_servico       TEXT    NOT NULL DEFAULT '',
  aliquota_iss         NUMERIC NOT NULL DEFAULT 3,
  discriminacao_padrao TEXT    NOT NULL DEFAULT '',
  focusnfe_token       TEXT,
  focusnfe_ambiente    TEXT    DEFAULT 'homologacao',
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.config_nfse ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config_nfse' AND policyname = 'authenticated_all_config_nfse'
  ) THEN
    CREATE POLICY "authenticated_all_config_nfse" ON public.config_nfse
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Adiciona colunas se tabela já existia sem elas
ALTER TABLE public.config_nfse
  ADD COLUMN IF NOT EXISTS focusnfe_token    TEXT,
  ADD COLUMN IF NOT EXISTS focusnfe_ambiente TEXT DEFAULT 'homologacao';

-- Insere o token na linha de configuração (id=1)
INSERT INTO public.config_nfse (id, focusnfe_token, focusnfe_ambiente)
VALUES (1, 'RCSfMMZL1ZAFUK3TeInuvtgTaNCGYvXS', 'homologacao')
ON CONFLICT (id) DO UPDATE
  SET focusnfe_token    = EXCLUDED.focusnfe_token,
      focusnfe_ambiente = EXCLUDED.focusnfe_ambiente,
      updated_at        = now();
