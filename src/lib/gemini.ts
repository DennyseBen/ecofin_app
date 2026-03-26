import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchDashboardStats } from "./api";

let genAI: any = null;

export const initGemini = (apiKey: string) => {
  if (!apiKey) {
    genAI = null;
    return;
  }
  genAI = new GoogleGenerativeAI(apiKey);
};

export const getFineResponse = async (prompt: string, contextData: any) => {
  if (!genAI) {
    return handleOfflineFineResponse(prompt, contextData);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `Você é a Fine, a Assistente Virtual Inteligente do EcoFin Manager.
O EcoFin Manager é um software de gestão de licenciamento ambiental (licenças, outorgas) e finanças (faturas, contratos).

DOMÍNIO DE CONHECIMENTO:
1. LICENCIAMENTO: Tipos (LP, LI, LO, Dispensa, CLUA), prazos de renovação.
2. FINANCEIRO: Faturas, Contratos.
3. CLIENTES: Cadastro, endereço via CNPJ.

COMPORTAMENTO:
- Seja prestativa, técnica porém amigável.
- Responda em Português do Brasil.
- Use emojis moderadamente.
- Se não tiver dados no contexto, explique amigavelmente.
- Você chama-se Fine.`
    });

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "Contexto Atualizado: " + JSON.stringify(contextData) }],
        },
        {
          role: "model",
          parts: [{ text: "Ok, recebi os dados atuais da plataforma." }],
        },
      ],
    });

    const result = await chat.sendMessage([{ text: prompt }]);
    return result.response.text();
  } catch (error: any) {
    console.warn("Falha no Gemini:", error);
    return handleOfflineFineResponse(prompt, contextData);
  }
};

function handleOfflineFineResponse(prompt: string, contextData: any): string {
  const p = prompt.toLowerCase();

  if (p.includes("olá") || p.includes("oi") || p.includes("bom dia") || p.includes("boa tarde")) {
    return "Olá! Sou a Fine 💚. No momento minha Inteligência Artificial avançada (Gemini) está offline pois a Chave de API não foi configurada nas Configurações. Mas eu ainda posso te ajudar com funções básicas! Pergunte sobre 'vencimentos' ou 'faturas'.";
  }

  if (p.includes("vencimento") || p.includes("vencer") || p.includes("licença") || p.includes("outorga")) {
    const v = contextData?.proximos_vencimentos || [];
    if (v.length === 0) return "Não identifiquei nenhuma licença ou outorga próxima do vencimento nos dados atuais! 🎉 Tudo certo.";

    let resp = "Aqui estão as licenças/outorgas que requerem atenção logo:\n\n";
    v.forEach((item: any) => {
      let dataStr = item.vencimento;
      if (dataStr) {
        const [y, m, d] = dataStr.split('T')[0].split('-');
        dataStr = `${d}/${m}/${y}`;
      }
      resp += `📝 **${item.tipo}** - ${item.cliente}\n⏳ Vence em: ${dataStr || 'Não informada'}\n\n`;
    });
    return resp;
  }

  if (p.includes("fatura") || p.includes("pagamento") || p.includes("financeiro")) {
    const f = contextData?.faturas_recentes || [];
    if (f.length === 0) return "Não encontrei faturas recentes cadastradas no seu painel.";

    let resp = "Aqui estão os valores das suas faturas recentes:\n\n";
    f.forEach((item: any) => {
      resp += `💰 R$ ${Number(item.valor).toFixed(2).replace('.', ',')} - Status: ${item.status}\n`;
    });
    return resp;
  }

  if (p.includes("resumo") || p.includes("dashboard") || p.includes("estatística")) {
    const s = contextData?.stats;
    if (!s) return "Não consegui carregar os dados gerais.";
    return `📊 **Resumo Atual:**\n- Clientes Ativos: ${s.clientesAtivos}\n- Licenças Ativas: ${s.licencasAtivas}\n- Faturas Pendentes: ${s.faturasPendentes}`;
  }

  return "Desculpe, como minha chave de Inteligência Artificial não está ativa, eu só entendo comandos simples como 'vencimentos', 'faturas' ou 'resumo'. Configure a Chave de API nas Configurações para eu usar 100% da minha inteligência! 🤓";
}
