---
name: auto-model
description: >
  Seleciona automaticamente o modelo Claude mais adequado (haiku/sonnet/opus)
  baseado na complexidade da tarefa. Use esta skill SEMPRE no início de qualquer
  pedido do usuário neste projeto, antes de executar qualquer ação. Ela classifica
  a tarefa e direciona o trabalho para o sub-agente ou modelo correto, economizando
  tokens sem perder qualidade.
---

# Auto-Model: Seleção Automática de Modelo

## Princípio

Modelos caros existem para raciocínio complexo. Tarefas mecânicas ou de leitura
não precisam de Opus — Haiku é mais rápido e 20x mais barato. Sonnet cobre 80%
do trabalho de desenvolvimento com boa relação custo-benefício.

A regra de ouro: **use o modelo mais leve que consegue fazer o trabalho bem.**

---

## Classificação de Complexidade

### 🟢 SIMPLES → Haiku (`model: "haiku"`)

Tarefas mecânicas, sem raciocínio profundo. Exemplos:
- Alterar texto, label, versão, cor
- Remover um elemento da UI (card, botão, seção)
- Buscar um valor no banco de dados (SELECT simples)
- Ler um arquivo e reportar o conteúdo
- Commit e push de alterações já feitas
- Verificar se algo existe (arquivo, variável, import)
- Trocar um import, renomear uma variável
- Atualizar uma string no CSS ou HTML

**Sinal:** a tarefa tem menos de ~3 passos e não exige decisão de design.

---

### 🟡 MÉDIO → Sonnet (`model: "sonnet"`)

Desenvolvimento normal. Exige entender contexto e tomar decisões técnicas
razoáveis, mas dentro de padrões estabelecidos. Exemplos:
- Corrigir um bug com causa identificada
- Adicionar uma feature em uma página existente
- Integrar um novo componente (ex: DateRangePicker)
- Fazer deploy via CLI
- Ajustar lógica de filtro ou busca
- Adaptar código para um novo requisito
- Resolver conflito de merge simples
- Escrever uma query SQL moderada

**Sinal:** a tarefa tem 3–10 passos e segue padrões do projeto.

---

### 🔴 COMPLEXO → Opus (sub-agente com `model: "opus"`) ou contexto atual

Raciocínio arquitetural, múltiplos arquivos interdependentes, decisões com
consequências amplas. Exemplos:
- Criar uma página inteiramente nova
- Refatoração que muda a estrutura de vários arquivos
- Resolver bugs com causa desconhecida (diagnóstico profundo)
- Decisões de banco de dados com impacto em produção
- Migração de dependências com breaking changes
- Design de sistema ou API

**Sinal:** a tarefa tem 10+ passos, múltiplos arquivos, ou consequências irreversíveis.

---

## Como Aplicar

### Quando usar sub-agentes

Para tarefas simples ou médias que são bem delimitadas, delegue via `Agent`:

```
# Simples
Agent({model: "haiku", description: "...", prompt: "..."})

# Médio
Agent({model: "sonnet", description: "...", prompt: "..."})

# Complexo
Agent({model: "opus", description: "...", prompt: "..."})
```

### Quando trabalhar diretamente

Se a tarefa exige contexto amplo desta conversa (histórico de decisões, arquivos
já lidos, estado atual do projeto), trabalhe diretamente e apenas avise o usuário
sobre o modelo ideal:

- **Simples no modelo atual (Opus/Sonnet):** avise → `"💡 Tarefa simples — você pode economizar tokens usando /model claude-haiku-4-5"`
- **Complexo no modelo atual (Haiku):** avise → `"⚠️ Tarefa complexa — recomendo mudar para /model claude-sonnet-4-6 ou opus"`
- **Modelo adequado:** siga sem aviso.

---

## Referência Rápida do Projeto EcoFin

Contexto específico para classificar pedidos neste projeto:

| Pedido | Modelo |
|--------|--------|
| Mudar texto/label/versão na sidebar | Haiku |
| Remover card/elemento da UI | Haiku |
| Commit + push + deploy | Haiku |
| Busca no Supabase (SELECT) | Haiku |
| Corrigir bug de CNPJ/filtro | Sonnet |
| Adicionar componente (DatePicker, etc.) | Sonnet |
| Novo filtro/feature em página existente | Sonnet |
| Corrigir z-index/stacking context | Sonnet |
| Criar página nova do zero | Opus |
| Refatorar múltiplos arquivos | Opus |
| Diagnosticar bug desconhecido | Opus |
| Decisão de schema no banco | Opus |

---

## Formato de Resposta

Ao receber um pedido, classifique brevemente (apenas 1 linha) antes de agir:

```
🟢 Simples (Haiku) — alterando texto da sidebar...
🟡 Médio (Sonnet) — corrigindo filtro de CNPJ...
🔴 Complexo (Opus) — criando página de relatórios...
```

Não faça disso um ritual longo — classifique e execute. O objetivo é agir com
o modelo certo, não escrever ensaios sobre a classificação.
