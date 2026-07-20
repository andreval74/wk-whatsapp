# Conexão real com o WhatsApp — Design

## Contexto

O WK WhatsApp hoje é uma SPA 100% estática (HTML/JS/CSS servida pelo XAMPP, sem backend) que lê exports `.zip`/`.txt` do WhatsApp, agrupa mensagens por dia (`groupIntoDayBlocks`) e categoriza automaticamente por frequência de palavras (`autoCategorize`), tudo em `assets/js/app.js`.

Este design adiciona uma segunda forma de alimentar o sistema: conectar de verdade numa conta do WhatsApp (via QR code, como o WhatsApp Web) e ler contatos/mensagens reais, combinando com o que já foi importado de exports.

## Objetivo

- Permitir que qualquer pessoa conecte sua própria conta do WhatsApp via QR code.
- Listar contatos reais e, ao selecionar um, buscar as mensagens dele.
- Combinar essas mensagens com o que já existe no export importado (sem duplicar).
- Rodar o mesmo pipeline de agrupamento/categorização que já existe hoje.
- Suporte a múltiplas sessões simultâneas (uma por pessoa/QR).
- **Somente leitura** — o sistema nunca envia mensagens nem altera nada no WhatsApp do usuário.

## Fora de escopo

- Envio de mensagens, respostas automáticas, marcação de lida, arquivamento.
- Integração com a API oficial da Meta (Cloud API) — não serve pro caso de uso (não dá acesso a histórico/contatos pessoais).
- Garantia de histórico completo "desde sempre" — o WhatsApp Web só sincroniza o que o celular/nuvem ainda guarda.

## Arquitetura

```
[Navegador: index.html/app.js]  <--HTTP/WS-->  [Node.js: server/ (Baileys)]  <--WebSocket-->  [WhatsApp]
        |                                              |
        └── continua lendo data/*.json (export)        └── server/auth/<sessionId>/ (credenciais por sessão)
```

- Frontend estático atual não muda de lugar nem de stack; ganha uma seção nova.
- Backend novo (`wk-whatsapp/server/`), processo Node.js separado, rodando ao lado do XAMPP (ex: porta 3010). O XAMPP/PHP continua servindo só os arquivos estáticos.
- Biblioteca: **Baileys** (protocolo multi-device do WhatsApp via WebSocket puro — sem Chrome/Puppeteer).

### Risco de ToS

Baileys é uma biblioteca não-oficial que automatiza o protocolo do WhatsApp Web. Isso tecnicamente viola os Termos de Uso do WhatsApp; o risco prático é a conta ser sinalizada em uso muito intenso. Para leitura pessoal (sem envio em massa, sem spam), é o padrão aceito pela maioria das ferramentas open-source do gênero. Usuário está ciente e optou por seguir mesmo assim.

## Backend (`server/`)

### `sessionManager.js`
- Mapa em memória: `sessionId → { sock, status, contatos }`.
- `POST /session/new` — cria uma sessão nova, retorna `sessionId`.
- Ao autenticar, salva credenciais em `server/auth/<sessionId>/` (permite reconectar sozinho depois, sem novo QR).
- Isola erros por sessão: uma sessão cair não derruba as outras.
- No boot do servidor, reconecta automaticamente todas as sessões que já têm credenciais salvas em `server/auth/`.

### `whatsappService.js`
- Usa Baileys para:
  - Listar conversas/contatos (`chats`).
  - Buscar histórico de mensagens de um contato (`fetchMessageHistory`).
  - Escutar mensagens novas em tempo real (`messages.upsert`).

### API HTTP (Express)
- `GET /session/:id/status` — `aguardando_qr` | `conectado` | `desconectado`
- `GET /session/:id/contacts` — lista de contatos/conversas reais
- `GET /session/:id/messages/:contactId` — mensagens do contato (sincronizadas + ao vivo)
- `DELETE /session/:id` — desconecta e apaga a sessão

### WebSocket (`/session/:id/live`)
- Envia QR code (base64) durante o login, até escanear ou expirar.
- Empurra mensagens novas em tempo real.
- Empurra mudanças de status da sessão.

## Frontend — nova seção "WhatsApp ao vivo"

- Botão "Conectar WhatsApp" → modal com QR code (via WebSocket) → fecha ao conectar.
- Lista de contatos reais, reaproveitando o componente visual de lista já existente.
- Ao clicar num contato: busca mensagens via API, converte pro formato esperado por `groupIntoDayBlocks()`, roda `autoCategorize()` — reaproveitando 100% da lógica de agrupamento/categorização já existente, sem duplicar código.

## Combinação com o export importado

- Ao carregar um contato: mensagens do export (se existir correspondência por número/nome) + mensagens do WhatsApp ao vivo.
- **Dedup**: comparação por `(remetente, timestamp, texto)` — mensagem já presente no export não é duplicada.
- Resultado final passa pelas mesmas funções (`groupIntoDayBlocks`, `autoCategorize`) já usadas hoje, mantendo a experiência de busca/filtro idêntica à atual.

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| QR expira (~20s) | Gera novo automaticamente; timeout total de 2 min sem escanear → mostra "tente novamente" |
| Logout pelo celular | Detecta, limpa credenciais salvas, avisa frontend, não tenta reconectar |
| Queda de rede | Reconecta com backoff; não apaga sessão |
| Erro em uma sessão | Isolado — não afeta outras sessões conectadas |
| Reinício do servidor | Sessões já autenticadas reconectam sozinhas usando credenciais salvas |

## Testes

A conexão real depende de um número de telefone escaneando um QR — não automatizável em teste unitário.

- **Automatizado**: funções puras (conversão de mensagem pro formato de `groupIntoDayBlocks`, lógica de dedup export+ao vivo) testadas com fixtures.
- **Manual**: ao final da implementação, conectar uma conta real, validar lista de contatos, abrir um contato, conferir agrupamento/categorização e merge sem duplicação.

## Decisões confirmadas com o usuário

1. Conta: qualquer pessoa pode conectar a própria conta via QR (não é só uso pessoal do dono do projeto).
2. Escopo de ação: somente leitura ao vivo — sem envio/alteração no WhatsApp.
3. Profundidade de histórico: sincronizar o que o WhatsApp entregar + combinar com o export já importado.
4. Biblioteca: Baileys, ciente do risco de ToS.
5. Sessões: múltiplas simultâneas, uma por pessoa/QR.
