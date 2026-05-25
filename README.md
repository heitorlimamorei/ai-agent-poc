# AI Agent POC

POC de uma plataforma de agentes de venda com API REST, busca semantica de produtos, agente de texto com tools e agente de voz realtime plugavel.

A ideia central e provar uma arquitetura onde o dominio do produto/venda fica separado do runtime de IA. Hoje o projeto usa OpenAI para embeddings, agente de texto e voz realtime, mas a camada de voz foi organizada para aceitar outros provedores no futuro, como Google, desde que eles implementem o contrato de `VoiceModelAdapter`.

## O Que A POC Propoe

- Cadastrar produtos com embedding vetorial para busca semantica.
- Gerenciar pedidos associados a produtos.
- Iniciar e continuar sessoes de venda via texto.
- Executar um agente vendedor que pesquisa produtos, recomenda opcoes e cria pedidos usando tools.
- Expor um agente de voz realtime via WebSocket.
- Ter um playground HTML para testar conversa por voz no navegador.
- Separar profile, modelo, runtime de voz, rota WebSocket e regras de negocio para permitir multiplos agentes.

## Stack

- Bun
- TypeScript
- Hono
- Drizzle ORM
- PostgreSQL com pgvector
- Vercel AI SDK
- OpenAI chat, embeddings e Realtime API
- Zod para validacao e schemas

## Arquitetura

O projeto e dividido em camadas:

- `src/controllers`: parsing HTTP, validacao de entrada e traducao para respostas JSON.
- `src/routes`: definicao das rotas REST, OpenAPI e playground.
- `src/services`: casos de uso da aplicacao.
- `src/repositories`: acesso ao banco via Drizzle.
- `src/entities` e `src/dtos`: contratos de dominio e transporte.
- `src/ai`: agentes, toolkit e adaptadores de tools para texto/realtime.
- `src/adpters`: adaptadores externos, como banco, Vercel AI SDK e OpenAI Realtime.
- `src/voice`: contratos e runtime agnosticos para voz.
- `src/websocket`: roteador WebSocket em cima do Bun.

## Agentes

### Agente De Texto

O agente de texto principal e o vendedor em `src/ai/agents/seller.ts`.

Ele usa tools do toolkit de venda para:

- buscar produtos;
- criar pedidos;
- encerrar a venda quando um pedido e criado.

Esse agente e usado pelos endpoints de sessoes de venda:

- `POST /sales`
- `POST /sales/:sessionId/messages`

### Agente De Voz

O agente de voz usa uma separacao em quatro partes:

- `VoiceAgentProfile`: definicao pura do agente, com `id`, `instructions`, `model`, `voice` e `tools`.
- `VoiceModelAdapter`: contrato agnostico para criar uma conexao realtime com um provedor.
- `NewVoiceAgent`: junta `profile + model adapter`.
- `VoiceRealtimeSession`: conecta canal de voz, agente realtime, transcripts e tool calls.

O seller voice profile fica em:

`src/voice/seller/seller-voice-profile.ts`

As regras especificas de venda ficam em hooks:

`src/voice/seller/seller-voice-session.ts`

O runtime generico fica em:

`src/voice/sessions/realtime-voice-session.ts`

O adapter da OpenAI fica em:

`src/adpters/openai-realtime.ts`

Esse desenho permite criar novos agentes registrando outro profile, outro conjunto de tools, outro path WebSocket e, se necessario, outro provider.

## Endpoints

### Documentacao

- `GET /docs`: Swagger UI.
- `GET /openapi.json`: documento OpenAPI.
- `GET /health`: health check.

### Produtos

- `POST /products`: cria um produto e gera embedding.
- `GET /products`: lista produtos.
- `GET /products?search=...`: busca produtos por similaridade semantica.

Payload de produto:

```json
{
  "url": "https://example.com/product",
  "country": "BR",
  "adValue": 120.5,
  "description": "Tenis para corrida em rua",
  "photoUrl": "https://example.com/photo.jpg"
}
```

### Pedidos

- `POST /orders`: cria pedido.
- `GET /orders`: lista pedidos.
- `GET /orders/:id`: busca pedido.
- `PATCH /orders/:id`: atualiza pedido.
- `DELETE /orders/:id`: remove pedido.

Payload de pedido:

```json
{
  "customerName": "Maria",
  "productId": "00000000-0000-0000-0000-000000000000"
}
```

### Sessoes De Venda Por Texto

- `POST /sales`: inicia uma sessao de venda.
- `POST /sales/:sessionId/messages`: continua uma sessao existente.

Payload:

