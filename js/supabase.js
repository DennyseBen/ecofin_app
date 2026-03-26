// =============================================
// supabase.js — Backend & Auth Configuration
// Enhanced mock data with rich relationships
// =============================================

// ⚠️ INSTRUÇÕES: Substitua pelos seus dados reais do Supabase
// Acesse: supabase.com → Seu Projeto → Settings → API
const SUPABASE_URL = 'https://yhpopgxhqtfhghqzswbn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzk4OTUsImV4cCI6MjA4NzU1NTg5NX0.B5YmYkoUicQnU9fezCgKu0XkJAc12egJtirXu9pznMM';

let IS_MOCK = SUPABASE_URL.includes('sua-url');

let supabase = null;
try {
    if (!IS_MOCK && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (!window.supabase) {
        IS_MOCK = true; // Auto-fallback to mock if CDN is missing
    }
} catch (e) {
    IS_MOCK = true;
    console.warn('Supabase init failed, running in mock mode:', e.message);
}

// =============================================
// Mock Data Store — Banco de dados simulado
// Com relacionamentos entre tabelas
// =============================================
const MOCK_DB = {
    // ---------- PERFIL DO USUÁRIO ----------
    perfil: {
        id: 'usr_001',
        nome_completo: 'Anthony Silva',
        email: 'admin@ecocrm.demo',
        telefone: '(11) 99999-8888',
        cargo: 'Administrador',
        departamento: 'Gestão Ambiental',
        empresa: 'EcoFin Manager',
        bio: 'Especialista em licenciamento ambiental e compliance corporativo. +10 anos de experiência em consultoria ambiental.',
        avatar_url: null,
        tema: 'dark',
        idioma: 'pt-BR',
        notificacoes_email: true,
        notificacoes_push: true,
        notificacoes_licenca: true,
        notificacoes_financeiro: true,
        two_factor: false,
        criado_em: '2023-06-15T10:00:00Z',
        ultimo_acesso: new Date().toISOString(),
    },

    // ---------- CLIENTES ----------
    clientes: [
        { id: 1, nome: 'Mineração Vale Verde S.A.', cnpj: '12.345.678/0001-90', cidade: 'Belo Horizonte', estado: 'MG', status: 'ativo', tipo: 'Mineração', email: 'contato@valeverde.com.br', telefone: '(31) 3333-4444', responsavel: 'Carlos M.', criado_em: '2023-01-10' },
        { id: 2, nome: 'Energia dos Ventos S.A.', cnpj: '98.765.432/0001-10', cidade: 'Fortaleza', estado: 'CE', status: 'ativo', tipo: 'Energia', email: 'ops@energiaventos.com', telefone: '(85) 2222-5555', responsavel: 'Ana L.', criado_em: '2023-03-22' },
        { id: 3, nome: 'Agroindústria Solar Ltda', cnpj: '11.222.333/0001-44', cidade: 'Ribeirão Preto', estado: 'SP', status: 'pendente', tipo: 'Agro', email: 'agro@solar.com.br', telefone: '(16) 3456-7890', responsavel: 'Marcos R.', criado_em: '2023-05-14' },
        { id: 4, nome: 'Logística Brasil Ltda', cnpj: '55.666.777/0001-88', cidade: 'São Paulo', estado: 'SP', status: 'ativo', tipo: 'Logística', email: 'contato@logbrasil.com', telefone: '(11) 4444-5555', responsavel: 'Fernanda S.', criado_em: '2023-07-01' },
        { id: 5, nome: 'BioTech Solutions Inc.', cnpj: '99.888.777/0001-11', cidade: 'Campinas', estado: 'SP', status: 'ativo', tipo: 'Químicos', email: 'bio@techsolutions.com', telefone: '(19) 3322-1100', responsavel: 'Rafael P.', criado_em: '2023-08-20' },
        { id: 6, nome: 'Construtora XYZ Ltda', cnpj: '44.333.222/0001-55', cidade: 'Curitiba', estado: 'PR', status: 'inativo', tipo: 'Construção', email: 'xyz@construtora.com', telefone: '(41) 9988-7766', responsavel: 'Juliana M.', criado_em: '2022-11-05' },
        { id: 7, nome: 'Petrogreen Energy Corp', cnpj: '77.888.999/0001-33', cidade: 'Rio de Janeiro', estado: 'RJ', status: 'ativo', tipo: 'Petróleo', email: 'legal@petrogreen.com', telefone: '(21) 2200-3300', responsavel: 'André T.', criado_em: '2024-01-15' },
        { id: 8, nome: 'Fazendas Sustentáveis S.A.', cnpj: '22.111.000/0001-77', cidade: 'Goiânia', estado: 'GO', status: 'ativo', tipo: 'Agro', email: 'contato@fazendas.agr.br', telefone: '(62) 3344-5566', responsavel: 'Lucas G.', criado_em: '2024-02-10' },
    ],

    // ---------- LICENÇAS (com referência a clientes) ----------
    licencas: [
        { id: 1, titulo: 'LO - Licença de Operação', processo: '12345/2023', cliente_id: 1, orgao: 'IBAMA', vencimento: '2025-10-15', status: 'vigente', tipo: 'LO', valor_taxa: 3200, observacao: 'Renovação automática disponível' },
        { id: 2, titulo: 'LI - Licença de Instalação', processo: '67890/2022', cliente_id: 3, orgao: 'IAT', vencimento: '2024-02-01', status: 'vencida', tipo: 'LI', valor_taxa: 1800, observacao: 'Necessário protocolar renovação urgente' },
        { id: 3, titulo: 'LP - Licença Prévia', processo: '11223/2024', cliente_id: 6, orgao: 'IBAMA', vencimento: '2025-12-20', status: 'renovando', tipo: 'LP', valor_taxa: 5500, observacao: 'Aguardando análise técnica' },
        { id: 4, titulo: 'ASV - Autorização de Supressão', processo: '44556/2024', cliente_id: 1, orgao: 'SEMAD', vencimento: '2025-06-12', status: 'vigente', tipo: 'ASV', valor_taxa: 2100, observacao: 'Área delimitada: 12 hectares' },
        { id: 5, titulo: 'EIA/RIMA Complexo Eólico', processo: '77889/2023', cliente_id: 2, orgao: 'IBAMA', vencimento: '2025-03-30', status: 'exigencia', tipo: 'EIA', valor_taxa: 15000, observacao: 'Falta complementar estudo faunístico' },
        { id: 6, titulo: 'Outorga de Água Subterrânea', processo: '99001/2024', cliente_id: 3, orgao: 'CETESB', vencimento: '2025-08-20', status: 'vigente', tipo: 'OUT', valor_taxa: 4200, observacao: 'Vazão: 50 m³/dia' },
        { id: 7, titulo: 'Certificação ISO 14001', processo: '55443/2023', cliente_id: 5, orgao: 'INMETRO', vencimento: '2025-05-10', status: 'vigente', tipo: 'ISO', valor_taxa: 8000, observacao: 'Auditoria agendada para março' },
        { id: 8, titulo: 'Licença de Operação Refinaria', processo: '88221/2024', cliente_id: 7, orgao: 'IBAMA', vencimento: '2026-01-15', status: 'vigente', tipo: 'LO', valor_taxa: 22000, observacao: 'Monitoramento trimestral de efluentes' },
        { id: 9, titulo: 'Outorga de Captação Superficial', processo: '33445/2024', cliente_id: 8, orgao: 'SEMAD', vencimento: '2025-04-05', status: 'renovando', tipo: 'OUT', valor_taxa: 3800, observacao: 'Renovação protocolada em 15/01' },
        { id: 10, titulo: 'Licença Ambiental Transporte', processo: '66701/2023', cliente_id: 4, orgao: 'CETESB', vencimento: '2025-07-30', status: 'vigente', tipo: 'LAT', valor_taxa: 1500, observacao: 'Veículos cadastrados: 45' },
    ],

    // ---------- FINANCEIRO ----------
    financeiro: [
        { id: 1, data: '2025-02-24', cliente: 'Mineração Vale Verde S.A.', cliente_id: 1, tipo: 'receita', categoria: 'Consultoria', valor: 8500, status: 'pago', descricao: 'Consultoria ambiental mensal' },
        { id: 2, data: '2025-02-22', cliente: 'Prefeitura de São Paulo', cliente_id: null, tipo: 'despesa', categoria: 'Taxa Ambiental', valor: 1250, status: 'pago', descricao: 'Taxa de fiscalização ambiental' },
        { id: 3, data: '2025-02-20', cliente: 'Energia dos Ventos S.A.', cliente_id: 2, tipo: 'receita', categoria: 'Licenciamento', valor: 15000, status: 'pendente', descricao: 'Serviço de licenciamento EIA/RIMA' },
        { id: 4, data: '2025-02-15', cliente: 'IBAMA Regional', cliente_id: null, tipo: 'despesa', categoria: 'Multa', valor: 5000, status: 'atrasado', descricao: 'Multa por atraso na renovação' },
        { id: 5, data: '2025-02-12', cliente: 'BioTech Solutions Inc.', cliente_id: 5, tipo: 'receita', categoria: 'Certificação', valor: 6200, status: 'pago', descricao: 'Preparação ISO 14001' },
        { id: 6, data: '2025-02-08', cliente: 'Petrogreen Energy Corp', cliente_id: 7, tipo: 'receita', categoria: 'Consultoria', valor: 22000, status: 'pago', descricao: 'Monitoramento ambiental trimestral' },
        { id: 7, data: '2025-02-05', cliente: 'Logística Brasil Ltda', cliente_id: 4, tipo: 'receita', categoria: 'Licenciamento', valor: 3500, status: 'pago', descricao: 'Licença ambiental transporte' },
        { id: 8, data: '2025-02-01', cliente: 'SEMAD-MG', cliente_id: null, tipo: 'despesa', categoria: 'Taxa de Análise', valor: 2800, status: 'pago', descricao: 'Taxa de análise técnica' },
        { id: 9, data: '2025-01-28', cliente: 'Fazendas Sustentáveis S.A.', cliente_id: 8, tipo: 'receita', categoria: 'Consultoria', valor: 4800, status: 'pendente', descricao: 'Consultoria outorga de água' },
        { id: 10, data: '2025-01-25', cliente: 'Agroindústria Solar Ltda', cliente_id: 3, tipo: 'receita', categoria: 'Licenciamento', valor: 7200, status: 'pago', descricao: 'Elaboração de PRAD' },
    ],

    // ---------- KANBAN (Pipeline de Processos) ----------
    kanban: {
        'doc_pendente': [
            { id: 1, titulo: 'Licenciamento Mineral', cliente: 'Mineração Vale Verde', cliente_id: 1, prioridade: 'alta', atualizado: '24 Fev', tags: ['IBAMA', 'LO'] },
            { id: 2, titulo: 'Relatório de Emissões', cliente: 'Logística Brasil', cliente_id: 4, prioridade: 'media', atualizado: '22 Fev', tags: ['CETESB'] },
            { id: 6, titulo: 'PRAD Fazendas', cliente: 'Fazendas Sustentáveis', cliente_id: 8, prioridade: 'baixa', atualizado: '20 Fev', tags: ['SEMAD'] },
        ],
        'em_analise': [
            { id: 3, titulo: 'Outorga de Águas', cliente: 'Agroindústria Solar', cliente_id: 3, prioridade: 'baixa', atualizado: '18 Fev', tags: ['CETESB', 'OUT'] },
            { id: 7, titulo: 'Monitoramento Refinaria', cliente: 'Petrogreen Energy', cliente_id: 7, prioridade: 'alta', atualizado: '23 Fev', tags: ['IBAMA'] },
        ],
        'exigencia': [
            { id: 4, titulo: 'EIA/RIMA Eólico', cliente: 'Energia dos Ventos', cliente_id: 2, prioridade: 'alta', atualizado: '21 Fev', alerta: 'Falta comprovante de pagamento e estudo faunístico', tags: ['IBAMA', 'EIA'] },
        ],
        'aprovado': [
            { id: 5, titulo: 'ISO 14001', cliente: 'BioTech Solutions', cliente_id: 5, prioridade: 'baixa', atualizado: '15 Fev', tags: ['INMETRO', 'ISO'] },
        ]
    },

    // ---------- CONDICIONANTES PADRÃO (Seed Data) ----------
    condicionantes_padrao: [
        { id: 1, descricao: 'Monitoramento de efluentes', categoria: 'Monitoramento', obrigatoria: true },
        { id: 2, descricao: 'Gerenciamento de resíduos sólidos', categoria: 'Resíduos', obrigatoria: true },
        { id: 3, descricao: 'Controle de emissões atmosféricas', categoria: 'Emissões', obrigatoria: true },
        { id: 4, descricao: 'Recuperação de áreas degradadas (PRAD)', categoria: 'Recuperação', obrigatoria: true },
        { id: 5, descricao: 'Educação ambiental', categoria: 'Social', obrigatoria: false },
        { id: 6, descricao: 'Manutenção de sistemas de controle', categoria: 'Manutenção', obrigatoria: true },
        { id: 7, descricao: 'Relatórios de desempenho', categoria: 'Relatórios', obrigatoria: true },
        { id: 8, descricao: 'Preservação de reserva legal/APP', categoria: 'Preservação', obrigatoria: true },
    ],

    // ---------- CONDICIONANTES POR LICENÇA ----------
    condicionantes_licenca: [
        { id: 1, licenca_id: 1, condicionante_padrao_id: 1, descricao: 'Monitoramento de efluentes', prazo_vencimento: '2025-06-15', status: 'pendente', arquivo_url: null, observacao: 'Análise laboratorial trimestral', criado_em: '2024-10-01' },
        { id: 2, licenca_id: 1, condicionante_padrao_id: 2, descricao: 'Gerenciamento de resíduos sólidos', prazo_vencimento: '2025-04-30', status: 'cumprida', arquivo_url: 'plano_residuos_valeverde.pdf', observacao: 'PGRS aprovado', criado_em: '2024-10-01' },
        { id: 3, licenca_id: 1, condicionante_padrao_id: 7, descricao: 'Relatórios de desempenho', prazo_vencimento: '2025-03-01', status: 'pendente', arquivo_url: null, observacao: 'Relatório semestral pendente', criado_em: '2024-10-01' },
        { id: 4, licenca_id: 4, condicionante_padrao_id: 4, descricao: 'Recuperação de áreas degradadas (PRAD)', prazo_vencimento: '2025-05-20', status: 'pendente', arquivo_url: null, observacao: 'PRAD protocolado, aguardando aprovação', criado_em: '2024-11-15' },
        { id: 5, licenca_id: 5, condicionante_padrao_id: 3, descricao: 'Controle de emissões atmosféricas', prazo_vencimento: '2025-04-10', status: 'pendente', arquivo_url: null, observacao: 'Estudo de dispersão em andamento', criado_em: '2024-09-01' },
        { id: 6, licenca_id: 5, condicionante_padrao_id: 5, descricao: 'Educação ambiental', prazo_vencimento: '2025-08-01', status: 'cumprida', arquivo_url: 'certificado_educacao.pdf', observacao: 'Programa concluído em 2 comunidades', criado_em: '2024-09-01' },
        { id: 7, licenca_id: 8, condicionante_padrao_id: 1, descricao: 'Monitoramento de efluentes', prazo_vencimento: '2025-07-30', status: 'pendente', arquivo_url: null, observacao: 'Coleta mensal de amostras', criado_em: '2024-12-01' },
        { id: 8, licenca_id: 8, condicionante_padrao_id: 6, descricao: 'Manutenção de sistemas de controle', prazo_vencimento: '2025-03-15', status: 'pendente', arquivo_url: null, observacao: 'Calibração de instrumentos pendente', criado_em: '2024-12-01' },
        { id: 9, licenca_id: 8, condicionante_padrao_id: 8, descricao: 'Preservação de reserva legal/APP', prazo_vencimento: '2026-01-01', status: 'cumprida', arquivo_url: 'laudo_preservacao.pdf', observacao: 'Área cercada e monitorada', criado_em: '2024-12-01' },
        { id: 10, licenca_id: 7, condicionante_padrao_id: 7, descricao: 'Relatórios de desempenho', prazo_vencimento: '2025-04-30', status: 'pendente', arquivo_url: null, observacao: 'Relatório ISO 14001 - ciclo 2024', criado_em: '2024-06-01' },
    ],

    // ---------- ATIVIDADES (Log do sistema) ----------
    atividades: [
        { id: 1, tipo: 'login', descricao: 'Sessão iniciada no sistema', entidade_tipo: null, entidade_id: null, criado_em: new Date().toISOString() },
        { id: 2, tipo: 'edicao', descricao: 'Licença LO #12345 renovação protocolada', entidade_tipo: 'licenca', entidade_id: 1, criado_em: new Date(Date.now() - 3600000).toISOString() },
        { id: 3, tipo: 'upload', descricao: 'Relatório técnico enviado — Vale Verde', entidade_tipo: 'documento', entidade_id: null, criado_em: new Date(Date.now() - 7200000).toISOString() },
        { id: 4, tipo: 'criacao', descricao: 'Novo cliente cadastrado: Petrogreen Energy', entidade_tipo: 'cliente', entidade_id: 7, criado_em: new Date(Date.now() - 18000000).toISOString() },
        { id: 5, tipo: 'edicao', descricao: 'Outorga de captação atualizada — Fazendas Sustentáveis', entidade_tipo: 'licenca', entidade_id: 9, criado_em: new Date(Date.now() - 43200000).toISOString() },
        { id: 6, tipo: 'criacao', descricao: 'Transação financeira registrada: R$ 22.000', entidade_tipo: 'financeiro', entidade_id: 6, criado_em: new Date(Date.now() - 86400000).toISOString() },
        { id: 7, tipo: 'exclusao', descricao: 'Documento antigo removido do arquivo', entidade_tipo: 'documento', entidade_id: null, criado_em: new Date(Date.now() - 172800000).toISOString() },
    ],
};

// =============================================
// Backend API Layer (abstrai Supabase / Mock)
// =============================================
window.EcoBackend = {
    supabase,
    IS_MOCK,

    // ---------- AUTH ----------
    async loginWithGoogle() {
        if (IS_MOCK) {
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'Modo Demonstração',
                    html: 'Supabase não configurado.<br>Abrindo dashboard em modo demonstração.',
                    icon: 'info',
                    background: '#0f1712',
                    color: '#e2e8f0',
                    confirmButtonColor: '#4ade80',
                    confirmButtonText: 'Continuar →',
                    timer: 3000,
                    timerProgressBar: true,
                });
            }
            localStorage.setItem('ecocrm_session', JSON.stringify({
                mock: true,
                user: {
                    email: MOCK_DB.perfil.email,
                    name: MOCK_DB.perfil.nome_completo,
                    avatar: null
                }
            }));
            window.location.href = 'dashboard.html';
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/dashboard.html' }
        });
        if (error && typeof Swal !== 'undefined') {
            Swal.fire({ title: 'Erro', text: error.message, icon: 'error', background: '#0f1712', color: '#fff' });
        }
    },

    async loginWithEmail(email, password) {
        if (IS_MOCK) {
            if (!email || !password) return { error: 'Preencha todos os campos' };
            localStorage.setItem('ecocrm_session', JSON.stringify({
                mock: true,
                user: {
                    email,
                    name: email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    avatar: null
                }
            }));
            return { success: true };
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { success: true, data };
    },

    async checkSession() {
        if (IS_MOCK) {
            const stored = localStorage.getItem('ecocrm_session');
            return stored ? JSON.parse(stored) : null;
        }
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    async logout() {
        if (!IS_MOCK && supabase) await supabase.auth.signOut();
        localStorage.removeItem('ecocrm_session');
        localStorage.removeItem('ecocrm_perfil');
        window.location.href = 'index.html';
    },

    // ---------- PERFIL DO USUÁRIO ----------
    async getPerfil() {
        if (IS_MOCK) {
            const stored = localStorage.getItem('ecocrm_perfil');
            if (stored) {
                return { ...MOCK_DB.perfil, ...JSON.parse(stored) };
            }
            return MOCK_DB.perfil;
        }
        const session = await this.checkSession();
        if (!session) return null;
        const { data, error } = await supabase
            .from('perfis').select('*').eq('user_id', session.user.id).single();
        if (error) return null;
        return data;
    },

    async updatePerfil(campos) {
        if (IS_MOCK) {
            const current = await this.getPerfil();
            const updated = { ...current, ...campos };
            localStorage.setItem('ecocrm_perfil', JSON.stringify(updated));

            // Atualizar sessão se o nome mudou
            if (campos.nome_completo) {
                const sessionStr = localStorage.getItem('ecocrm_session');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    session.user.name = campos.nome_completo;
                    localStorage.setItem('ecocrm_session', JSON.stringify(session));
                }
            }
            return updated;
        }
        const session = await this.checkSession();
        campos.atualizado_em = new Date().toISOString();
        const { data, error } = await supabase
            .from('perfis').update(campos).eq('user_id', session.user.id).select().single();
        if (error) throw error;
        return data;
    },

    async uploadAvatar(file) {
        if (IS_MOCK) {
            // Converter para data URL e salvar no localStorage
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    const current = JSON.parse(localStorage.getItem('ecocrm_perfil') || '{}');
                    current.avatar_url = dataUrl;
                    localStorage.setItem('ecocrm_perfil', JSON.stringify(current));
                    resolve(dataUrl);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        const session = await this.checkSession();
        const path = `avatars/${session.user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('avatars').upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        await this.updatePerfil({ avatar_url: urlData.publicUrl });
        return urlData.publicUrl;
    },

    // ---------- DATA QUERIES ----------
    async getClientes() {
        if (IS_MOCK) return MOCK_DB.clientes;
        const { data } = await supabase.from('clientes').select('*').order('nome');
        return data || [];
    },

    async getLicencas() {
        if (IS_MOCK) return MOCK_DB.licencas;
        const { data } = await supabase.from('licencas').select('*').order('vencimento');
        return data || [];
    },

    async getFinanceiro() {
        if (IS_MOCK) return MOCK_DB.financeiro;
        const { data } = await supabase.from('financeiro').select('*').order('data', { ascending: false });
        return data || [];
    },

    async getKanban() {
        if (IS_MOCK) return MOCK_DB.kanban;
        const { data } = await supabase.from('kanban').select('*');
        return data || {};
    },

    // ---------- DASHBOARD STATS (com relações) ----------
    async getDashboardStats() {
        const licencas = await this.getLicencas();
        const clientes = await this.getClientes();
        const financeiro = await this.getFinanceiro();

        const hoje = new Date();
        const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

        const vigentes = licencas.filter(l => l.status === 'vigente').length;
        const vencidas = licencas.filter(l => l.status === 'vencida').length;
        const renovando = licencas.filter(l => l.status === 'renovando').length;
        const exigencia = licencas.filter(l => l.status === 'exigencia').length;
        const vencendo30d = licencas.filter(l => {
            const venc = new Date(l.vencimento);
            return venc >= hoje && venc <= em30dias;
        }).length;

        const totalReceita = financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
        const totalDespesa = financeiro.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);
        const pendentes = financeiro.filter(f => f.status === 'pendente').reduce((s, f) => s + f.valor, 0);

        // Enrichir licenças com dados do cliente
        const licencasEnriquecidas = licencas.map(l => {
            const cliente = clientes.find(c => c.id === l.cliente_id);
            return { ...l, cliente_nome: cliente?.nome || 'Não vinculado', cliente_cidade: cliente?.cidade || '' };
        });

        return {
            totalClientes: clientes.length,
            totalLicencas: licencas.length,
            vigentes, vencidas, renovando, exigencia, vencendo30d,
            totalReceita, totalDespesa, pendentes,
            saldo: totalReceita - totalDespesa,
            licencas: licencasEnriquecidas,
            clientes,
            financeiro
        };
    },

    // ---------- RELATIONAL SEARCH ----------
    async search(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        const results = [];

        const clientes = await this.getClientes();
        const licencas = await this.getLicencas();
        const financeiro = await this.getFinanceiro();

        // Busca em clientes
        clientes.forEach(c => {
            if (c.nome.toLowerCase().includes(q) || c.cnpj.includes(q) || c.cidade.toLowerCase().includes(q) || c.tipo.toLowerCase().includes(q)) {
                results.push({
                    type: 'Cliente',
                    name: c.nome,
                    detail: `${c.cidade}/${c.estado} • ${c.status}`,
                    icon: 'domain',
                    color: 'text-emerald-400',
                    link: '#'
                });
            }
        });

        // Busca em licenças com dados do cliente
        licencas.forEach(l => {
            const cliente = clientes.find(c => c.id === l.cliente_id);
            if (l.titulo.toLowerCase().includes(q) || l.processo.includes(q) || l.orgao.toLowerCase().includes(q) || l.status.includes(q) || l.tipo.toLowerCase().includes(q)) {
                results.push({
                    type: 'Licença',
                    name: l.titulo,
                    detail: `${cliente?.nome || ''} • ${l.orgao} • ${l.status}`,
                    icon: 'description',
                    color: 'text-blue-400',
                    link: '#'
                });
            }
        });

        // Busca em financeiro
        financeiro.forEach(f => {
            if (f.cliente.toLowerCase().includes(q) || f.categoria.toLowerCase().includes(q) || (f.descricao && f.descricao.toLowerCase().includes(q))) {
                results.push({
                    type: 'Financeiro',
                    name: f.cliente,
                    detail: `${f.categoria} • ${this.formatCurrency(f.valor)} • ${f.status}`,
                    icon: 'payments',
                    color: 'text-yellow-400',
                    link: '#'
                });
            }
        });

        // Busca semântica por status
        const statusKeywords = {
            'vencida': 'vencida', 'vencido': 'vencida', 'vencendo': 'vigente',
            'urgente': 'vencida', 'atrasado': 'atrasado', 'pendente': 'pendente',
            'ativo': 'ativo', 'renovando': 'renovando', 'exigencia': 'exigencia',
        };

        if (statusKeywords[q]) {
            const targetStatus = statusKeywords[q];
            const filtered = licencas.filter(l => l.status === targetStatus);
            filtered.forEach(l => {
                const cl = clientes.find(c => c.id === l.cliente_id);
                if (!results.find(r => r.name === l.titulo)) {
                    results.push({
                        type: 'Alerta',
                        name: `${l.titulo} (${l.status.toUpperCase()})`,
                        detail: cl?.nome || '',
                        icon: 'warning',
                        color: 'text-red-400',
                        link: '#'
                    });
                }
            });
        }

        return results.slice(0, 10);
    },

    // ---------- HELPERS ----------
    getClienteById(id) {
        return MOCK_DB.clientes.find(c => c.id === id);
    },

    formatCurrency(value) {
        return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    },

    formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    },

    getDaysUntil(dateStr) {
        const now = new Date();
        const target = new Date(dateStr + 'T00:00:00');
        return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    }
};
