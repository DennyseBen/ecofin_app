-- =============================================
-- EcoCRM — Schema de Banco de Dados (Supabase/PostgreSQL)
-- Execute este SQL no Editor SQL do Supabase
-- =============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABELA: perfis (vinculada ao auth.users do Supabase)
-- =============================================
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    cargo TEXT DEFAULT 'Analista',
    telefone TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: cria perfil automaticamente ao criar user via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (id, nome_completo, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TABELA: clientes
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    razao_social TEXT NOT NULL,
    cnpj VARCHAR(20) UNIQUE,
    cidade TEXT,
    bairro TEXT,
    uf VARCHAR(2) DEFAULT 'SP',
    departamento TEXT,
    tipo TEXT DEFAULT 'Licenciamento',  -- Licenciamento, Consultoria, Jurídico
    status VARCHAR(20) DEFAULT 'ativo', -- ativo, pendente, inativo
    responsavel_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
    notas TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_status ON clientes(status);
CREATE INDEX idx_clientes_razao ON clientes(razao_social);

-- =============================================
-- TABELA: licencas (relacionada com clientes)
-- =============================================
CREATE TABLE IF NOT EXISTS licencas (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    tipo VARCHAR(10) NOT NULL,          -- LP, LI, LO, ASV, EIA, OUT, ISO
    processo VARCHAR(50),
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    orgao TEXT NOT NULL,                 -- IBAMA, CETESB, SEMAD, IAT, etc.
    data_emissao DATE,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'vigente', -- vigente, vencida, renovando, exigencia, suspensa
    observacoes TEXT,
    documento_url TEXT,                  -- link para PDF no Supabase Storage
    responsavel_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licencas_status ON licencas(status);
CREATE INDEX idx_licencas_vencimento ON licencas(data_vencimento);
CREATE INDEX idx_licencas_cliente ON licencas(cliente_id);
CREATE INDEX idx_licencas_orgao ON licencas(orgao);

-- =============================================
-- TABELA: financeiro (relacionada com clientes)
-- =============================================
CREATE TABLE IF NOT EXISTS financeiro (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    cliente_nome TEXT,                   -- cache do nome para buscas rápidas
    tipo VARCHAR(10) NOT NULL,           -- receita, despesa
    categoria TEXT NOT NULL,             -- Consultoria, Taxa Ambiental, Multa, Licenciamento
    descricao TEXT,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pendente', -- pago, pendente, atrasado, cancelado
    licenca_id INTEGER REFERENCES licencas(id) ON DELETE SET NULL,
    comprovante_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fin_tipo ON financeiro(tipo);
CREATE INDEX idx_fin_status ON financeiro(status);
CREATE INDEX idx_fin_data ON financeiro(data);
CREATE INDEX idx_fin_cliente ON financeiro(cliente_id);

-- =============================================
-- TABELA: kanban_cards (pipeline de processos)
-- =============================================
CREATE TABLE IF NOT EXISTS kanban_cards (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    licenca_id INTEGER REFERENCES licencas(id) ON DELETE SET NULL,
    coluna VARCHAR(30) DEFAULT 'doc_pendente',  -- doc_pendente, em_analise, exigencia, aprovado
    prioridade VARCHAR(10) DEFAULT 'media',     -- alta, media, baixa
    posicao INTEGER DEFAULT 0,                   -- ordem dentro da coluna
    alerta TEXT,                                 -- mensagem de alerta (opcional)
    responsavel_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kanban_coluna ON kanban_cards(coluna);
CREATE INDEX idx_kanban_cliente ON kanban_cards(cliente_id);

-- =============================================
-- TABELA: documentos (storage de arquivos por licença)
-- =============================================
CREATE TABLE IF NOT EXISTS documentos (
    id SERIAL PRIMARY KEY,
    nome_arquivo TEXT NOT NULL,
    tipo_arquivo VARCHAR(10),            -- pdf, img, xlsx
    tamanho_bytes BIGINT,
    storage_path TEXT NOT NULL,          -- caminho no Supabase Storage
    licenca_id INTEGER REFERENCES licencas(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    enviado_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_licenca ON documentos(licenca_id);

-- =============================================
-- TABELA: atividades (log de auditoria / timeline)
-- =============================================
CREATE TABLE IF NOT EXISTS atividades (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL,           -- login, criacao, edicao, upload, renovacao, exclusao
    descricao TEXT NOT NULL,
    entidade_tipo VARCHAR(20),           -- cliente, licenca, financeiro, kanban
    entidade_id INTEGER,
    usuario_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
    metadata JSONB,                      -- dados extras flexíveis
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ativ_tipo ON atividades(tipo);
CREATE INDEX idx_ativ_entidade ON atividades(entidade_tipo, entidade_id);
CREATE INDEX idx_ativ_usuario ON atividades(usuario_id);
CREATE INDEX idx_ativ_data ON atividades(criado_em);

-- =============================================
-- TABELA: configuracoes (preferências do sistema)
-- =============================================
CREATE TABLE IF NOT EXISTS configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo VARCHAR(20) DEFAULT 'string',   -- string, boolean, number, json
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações padrão
INSERT INTO configuracoes (chave, valor, tipo) VALUES
    ('org_nome', 'EcoSystem Solutions', 'string'),
    ('org_email', 'admin@ecosystem.com', 'string'),
    ('idioma', 'pt-BR', 'string'),
    ('timezone', 'America/Sao_Paulo', 'string'),
    ('alerta_90dias', 'true', 'boolean'),
    ('alerta_30dias', 'true', 'boolean'),
    ('alerta_financeiro', 'true', 'boolean')
ON CONFLICT (chave) DO NOTHING;

-- =============================================
-- VIEWS: Consultas prontas para o Dashboard
-- =============================================

-- View: licenças com dados do cliente (JOIN relacional)
CREATE OR REPLACE VIEW vw_licencas_completas AS
SELECT
    l.*,
    c.razao_social AS cliente_nome,
    c.cnpj AS cliente_cnpj,
    c.cidade AS cliente_cidade,
    (l.data_vencimento - CURRENT_DATE) AS dias_restantes
FROM licencas l
LEFT JOIN clientes c ON l.cliente_id = c.id
ORDER BY l.data_vencimento ASC;

-- View: resumo financeiro mensal
CREATE OR REPLACE VIEW vw_resumo_financeiro AS
SELECT
    DATE_TRUNC('month', data) AS mes,
    SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS total_receita,
    SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS total_despesa,
    SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) AS saldo,
    COUNT(*) AS total_transacoes
FROM financeiro
GROUP BY DATE_TRUNC('month', data)
ORDER BY mes DESC;

-- View: contadores para dashboard
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM clientes WHERE status = 'ativo') AS clientes_ativos,
    (SELECT COUNT(*) FROM licencas WHERE status = 'vigente') AS licencas_vigentes,
    (SELECT COUNT(*) FROM licencas WHERE status = 'vencida') AS licencas_vencidas,
    (SELECT COUNT(*) FROM licencas WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS vencendo_30d,
    (SELECT COUNT(*) FROM licencas WHERE status = 'renovando') AS em_renovacao,
    (SELECT COALESCE(SUM(valor), 0) FROM financeiro WHERE tipo = 'receita' AND DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE)) AS receita_mes,
    (SELECT COALESCE(SUM(valor), 0) FROM financeiro WHERE tipo = 'despesa' AND DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE)) AS despesa_mes;

-- =============================================
-- RLS (Row Level Security) — Segurança por linha
-- =============================================
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários autenticados podem ler/escrever tudo (ajuste conforme necessidade)
CREATE POLICY "Authenticated read all" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON clientes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read all" ON licencas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON licencas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON licencas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read all" ON financeiro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON financeiro FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read all" ON kanban_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated all" ON kanban_cards FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated read all" ON documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON documentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read all" ON atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON atividades FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users read own profile" ON perfis FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON perfis FOR UPDATE TO authenticated USING (auth.uid() = id);

-- =============================================
-- DADOS DE EXEMPLO (seed)
-- =============================================
INSERT INTO clientes (razao_social, cnpj, cidade, uf, departamento, tipo, status) VALUES
    ('Mineração Vale Verde S.A.', '12.345.678/0001-90', 'Belo Horizonte', 'MG', 'Ambiental', 'Licenciamento', 'ativo'),
    ('Energia dos Ventos S.A.', '98.765.432/0001-10', 'Fortaleza', 'CE', 'Operações', 'Consultoria', 'ativo'),
    ('Agroindústria Solar Ltda', '11.222.333/0001-44', 'Ribeirão Preto', 'SP', 'Jurídico', 'Licenciamento', 'ativo'),
    ('Logística Brasil Ltda', '55.666.777/0001-88', 'São Paulo', 'SP', 'Ambiental', 'Consultoria', 'ativo'),
    ('BioTech Solutions Inc.', '99.888.777/0001-11', 'Campinas', 'SP', 'P&D', 'Jurídico', 'ativo'),
    ('Construtora XYZ Ltda', '44.333.222/0001-55', 'Curitiba', 'PR', 'Obras', 'Licenciamento', 'inativo')
ON CONFLICT DO NOTHING;