```json
{
  "message": "Estou procurando um tenis para correr na rua"
}
```

Resposta:

```json
{
  "sessionId": "00000000-0000-0000-0000-000000000000",
  "response": "Resposta do agente",
  "orderId": null,
  "endedAt": null
}
```

### Voz

- `GET /voice/seller`: HTML de teste para conversar com o agente de voz pelo navegador.
- `WS /voice/seller/ws`: WebSocket do agente seller.

Exemplo local:

```text
ws://localhost:3000/voice/seller/ws
```

Formatos de audio aceitos por query string:

```text
/voice/seller/ws?format=audio/pcm
/voice/seller/ws?format=audio/pcma
/voice/seller/ws?format=audio/pcmu
```

## Fluxo De Voz

1. O navegador abre `/voice/seller`.
2. O HTML conecta no WebSocket `/voice/seller/ws`.
3. `BunWebSocketVoiceChannel` traduz mensagens WebSocket em eventos de audio/controle.
4. `VoiceRealtimeSession` conecta o canal ao agente realtime.
5. `OpenAiRealtimeAdapter` cria a sessao OpenAI Realtime com instructions, tools, modelo, voz e VAD.
6. A OpenAI retorna audio, transcripts e tool calls.
7. `VoiceRealtimeSession` executa tools e envia resultados de volta ao modelo.
8. Hooks do seller persistem transcripts, fecham sessoes e associam pedidos quando necessario.

## Como Criar Outro Agente De Voz

Crie um profile:

```ts
const supportProfile = {
  id: "support-agent",
  instructions: "Voce e um agente de suporte.",
  tools: supportTools,
};
```

Crie o agente com um model adapter:

```ts
const supportAgent = NewVoiceAgent({
  model: adpters.openAiRealtime.newModel(),
  profile: supportProfile,
});
```

Registre um path:

```ts
NewVoiceAgentRegistry([
  {
    agent: supportAgent,
    path: "/voice/support/ws",
  },
]);
```

Se o agente precisar de persistencia, auditoria ou acoes de negocio, adicione hooks:

```ts
{
  agent: supportAgent,
  path: "/voice/support/ws",
  hooks: {
    async onStart(context) {
      return { sessionId: context.channelId };
    },
    async onTranscript(transcript, context) {
      // persistir transcript
    },
    async onToolResult(result, context) {
      return { type: "none" };
    },
  },
}
```

## Configuracao Local

Suba o Postgres com pgvector:

```bash
docker compose up -d
```

Instale dependencias:

```bash
bun install
```

Configure `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_agent_poc
OPENAI_API_KEY=sk-...
PORT=3000
HOSTNAME=0.0.0.0
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin
VOICE_AUDIO_FORMAT=audio/pcmu
```

Rode migrations:

```bash
bun run db:migrate
```

Inicie em desenvolvimento:

```bash
bun run dev
```

Abra:

```text
http://localhost:3000/docs
http://localhost:3000/voice/seller
```

## Scripts

```bash
bun run dev            # inicia com watch
bun run start          # inicia sem watch
bun run test           # roda testes
bun run typecheck      # checa TypeScript
bun run lint           # roda ESLint
bun run format:check   # checa formatacao com Biome
bun run format         # aplica formatacao
bun run check          # typecheck + lint + format:check
bun run db:generate    # gera migration Drizzle
bun run db:migrate     # aplica migrations
bun run db:studio      # abre Drizzle Studio
```

## Banco De Dados

Tabelas principais:

- `products`: produtos e embeddings vetoriais.
- `orders`: pedidos criados a partir de produtos.
- `sale_sessions`: sessoes de venda.
- `sale_messages`: historico de mensagens das sessoes.

A busca semantica usa embeddings de 1536 dimensoes e indice HNSW com `vector_cosine_ops`.

## Estado Atual E Proximos Passos

Esta POC ja demonstra:

- fluxo completo de venda por texto;
- fluxo completo de voz realtime;
- execucao de tools por agentes;
- persistencia de sessoes e mensagens;
- separacao entre dominio, runtime de voz e provider OpenAI;
- registro de agentes preparado para multiplos agentes.

Melhorias recomendadas antes de producao:

- autenticar WebSockets e endpoints sensiveis;
- validar `Origin` nas conexoes WebSocket;
- adicionar rate limit e limites de duracao de sessao;
- adicionar timeout e auditoria para tool calls;
- implementar observabilidade estruturada por `sessionId` e `agentId`;
- criar testes unitarios do payload do adapter OpenAI;
- implementar outro `VoiceModelAdapter` para provar troca de provider.
