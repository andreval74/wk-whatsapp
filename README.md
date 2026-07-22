# WK WhatsApp

Uma ferramenta pessoal para análise e relatório de conversas do WhatsApp, com suporte para dois modos de operação: importação de arquivos estáticos e conexão em tempo real.

## 📋 O que faz

**WK WhatsApp** permite que você analise e categorize automaticamente suas conversas do WhatsApp. O sistema agrupa mensagens por dia, identifica padrões por assunto (ex: "Financeiro/Pagamentos", "Imóveis/Aluguel") e oferece buscas avançadas para explorar seus dados.

### Modo 1: Exportação Estática
- Importe um export do WhatsApp (`.zip` ou `.txt`)
- Tudo roda **100% no navegador** — nenhuma transferência de dados para servidor
- Categorização automática por frequência de palavras
- Busca e filtros interativos
- Salve suas buscas favoritas

### Modo 2: Conexão ao Vivo (em desenvolvimento)
- Conecte sua conta real do WhatsApp via QR code
- Sincronize contatos e histórico de mensagens em tempo real
- Mesmos recursos de análise e categorização
- **Somente leitura** — a ferramenta nunca envia mensagens
- Usa a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys) (implementação não-oficial do protocolo WhatsApp Web)

## 🛠️ Tech Stack

### Frontend
- **HTML/CSS/JavaScript vanilla** (sem frameworks)
- `fflate.js` para parsing de arquivos `.zip`

### Backend (Modo Ao Vivo)
- **Node.js** (ESM)
- **Express 5.x** para HTTP server
- **@whiskeysockets/baileys 6.7.23** para protocolo WhatsApp
- **qrcode** para geração de QR codes
- **ws** para WebSocket (real-time updates)

### Testes
- `node --test` (test runner nativo do Node.js)

## 📁 Estrutura do Projeto

```
wk-whatsapp/
├── index.html                  # Página principal da SPA
├── assets/
│   ├── css/style.css           # Estilos
│   └── js/
│       ├── app.js              # Lógica principal (parsing, categorização, busca)
│       ├── live.js             # UI para modo ao vivo (QR code, contatos)
│       └── fflate.js           # Lib para descompactar ZIP
├── server/                     # Backend Node.js (modo ao vivo)
│   ├── index.js                # Entry point
│   ├── app.js                  # Configuração Express
│   ├── api.js                  # Rotas HTTP
│   ├── liveSocket.js           # WebSocket handler
│   ├── whatsappService.js      # Integração Baileys
│   ├── sessionManager.js       # Gerência de sessões
│   ├── messageAdapter.js       # Adaptação de mensagens
│   ├── exportData.js           # Utilitários de export
│   ├── sessionStore.js         # Persistência de sessões
│   ├── textUtils.js            # Processamento de texto
│   ├── paths.js                # Utilitários de caminhos
│   ├── package.json / package-lock.json
│   ├── .gitignore
│   └── test/                   # Suite de testes
├── docs/                       # Documentação e specs
└── data/                       # Pasta para dados de sessão (local)
```

## 🚀 Como Usar

### Modo Exportação Estática (sem backend)

1. Abra `index.html` em seu navegador (pode ser via XAMPP ou qualquer servidor HTTP estático)
2. Clique em "Importar Conversa"
3. Selecione um arquivo `.zip` ou `.txt` do WhatsApp
4. A app carregará e categorizará as mensagens automaticamente
5. Use a barra de busca para explorar suas conversas

### Modo Conexão ao Vivo (com backend Node.js)

#### Pré-requisitos
- Node.js 18+ instalado
- Git

#### Setup Inicial

```bash
# Clone o repositório
git clone https://github.com/andreval74/wk-whatsapp.git
cd wk-whatsapp

# Instale dependências do backend
cd server
npm install
cd ..

# Inicie o servidor backend
cd server
npm start
# O servidor rodará em http://localhost:3010 (loopback-only, seguro)
```

#### No Navegador
1. Abra `index.html` (via XAMPP em `http://localhost` ou outro servidor estático)
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR code com seu telefone
4. Seus contatos e mensagens aparecerão em tempo real
5. Use os mesmos recursos de busca e análise do modo estático

## 🧪 Testes

```bash
cd server
npm test
```

Roda a suite de testes via `node --test`.

## ⚠️ Avisos Importantes

- **Baileys é não-oficial**: A conexão ao vivo usa uma implementação reversa do protocolo WhatsApp Web. Use por sua conta e risco e respeite a [Licença do Baileys](https://github.com/WhiskeySockets/Baileys/blob/master/LICENSE).
- **Somente leitura**: Esta ferramenta **nunca** envia mensagens ou modifica dados no WhatsApp, apenas lê.
- **Privacidade**: No modo ao vivo, suas mensagens ficam na memória do servidor (sessão em RAM). O arquivo de sessão é `.gitignore`-d por padrão.
- **Sem banco de dados**: Tudo é mantido em memória ou em arquivos locais — nada é enviado a servidores externos.

## 📝 Exemplos de Categorias

O sistema reconhece automaticamente padrões como:
- **Financeiro/Pagamentos**: "boleto", "crédito", "conta", "pix", "transferência"
- **Imóveis/Aluguel**: "aluguel", "imóvel", "casa", "apartamento", "alugada"
- **Trabalho**: "reunião", "projeto", "deadline", "cliente"
- ... e muitas outras, baseadas em frequência de palavras

Você pode adicionar suas próprias categorias editando o arquivo de categorias.

## 📄 Licença

Use por sua conta e risco. Este é um projeto pessoal de hobby.

## 🔗 Links Úteis

- [Baileys - WhatsApp Web API](https://github.com/WhiskeySockets/Baileys)
- [Express.js](https://expressjs.com/)
- [WebSocket (ws)](https://github.com/websockets/ws)

---

**Dúvidas ou sugestões?** Abra uma issue no GitHub!
