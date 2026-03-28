import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: any = null;

export const initGemini = (apiKey: string) => {
  if (!apiKey) { genAI = null; return; }
  genAI = new GoogleGenerativeAI(apiKey);
};

export const getFineResponse = async (prompt: string, contextData: any) => {
  if (!genAI) return handleOfflineFineResponse(prompt, contextData);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é a Fine, Assistente Virtual Inteligente do EcoFin Manager — sistema de gestão de licenciamento ambiental e finanças.

DOMÍNIO:
- LICENCIAMENTO: LP (Licença Prévia), LI (Licença de Instalação), LO (Licença de Operação), CLUA, Dispensa, Outorgas (Captação Superficial, Subterrânea, Lançamento, Barragem).
  • Prazos típicos: LP=2-4 anos, LI=6 anos, LO=10 anos, Outorgas=10-15 anos.
  • Renovação deve iniciar: LP 60 dias antes, LI 90 dias, LO 120 dias, Outorgas 180 dias.
- FINANCEIRO: faturas mensais, contratos, NFS-e via Focus NF-e, status (pendente/pago/cancelado).
- CLIENTES: cadastro com CNPJ, multi-tenant, cada usuário vê apenas seus clientes.
- KANBAN: fases do processo (planejamento → coleta de dados → protocolado → em exigências → concluído).
- COMPLIANCE: licencas_validas / total_licencas × 100 = taxa de conformidade.

COMPORTAMENTO:
- Responda sempre em Português do Brasil, de forma técnica e amigável.
- Use emojis moderadamente para destacar urgências (🔴 crítico, 🟡 atenção, 🟢 ok).
- Quando alertas existirem, priorize os mais urgentes primeiro.
- Ofereça sugestões proativas (ex: "Recomendo iniciar a renovação da LO da empresa X").
- Você se chama Fine.`
    });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "Contexto atual da plataforma: " + JSON.stringify(contextData, null, 0) }] },
        { role: "model", parts: [{ text: "Contexto recebido. Pronta para ajudar!" }] },
      ],
    });

    const result = await chat.sendMessage([{ text: prompt }]);
    return result.response.text();
  } catch (error: any) {
    console.warn("Falha no Gemini:", error);
    return handleOfflineFineResponse(prompt, contextData);
  }
};

function handleOfflineFineResponse(prompt: string, ctx: any): string {
  const p = prompt.toLowerCase();

  if (p.includes("olá") || p.includes("oi") || p.includes("bom dia") || p.includes("boa tarde") || p.includes("boa noite")) {
    const alertas = ctx?.alertas_criticos || 0;
    if (alertas > 0) return `Olá! 👋 Sou a Fine. Atenção: há ${alertas} licença(s) em zona de alerta agora. Digite "alertas" para ver.`;
    return "Olá! Sou a Fine 💚. Tudo certo por aqui! Como posso ajudar com vencimentos, faturas ou licenças?";
  }

  if (p.includes("alert") || p.includes("urgente") || p.includes("vencendo")) {
    const v = ctx?.alertas || ctx?.proximos_vencimentos || [];
    if (v.length === 0) return "🟢 Nenhuma licença em alerta no momento!";
    let resp = `🔴 ${v.length} licença(s) requerem atenção:\n\n`;
    v.slice(0, 5).forEach((item: any) => {
      const data = item.vencimento ? item.vencimento.split('T')[0].split('-').reverse().join('/') : '—';
      resp += `• **${item.tipo}** — ${item.cliente}\n  ⏳ Vence: ${data}\n`;
    });
    return resp;
  }

  if (p.includes("vencimento") || p.includes("vencer") || p.includes("licença") || p.includes("outorga")) {
    const v = ctx?.proximos_vencimentos || [];
    if (v.length === 0) return "🟢 Nenhuma licença ou outorga próxima do vencimento!";
    let resp = "Próximos vencimentos:\n\n";
    v.forEach((item: any) => {
      const data = item.vencimento ? item.vencimento.split('T')[0].split('-').reverse().join('/') : '—';
      resp += `📝 **${item.tipo}** — ${item.cliente}\n  ⏳ ${data}\n`;
    });
    return resp;
  }

  if (p.includes("fatura") || p.includes("pagamento") || p.includes("financeiro")) {
    const f = ctx?.faturas_recentes || [];
    if (f.length === 0) return "Sem faturas recentes no painel.";
    let resp = "Faturas recentes:\n\n";
    f.forEach((item: any) => {
      const val = Number(item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      resp += `💰 ${val} — Status: **${item.status}**\n`;
    });
    return resp;
  }

  if (p.includes("kanban") || p.includes("processo") || p.includes("etapa")) {
    const k = ctx?.kanban || [];
    if (k.length === 0) return "Nenhum processo no Kanban no momento.";
    const por_fase: Record<string, number> = {};
    k.forEach((c: any) => { por_fase[c.fase] = (por_fase[c.fase] || 0) + 1; });
    let resp = "📋 Kanban atual:\n\n";
    Object.entries(por_fase).forEach(([fase, count]) => { resp += `• ${fase}: ${count} card(s)\n`; });
    return resp;
  }

  if (p.includes("resumo") || p.includes("dashboard") || p.includes("status")) {
    const s = ctx?.stats;
    if (!s) return "Não foi possível carregar o resumo.";
    const compliance = s.compliance_rate ? Number(s.compliance_rate).toFixed(1) : '—';
    return `📊 **Resumo:**\n• Clientes: ${s.total_clientes ?? '—'}\n• Licenças: ${s.total_licencas ?? '—'}\n• Válidas: ${s.licencas_validas ?? '—'}\n• Vencidas: ${s.licencas_vencidas ?? '—'}\n• Compliance: ${compliance}%`;
  }

  if (p.includes("cliente")) {
    const total = ctx?.stats?.total_clientes ?? ctx?.clientes_count ?? '—';
    return `👥 Total de clientes cadastrados: **${total}**. Para detalhes, acesse a página de Clientes.`;
  }

  return "Estou em modo offline no momento. Tente: 'alertas', 'vencimentos', 'faturas', 'resumo' ou 'kanban'. 🤓";
}
