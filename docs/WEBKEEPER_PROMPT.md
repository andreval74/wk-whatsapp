# WEBKEEPER - Universal Development Prompt

## 1. CONTEXTO & IDENTIDADE

Você está desenvolvendo para o **WebKeeper** — um sistema de aplicações web modernas que exportam para Elementor. Todos os produtos seguem o mesmo design system, comportamentos e padrões de código. Este prompt é a fonte de verdade para todas as decisões de desenvolvimento.

**Princípios**:
- Design escuro, minimalista, profissional
- Foco em clareza visual e eficiência
- Mobile-first, totalmente responsivo
- Acessibilidade como requisito, não feature

---

## 2. DESIGN SYSTEM (Obrigatório)

### Paleta de Cores

| Papel | Cor | Hex | Uso |
|-------|-----|-----|-----|
| Fundo Principal | bg-base | #0A0A0B | Camada base (body) |
| Fundo Secundário | bg-surface | #1A1A1E | Cards, containers |
| Destaque | gold | #FFC107 | Botões CTA, ícones ativos, borders de foco |
| Borda Sutil | border-subtle | #2A2A2E | Divisões, separadores |
| Texto Principal | text-primary | #FFFFFF | Corpo de texto |
| Texto Secundário | text-secondary | #A0A0A6 | Labels, hints, metadados |
| Sucesso | success | #4CAF50 | Status positivo |
| Erro | error | #F44336 | Status negativo |
| Aviso | warning | #FF9800 | Status de atenção |

### Tipografia

```
Textos & UI: Inter (sans-serif)
  - H1: 32px, weight 700, line-height 1.2
  - H2: 24px, weight 600, line-height 1.3
  - H3: 18px, weight 600, line-height 1.4
  - Body: 14px, weight 400, line-height 1.5
  - Small: 12px, weight 400, line-height 1.4

Código & Monospace: JetBrains Mono
  - Tamanho: 12px-14px
  - Line-height: 1.6
  - Letter-spacing: 0.3px
```

### Spacing (8px base)

```
xs: 4px   | Micro (inline gaps, tight spacing)
sm: 8px   | Pequeno (padding cards, gaps)
md: 16px  | Médio (default spacing)
lg: 24px  | Grande (sections, containers)
xl: 32px  | Extra grande (major sections)
xxl: 48px | Huge (page margins)
```

### Sombras & Profundidade

```
Sombra baixa:   0 2px 4px rgba(0,0,0,0.3)
Sombra média:   0 4px 12px rgba(0,0,0,0.4)
Sombra alta:    0 12px 32px rgba(0,0,0,0.5)
```

### Raios de Borda

```
xs: 4px    | Inputs, small components
sm: 6px    | Cards, modais
md: 8px    | Buttons, larger components
lg: 12px   | Featured areas
```

---

## 3. COMPONENTES PADRÃO

### 3.1 Header (Sticky)

**Requisitos**:
- Position: `sticky` top 0, z-index alto
- Height: 56px (mobile), 64px (desktop)
- Background: `bg-base` com `border-bottom: 1px border-subtle`
- Conteúdo: Logo esquerda | Centro (título/breadcrumb) | Direita (versão + status + ações)
- Shadow: sombra baixa ao scroll
- Totalmente responsivo

**Comportamento**:
- Logo é clicável e volta para home/dashboard
- Versão é small text, text-secondary
- Status mostra indicador visual (online/offline/processing)

### 3.2 Subbar (Barra de Suporte)

**Requisitos**:
- Height: 40px
- Background: `bg-surface`
- Border-bottom: `border-subtle`
- Conteúdo: Informações contextuais (breadcrumb, filtros, dicas)
- Typography: small, text-secondary
- Sticky abaixo do header

### 3.3 Cards

**Requisitos**:
- Background: `bg-surface`
- Border: `1px border-subtle`
- Border-radius: `md` (8px)
- Padding: `md` (16px) padrão, `lg` (24px) para cards grandes
- Shadow: sombra baixa
- Hover: `border-gold` ou `shadow-média`
- Transition: `0.2s ease`

**Variações**:
- `.card-active`: border-gold, shadow-média
- `.card-error`: border-error (20% opacity)
- `.card-success`: border-success (20% opacity)

### 3.4 Botões

**Tipos**:

#### Primário (CTA)
- Background: `gold`, text-base (preto ou #0A0A0B)
- Padding: 8px 16px (sm), 12px 24px (md), 16px 32px (lg)
- Border-radius: `sm` (6px)
- Font-weight: 600
- Hover: background-gold (85% brightness)
- Active: background-gold (70% brightness)
- Disabled: opacity 50%

#### Secundário
- Background: transparent
- Border: `1px gold`
- Color: gold
- Hover: background-gold (10% opacity)

#### Ghost
- Background: transparent
- Border: none
- Color: text-secondary
- Hover: color: text-primary, background: bg-surface (20% opacity)

#### Pequeno (action buttons)
- Padding: 4px 8px
- Font-size: 12px
- Icon only: 32px square, centered

### 3.5 Inputs & Forms

**Requisitos**:
- Background: `bg-surface`
- Border: `1px border-subtle`
- Border-radius: `xs` (4px)
- Padding: 8px 12px
- Font-family: Inter
- Focus: `border-gold`, `outline: none`
- Placeholder: text-secondary
- Disabled: opacity 50%, cursor not-allowed
- Error: border-error, helper-text em error color

**Tipos**:
- Text input
- Textarea (resizable)
- Select dropdown
- Checkbox (custom styled)
- Radio (custom styled)
- Toggle switch

### 3.6 Modais

**Requisitos**:
- Overlay: background rgba(0,0,0,0.7), z-index 1000
- Modal container: bg-surface, border-radius `lg`, padding `lg`
- Max-width: 500px (sm), 720px (md), 90vw (mobile)
- Position: centrado (flex + transform)
- Animation: fade-in 0.3s + slide-up 0.3s
- Fechar: ESC key, click overlay, botão X

**Seções**:
```
Header (padding-bottom: md)
  ├─ Título (H2)
  └─ Botão fechar (X icon)

Body (padding: md)
  └─ Conteúdo

Footer (padding-top: md, border-top: border-subtle)
  └─ Botões de ação
```

### 3.7 Notificações & Toast

**Requisitos**:
- Position: fixed, bottom-right (desktop), bottom-center (mobile)
- Max-width: 400px
- Padding: `md`
- Border-radius: `sm`
- Border-left: 4px solid (success/error/warning)
- Animation: slide-up 0.3s
- Auto-dismiss: 5s (configurável)
- Z-index: 2000

**Tipos**:
- `.toast-success`: border-left-color: success
- `.toast-error`: border-left-color: error
- `.toast-warning`: border-left-color: warning
- `.toast-info`: border-left-color: gold

### 3.8 Loading & Status

**Animação Pulse** (para elementos em processamento):
```css
@keyframes status-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
.status-loading { animation: status-pulse 1.5s ease-in-out infinite; }
```

**Spinner** (circular loader):
- Tamanho: 24px (sm), 32px (md), 48px (lg)
- Cor: gold
- Animation: rotate 1s linear infinite

**Badges**:
- Padding: 4px 8px
- Border-radius: xs (4px)
- Font-size: 12px, weight 600
- Variações: `.badge-success`, `.badge-error`, `.badge-warning`

---

## 4. LAYOUT (Estrutura Padrão)

### 4.1 Grid 3 Colunas (Desktop)

```
Viewport lg (≥1200px):
┌─────────────────────────────────────────────────────────────────┐
│ Header (sticky)                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Subbar (sticky, abaixo do header)                               │
├──────────────────┬────────────────┬──────────────────────────────┤
│   Coluna 1       │   Coluna 2     │   Coluna 3                   │
│   38fr           │   22fr         │   40fr                       │
│  (Entrada)       │ (Análise)      │ (Saída/Exportação)          │
│                  │                │                              │
└──────────────────┴────────────────┴──────────────────────────────┘
├─────────────────────────────────────────────────────────────────┤
│ Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

**CSS Grid**:
```css
.main-grid {
  display: grid;
  grid-template-columns: 38fr 22fr 40fr;
  gap: md (16px);
  padding: lg (24px);
  height: calc(100vh - 120px); /* Descontar header + subbar + footer */
}
```

### 4.2 Responsivo (Mobile & Tablet)

```
Viewport md (768px-1199px):
Grid: 2 colunas (1fr 1fr) ou 1 coluna (1fr)

Viewport sm (<768px):
Grid: 1 coluna (1fr)
Altura: auto (não fixo)
Padding: md (16px)
```

### 4.3 Overflow & Scroll

- **Coluna 1 & 3**: Scrollável verticalmente (`overflow-y: auto`, `overflow-x: hidden`)
- **Coluna 2**: Scrollável verticalmente, conteúdo fixo em altura
- Scrollbar: customizado (thin, cor: border-subtle)

### 4.4 Footer

**Requisitos**:
- Height: 48px
- Background: bg-base
- Border-top: `1px border-subtle`
- Padding: `md`
- Conteúdo: Info mínima + versão + copyright + links

**Exemplo**:
```
© 2024 WebKeeper | v1.0.0 | Status: Online | Terms | Privacy
```

---

## 5. COMPORTAMENTO & UX

### 5.1 Transições & Animações

| Elemento | Duração | Easing | Uso |
|----------|---------|--------|-----|
| Hover de botão | 0.2s | ease-in-out | Feedback visual |
| Transição de cor | 0.2s | ease | Mudanças de estado |
| Modal appear | 0.3s | ease-out | Entrada de modal |
| Card slide | 0.25s | ease-out | Remoção de card |
| Loading pulse | 1.5s | ease-in-out | Status indeterminado |

### 5.2 Estados de Interação

**Botões**:
- `:hover` → cor mais brilhante, shadow
- `:active` → cor mais escura
- `:focus` → outline gold
- `:disabled` → opacity 50%, cursor not-allowed

**Inputs**:
- `:focus` → border-gold, shadow baixa
- `:invalid` → border-error
- `:disabled` → opacity 50%, background mais escuro

**Cards**:
- `:hover` → border-gold, shadow-média
- `:active` → background 10% mais claro
- Selecionado → border-gold, checkbox visível

### 5.3 Validação em Tempo Real

- Feedback visual imediato (sem aguardar submit)
- Ícones: ✓ (sucesso), ✗ (erro), ! (aviso)
- Mensagem helper: text-secondary para dicas, error para erros
- Desabilitar submit se há erros

### 5.4 Dark Mode

- **Always on** — não há light mode
- Alto contraste entre bg-base e text-primary
- Gold (#FFC107) é suficientemente brilhante para destaque
- Sem refúgio em branco; usar bg-surface para áreas "claras"

---

## 6. IMPLEMENTAÇÃO (Código)

### 6.1 Estrutura de Arquivos (React/Vue)

```
src/
├─ components/
│  ├─ layout/
│  │  ├─ Header.jsx
│  │  ├─ Subbar.jsx
│  │  ├─ Footer.jsx
│  │  └─ MainGrid.jsx
│  ├─ common/
│  │  ├─ Button.jsx
│  │  ├─ Card.jsx
│  │  ├─ Modal.jsx
│  │  ├─ Input.jsx
│  │  ├─ Toast.jsx
│  │  └─ Badge.jsx
│  └─ features/
│     └─ [feature-specific components]
├─ styles/
│  ├─ colors.css (ou tailwind.config.js)
│  ├─ typography.css
│  ├─ spacing.css
│  ├─ animations.css
│  └─ globals.css
├─ hooks/
│  ├─ useToast.js
│  ├─ useModal.js
│  └─ useForm.js
└─ App.jsx
```

### 6.2 CSS / Tailwind Config

**Se usar Tailwind**:
```javascript
module.exports = {
  theme: {
    colors: {
      'bg-base': '#0A0A0B',
      'bg-surface': '#1A1A1E',
      'gold': '#FFC107',
      'border-subtle': '#2A2A2E',
      'text-primary': '#FFFFFF',
      'text-secondary': '#A0A0A6',
      'success': '#4CAF50',
      'error': '#F44336',
      'warning': '#FF9800',
    },
    spacing: {
      'xs': '4px',
      'sm': '8px',
      'md': '16px',
      'lg': '24px',
      'xl': '32px',
      'xxl': '48px',
    },
    borderRadius: {
      'xs': '4px',
      'sm': '6px',
      'md': '8px',
      'lg': '12px',
    },
    fontFamily: {
      'sans': ['Inter', 'sans-serif'],
      'mono': ['JetBrains Mono', 'monospace'],
    },
  },
};
```

### 6.3 Componente Padrão (Exemplo: Button)

```jsx
export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  onClick,
  className = '',
  ...props 
}) => {
  const baseClass = 'font-semibold transition-all duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold';
  
  const variants = {
    primary: 'bg-gold text-bg-base hover:brightness-90 active:brightness-75 disabled:opacity-50',
    secondary: 'border border-gold text-gold hover:bg-gold hover:bg-opacity-10',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-surface',
  };
  
  const sizes = {
    sm: 'px-md py-xs text-sm',
    md: 'px-lg py-sm text-base',
    lg: 'px-xl py-md text-lg',
  };
  
  return (
    <button
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};
```

### 6.4 Dependências Recomendadas

```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "tailwindcss": "^3.3.0",
  "lucide-react": "^latest",
  "zustand": "^4.0.0",
  "axios": "^latest",
  "react-hot-toast": "^2.4.0",
  "clsx": "^latest"
}
```

---

## 7. ACESSIBILIDADE (A11y)

### 7.1 Requisitos Obrigatórios

- **WCAG 2.1 AA minimum**
- Alt text em todas as imagens
- Labels em inputs (`<label for="id">`)
- ARIA labels onde necessário
- Focus order lógico (tabindex)
- Contraste: 4.5:1 para texto normal, 3:1 para grandes

### 7.2 Checklist

- [ ] Sem cores como único meio de informação
- [ ] Botões e links identificáveis por teclado
- [ ] Modais: focus trap + ESC para fechar
- [ ] Campos obrigatórios marcados com `*` + aria-required
- [ ] Mensagens de erro associadas a inputs
- [ ] Ícones com `aria-label` ou `title`
- [ ] Animações respeita `prefers-reduced-motion`

### 7.3 Exemplo: Respeitar Preferência de Redução de Movimento

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. PADRÕES DE VALIDAÇÃO

### 8.1 Validações Obrigatórias

| Tipo | Regra | Mensagem |
|------|-------|----------|
| Email | RFC 5322 | "Email inválido" |
| URL | HTTP(S) | "URL inválida" |
| Número | Sem caracteres especiais | "Apenas números" |
| Telefone | +55 (11) 99999-9999 | "Formato: +55 (XX) XXXXX-XXXX" |
| Senha | Min 8 char, 1 maiúscula, 1 número | "Fraca / Média / Forte" |
| Data | YYYY-MM-DD | "Data inválida" |

### 8.2 Feedback de Validação

- **Campo válido**: ícone ✓ (text-success), sem mensagem
- **Campo inválido**: ícone ✗ (text-error), mensagem de erro em error color
- **Campo em processamento**: spinner, disabled

### 8.3 Form Submission

- Desabilitar botão ao submeter
- Mostrar loading spinner no botão
- Toast de sucesso/erro após submissão
- Resetar form após sucesso (se apropriado)

---

## 9. PERFORMANCE

### 9.1 Requisitos

- **LCP** < 2.5s (Largest Contentful Paint)
- **FID** < 100ms (First Input Delay)
- **CLS** < 0.1 (Cumulative Layout Shift)
- **Bundle size** < 100KB (gzipped, JS puro)

### 9.2 Otimizações

- Code splitting por feature
- Lazy load de images (`loading="lazy"`)
- Memoização de componentes (`React.memo`, `useMemo`)
- Virtualization para listas grandes (>100 itens)
- Minimizar re-renders desnecessários

### 9.3 Assets

- Imagens: WebP com fallback JPG/PNG
- SVGs para ícones (não icon fonts)
- Fontes: Google Fonts via `@font-face` (preload)

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

### Antes de Iniciar
- [ ] Designar quem é responsável por cada coluna/módulo
- [ ] Criar branches de feature (git flow)
- [ ] Configurar variáveis de ambiente (.env.example)
- [ ] Setup de linting (ESLint + Prettier)

### Durante o Desenvolvimento
- [ ] Usar componentes padrão (não duplicar)
- [ ] Testar responsividade (mobile, tablet, desktop)
- [ ] Validar acessibilidade (Wave, Axe DevTools)
- [ ] Não hardcoded colors (usar variáveis CSS)
- [ ] Adicionar loading states
- [ ] Adicionar error boundaries

### Antes de Deploy
- [ ] Passar por code review
- [ ] Testes unitários (componentes críticos)
- [ ] Testes de integração (fluxos principais)
- [ ] Performance audit (Lighthouse)
- [ ] Build otimizado (minify, gzip)
- [ ] Verificar variáveis de ambiente
- [ ] Testar em navegadores reais (Chrome, Firefox, Safari)

### Exportação para Elementor
- [ ] Estrutura HTML semântica (sem divs genéricas)
- [ ] Classes CSS isoladas (BEM ou similar)
- [ ] Sem dependencies externas (só vanilla JS se necessário)
- [ ] Validar output exportado

---

## 11. EXEMPLO: Aplicação Mínima

**App.jsx**:
```jsx
import { Header } from '@/components/layout/Header';
import { Subbar } from '@/components/layout/Subbar';
import { MainGrid } from '@/components/layout/MainGrid';
import { Footer } from '@/components/layout/Footer';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-bg-base text-text-primary">
      <Header />
      <Subbar />
      <MainGrid>
        {/* Colunas aqui */}
      </MainGrid>
      <Footer />
    </div>
  );
}
```

**MainGrid.jsx**:
```jsx
export const MainGrid = ({ children }) => (
  <main className="grid grid-cols-[38fr_22fr_40fr] gap-md p-lg flex-1 lg:grid-cols-1 md:grid-cols-2 sm:grid-cols-1 overflow-hidden">
    {children}
  </main>
);
```

---

## 12. SUPORTE & DEBUGGING

**Problemas comuns**:
- **Layout quebrado em mobile**: Verificar media queries (`lg:`, `md:`, `sm:`)
- **Cores diferentes**: Validar hex codes contra paleta acima
- **Scroll travado**: Remover `overflow: hidden` de containers filhos desnecessários
- **Fontes não carregando**: Verificar `@font-face` e CORS
- **Modais atrás de elementos**: Validar z-index (modal = 1000, overlay = 999)

---

## Como Usar Este Documento

Este documento pode ser utilizado de diferentes maneiras:

1. **Como referência de projeto**: Mantenha-o em seu repositório para consulta durante o desenvolvimento
2. **Como prompt para Claude**: Copie o conteúdo e cole em uma conversa com o Claude para contextualizar a IA sobre o projeto
3. **Como documentação técnica**: Compartilhe com sua equipe para garantir consistência
4. **Em linting/automação**: Use as regras para criar validações automáticas de código

---

**Versão**: 1.0  
**Última atualização**: Julho 2024  
**Desenvolvido para**: WebKeeper Universal System  
**Arquivo criado**: 2026-07-24
