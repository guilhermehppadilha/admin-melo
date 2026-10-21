# TDD — Intranet Corporativa
## Documento Técnico Final — Executável por Agente de IA (DeepSeek) sob Supervisão Humana

---

## 0. Metadados

| Campo | Valor |
|---|---|
| **Título** | Intranet Corporativa — TDD Final |
| **Versão** | 4.0 (Final) |
| **Status** | Aprovado para execução |
| **Público primário** | Agente de IA (DeepSeek) no VSCode |
| **Público secundário** | Supervisor humano (revisor de PRs) |
| **Domínio** | `intranet.mook.tech` |
| **Última atualização** | 13/10/2026 |

### Como usar este documento

1. Leia integralmente antes de gerar qualquer linha de código.
2. Cada seção é **fonte de verdade**. Em caso de conflito com conhecimento prévio do modelo, **este documento prevalece**.
3. A **Seção 12** é um contrato inviolável. Violá-la invalida a PR.
4. Toda tarefa de código deve pertencer a uma **Fase** (Seção 10). Não gere código fora da fase ativa.
5. Em caso de ambiguidade, **pare e pergunte ao supervisor** — não assuma.

---

## 1. Contexto e Propósito

Intranet corporativa auto-hospedada em **VPS própria**, acessível via navegador (desktop e mobile), voltada para **10–15 funcionários hoje**, dimensionada para até **~200** sem reescrita.

Atende três públicos:

| Público | Necessidade |
|---|---|
| **Funcionários** | Consultar documentos, rotinas e escala de trabalho. |
| **Gestores** | Acessar suíte de microaplicações (a serem mapeadas) para automatizar rotinas. |
| **RH/Recrutamento** | Gerenciar processos seletivos (candidatos CLT e freelancers). |

O desenvolvimento é **acelerado por IA** (DeepSeek no VSCode), sempre com **revisão humana** antes de merge.

---

## 2. Escopo

### 2.1 Dentro do Escopo (Fase 1)

- Autenticação (e-mail/senha) via Directus Auth.
- Portal do funcionário: documentos, rotinas, escala.
- Gestão de documentos com **permissões granulares** (global, papel, departamento, usuário).
- Módulo RH/recrutamento: candidatos (CLT e freelancer), pipeline de estágios, upload de currículos.
- Catálogo de microapps (registro + listagem; lógica individual entra em fases próprias).
- Painel administrativo do Directus.
- Site responsivo (mobile-first).

### 2.2 Fora do Escopo (Fase 1)

- ❌ Integração com ERPs externos (SAP, TOTVS etc.).
- ❌ Aplicativo mobile nativo.
- ❌ Assinatura digital de documentos.
- ❌ Solicitações de folga (`leave_requests` não existe).
- ❌ Automações financeiras pré-modeladas (serão microapps individuais).
- ❌ Edge Functions / serverless.
- ❌ Testes formais de performance (Lighthouse, k6) ou segurança automatizada.
- ❌ Backup externo (entra pós-validação, Fase 6).

### 2.3 Fora do Escopo (indefinidamente)

- Multi-tenant.
- App desktop.
- API pública para terceiros.

### 2.4 Pressupostos Confirmados pelo Supervisor

| # | Pressuposto |
|---|---|
| P1 | Autenticação inicial apenas e-mail/senha; SSO avaliado depois. |
| P2 | Herança automática de gestor em documentos via Flow. |
| P3 | "Rotinas" são tarefas recorrentes atribuídas a pessoas/setores. |
| P4 | Microapps serão páginas React nativas. |
| P5 | Retenção de candidatos não contratados: 6 meses. |
| P6 | Domínio: `intranet.mook.tech`. |
| P7 | Painel Directus em `/admin` no mesmo domínio, protegido por role. |
| P8 | VPS com pelo menos 2 vCPU / 4 GB RAM / 40 GB SSD. |
| P9 | Sem política LGPD interna no momento. |
| P10 | Backup externo adiado para Fase 6. |
| P11 | Primeira microapp definida após a Fase 6. |

---

## 3. Stack Tecnológico e Arquitetura

### 3.1 Stack Oficial

| Camada | Tecnologia | Versão alvo |
|---|---|---|
| Frontend | React + Vite + TypeScript | React 19, Vite 6 |
| Boilerplate | **Shadcn Dashboard** (`shadcndashboard/shadcndashboard`) | latest estável |
| UI | Tailwind CSS + shadcn/ui (Radix UI) | Tailwind v4, shadcn/ui v3 |
| Estado global | Zustand | 5.x |
| Roteamento | React Router | 7.x |
| Data fetching | TanStack Query | 5.x |
| SDK backend | `@directus/sdk` | latest |
| Formulários | react-hook-form + zod | — |
| Notificações | sonner | — |
| Backend | **Directus** | 11.x |
| Banco | PostgreSQL | 16 |
| Cache | Redis | 7.x |
| Proxy/SSL | Caddy | 2.x |
| Orquestração | Docker Compose | v2 |

### 3.2 Arquitetura de Containers

```
┌──────────────────────────── VPS ─────────────────────────────┐
│                                                              │
│  Caddy (:80/:443) ── TLS automático (Let's Encrypt)          │
│    ├── /              → build estático do React (volume)     │
│    ├── /api/*         → Directus :8055                       │
│    ├── /admin/*       → Directus :8055 (restrito por role)   │
│    └── /assets/*      → Directus uploads                     │
│                                                              │
│  ┌──────────────┐   ┌────────────┐   ┌────────────────────┐ │
│  │  Directus    │──▶│ PostgreSQL │   │ Redis              │ │
│  │  :8055       │   │  :5432     │   │ :6379              │ │
│  └──────┬───────┘   └────────────┘   └────────────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Microserviços externos (somente quando necessário)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Volumes nomeados: pg_data, directus_uploads, caddy_data    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Estratégia de Lógica de Backend (4 níveis)

O agente deve escolher o **nível mais simples que resolve o problema**. Promova para o próximo apenas quando o atual ficar desconfortável.

| Nível | Mecanismo | Uso típico |
|---|---|---|
| **1** | **Flows do Directus** (visual) | Orquestração de processos, envio de e-mails, chamadas HTTP, criação em cascata. |
| **2** | **Hooks** (extensão Node.js) | Validações e efeitos colaterais em eventos CRUD. |
| **3** | **Custom Endpoints** (extensão Node.js) | Ações sob demanda (relatórios, cálculos, processamentos). |
| **4** | **Microserviço externo** (Node/Deno/Python) | Lógica complexa, performance crítica, stack dedicada. Conecta-se ao mesmo PostgreSQL. |

---

## 4. Estrutura do Repositório

```
intranet/
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── Caddyfile
│   └── .env.example
├── frontend/                          # clonado do Shadcn Dashboard
│   ├── src/
│   │   ├── api/                       # camada de serviços Directus
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui (gerenciado por CLI)
│   │   │   └── shared/                # componentes da aplicação
│   │   ├── features/                  # organização por domínio
│   │   │   ├── auth/
│   │   │   ├── documents/
│   │   │   ├── routines/
│   │   │   ├── schedule/
│   │   │   ├── microapps/
│   │   │   └── recruitment/
│   │   ├── hooks/                     # hooks Directus + TanStack Query
│   │   ├── layouts/                   # do boilerplate
│   │   ├── lib/
│   │   │   ├── directus.ts            # cliente Directus
│   │   │   └── utils.ts
│   │   ├── routes/                    # React Router
│   │   ├── stores/                    # Zustand
│   │   ├── types/                     # tipos TS
│   │   ├── views/                     # páginas do boilerplate
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── directus/
│   ├── extensions/
│   │   ├── hooks/business-rules/      # extensão de hooks
│   │   └── endpoints/reports/         # extensão de endpoints
│   ├── snapshots/
│   │   └── schema.yaml                # snapshot versionado
│   └── uploads/                       # volume (não versionado)
├── microservices/                     # somente quando surgir necessidade
├── scripts/
│   ├── backup.sh
│   └── restore.sh
├── docs/
│   ├── TDD.md                         # este documento
│   ├── runbook.md                     # operação em produção
│   └── adr/
│       ├── ADR-002-boilerplate-frontend.md
│       └── ADR-003-integracao-directus.md
├── .gitignore
└── README.md
```

---

## 5. Modelo de Dados (Directus Collections)

Crie via **painel do Directus**. Exporte snapshot para `directus/snapshots/schema.yaml` após cada mudança. **Não** crie migrations SQL manuais.

### 5.1 `departments`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| name | String | obrigatório, único |
| cost_center | String | opcional |

### 5.2 `users` (extensão do nativo)

| Campo | Tipo | Notas |
|---|---|---|
| first_name | String | obrigatório |
| last_name | String | obrigatório |
| role | M2O → directus_roles | obrigatório |
| department | M2O → departments | opcional |
| manager | M2O → users | auto-relacionamento, opcional |
| hire_date | Date | opcional |
| is_active | Boolean | default `true` |

### 5.3 `documents`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| title | String | obrigatório |
| description | Text | opcional |
| file | File | upload via Directus (XOR com `external_url`) |
| external_url | String | link externo (ex: Google Drive) |
| category | Enum | `policy`, `payslip`, `contract`, `handbook`, `training`, `other` |
| owner | M2O → users | nullable — quando preenchido, pertence a um usuário |
| uploaded_by | M2O → users | auto via hook |
| created_at | Timestamp | auto |

**Regra:** `file` e `external_url` são mutuamente exclusivos — nunca ambos, nunca nenhum.

### 5.4 `document_permissions`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| document | M2O → documents | obrigatório |
| subject_type | Enum | `all`, `role`, `department`, `user` |
| subject_role | M2O → directus_roles | nullable |
| subject_department | M2O → departments | nullable |
| subject_user | M2O → users | nullable |
| can_view | Boolean | default `true` |
| can_download | Boolean | default `true` |

**Regras de negócio (Hook + Dynamic Permissions):**

1. Se `documents.owner` preenchido, só owner + entradas em `document_permissions` + papéis `admin`/`rh` veem.
2. Se `owner` é `null`, visibilidade definida por `document_permissions`.
3. **Herança automática:** gestor direto (via `users.manager`) de um usuário com `owner=subordinado` ganha visão automaticamente (Flow).
4. Papéis `rh` e `admin` veem tudo.

### 5.5 `routines`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| title | String | obrigatório |
| description | Text | opcional |
| department | M2O → departments | nullable |
| assigned_to | M2O → users | nullable |
| recurrence | Enum | `daily`, `weekly`, `monthly`, `once` |
| next_due | Date | opcional |
| is_active | Boolean | default `true` |

### 5.6 `work_schedules`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| user | M2O → users | obrigatório |
| date | Date | obrigatório |
| shift | Enum | `morning`, `afternoon`, `night`, `off` |
| notes | Text | opcional |

**Constraint:** único par (`user`, `date`).

### 5.7 `microapps` (catálogo)

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| slug | String | único, ex: `estoque` |
| name | String | obrigatório |
| description | Text | opcional |
| icon | String | nome de ícone Lucide |
| route_path | String | ex: `/apps/estoque` |
| required_role | M2O → directus_roles | opcional |
| is_active | Boolean | default `true` |
| sort | Integer | ordem de exibição |

### 5.8 `candidates`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| full_name | String | obrigatório |
| email | String | obrigatório, único |
| phone | String | opcional |
| type | Enum | `employee`, `freelancer` |
| stage | Enum | `applied`, `screening`, `interview`, `offer`, `hired`, `rejected` |
| resume | File | upload |
| notes | Text | opcional |
| created_at | Timestamp | auto |

### 5.9 `candidate_documents`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| candidate | M2O → candidates | obrigatório |
| document_type | String | ex: `rg`, `cpf`, `portfolio` |
| file | File | obrigatório |

### 5.10 `audit_log`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| collection | String | nome da collection |
| item_id | String | ID do item |
| action | Enum | `create`, `update`, `delete` |
| user | M2O → users | quem executou |
| payload | JSON | dados relevantes |
| created_at | Timestamp | auto |

**Populado via Flow** em `items.create`, `items.update`, `items.delete` das collections sensíveis: `documents`, `document_permissions`, `candidates`, `work_schedules`.

---

## 6. Autenticação e Permissões

### 6.1 Autenticação

- **Primária:** e-mail + senha (Directus Auth).
- **Sessão:** JWT (access + refresh).
- **MFA (TOTP):** obrigatório para `admin` e `rh` (ativar na Fase 6).
- **SSO:** fora do escopo da Fase 1.

### 6.2 Papéis (Directus Roles)

| Papel | Slug | Descrição |
|---|---|---|
| Funcionário | `employee` | Próprios dados, docs com permissão, rotinas e escalas do setor. |
| Gestor | `manager` | Tudo do funcionário + microapps + visão sobre subordinados. |
| RH | `rh` | Acesso a candidatos, documentos de RH e usuários. |
| Administrador | `admin` | Acesso irrestrito. |

### 6.3 Política de Acesso a Documentos (ordem de avaliação)

```
1. Papel admin ou rh                    → permitir
2. document.owner == user.id            → permitir
3. document_permissions(subject_user=user.id, can_view=true)          → permitir
4. document_permissions(subject_department=user.department, can_view) → permitir
5. document_permissions(subject_role=user.role, can_view=true)        → permitir
6. document_permissions(subject_type=all, can_view=true)              → permitir
7. user é gestor direto de document.owner                             → permitir (Flow)
8. Caso contrário                       → negar
```

---

## 7. Rotas do Frontend

| Rota | Acesso | Feature |
|---|---|---|
| `/login` | público | `features/auth` |
| `/` | autenticado | `features/dashboard` |
| `/docs` | autenticado | `features/documents` |
| `/docs/:id` | autenticado (policy) | `features/documents` |
| `/routines` | autenticado | `features/routines` |
| `/schedule` | autenticado | `features/schedule` |
| `/apps` | `manager`, `admin` | `features/microapps` |
| `/apps/:slug` | conforme `required_role` | `features/microapps` |
| `/rh/candidates` | `rh`, `admin` | `features/recruitment` |
| `/rh/candidates/:id` | `rh`, `admin` | `features/recruitment` |
| `/profile` | autenticado | `features/profile` |
| `*` | — | `NotFoundPage` |

**Layout base:** sidebar responsiva (Sheet em mobile, Sidebar em desktop), header com avatar e menu de usuário — fornecidos pelo Shadcn Dashboard.

**Guarda de rotas:** `<ProtectedRoute role="manager">` consulta o store Zustand de sessão.

---

## 8. Integração com Directus (Frontend)

### 8.1 Cliente (`src/lib/directus.ts`)

```typescript
import { createDirectus, rest, authentication } from '@directus/sdk';

const directusUrl = import.meta.env.VITE_DIRECTUS_URL;

export const directus = createDirectus(directusUrl)
  .with(authentication('json'))
  .with(rest());
```

### 8.2 Hooks de Dados (`src/hooks/useDirectus.ts`)

Criar hooks genéricos com **TanStack Query**:

| Hook | Descrição |
|---|---|
| `useDirectusCollection<T>(collection, query?)` | Lista com filtros, ordenação e paginação. |
| `useDirectusItem<T>(collection, id)` | Item por ID. |
| `useDirectusCreate<T>(collection)` | Mutation para criar. |
| `useDirectusUpdate<T>(collection)` | Mutation para atualizar. |
| `useDirectusDelete(collection)` | Mutation para deletar. |

### 8.3 Autenticação

1. Usar o formulário de login do Shadcn Dashboard.
2. Chamar `directus.login(email, password)`.
3. Armazenar token (access + refresh) no Zustand.
4. Redirecionar para `/`.
5. `ProtectedRoute` verifica token no store; ausente → `/login`.

### 8.4 Variáveis de Ambiente (`.env.example` do frontend)

```bash
VITE_DIRECTUS_URL=https://intranet.mook.tech/api
```

---

## 9. Padrões de Código (obrigatórios)

### 9.1 Frontend

- TypeScript **estrito** (`"strict": true`).
- **Sem `any`** — usar `unknown` + type guards.
- Componentes funcionais com hooks; sem classes.
- Tailwind utilitário + `cn()` para merge.
- Nomes: componentes `PascalCase`, arquivos `kebab-case` exceto componentes.
- Imports absolutos via alias `@/` → `src/`.
- Validação: `react-hook-form` + `zod`.
- Data fetching: TanStack Query.
- Erros: boundary global + toasts (`sonner`).

### 9.2 Directus (Extensões)

- TypeScript compilado via `directus-extension-build`.
- Uma pasta por extensão em `directus/extensions/`.
- Hooks: `filter` antes de `action` quando a validação puder impedir a operação.
- Endpoints: prefixo `/custom/<recurso>`.
- Logs: usar `logger` do Directus, nunca `console.log` em produção.

### 9.3 Docker / Infra

- Imagens com **versão fixa** (ex: `postgres:16.4-alpine`), nunca `latest`.
- Variáveis em `.env` (não versionado); `.env.example` sempre atualizado.
- Volumes nomeados para persistência.
- Healthchecks em todos os serviços que suportam.

### 9.4 Git

- Commits: **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Branches: `feat/<slug>`, `fix/<slug>`.
- PRs: descrevem fase do TDD, o que foi feito, como testar.
- **Nunca commitar:** `.env`, segredos, uploads, `node_modules`.

---

## 10. Plano de Execução por Fases

Não avance para a próxima fase sem que a anterior tenha critérios de aceite atendidos e PR aprovada.

### Fase 0 — Bootstrap do Repositório

- [ ] Criar estrutura de diretórios conforme Seção 4.
- [ ] Inicializar `git`, criar `.gitignore`, `README.md`.
- [ ] Clonar Shadcn Dashboard:
  ```bash
  git clone https://github.com/shadcndashboard/shadcndashboard.git frontend
  ```
- [ ] `npm install` no frontend.
- [ ] Adicionar `@directus/sdk` e `@tanstack/react-query` às dependências.
- [ ] Criar `src/lib/directus.ts` (cliente).
- [ ] Criar `src/hooks/useDirectus.ts` (hooks TanStack Query).
- [ ] Configurar `.env.example` do frontend.
- [ ] Criar `docker/docker-compose.yml` + `Caddyfile` com placeholders.
- [ ] Criar `docker/.env.example` completo (Seção 15.1).
- [ ] Configurar ESLint + Prettier.
- [ ] Escrever `docs/runbook.md` esqueleto.
- [ ] Criar `docs/adr/ADR-002-boilerplate-frontend.md`.
- [ ] Criar `docs/adr/ADR-003-integracao-directus.md`.

**Aceite:** `docker compose up` sobe Directus + Postgres + Caddy localmente; `npm run dev` sobe o React; cliente Directus importável sem erros de tipo.

### Fase 1 — Infra + Schema Base

- [ ] Subir Directus e criar admin inicial.
- [ ] Criar collections: `departments`, `users` (extensão), `documents`, `document_permissions`.
- [ ] Exportar snapshot para `directus/snapshots/schema.yaml`.
- [ ] Criar papéis `employee`, `manager`, `rh`, `admin` com policies mínimas.
- [ ] Criar Flow de auditoria para `documents` e `document_permissions`.
- [ ] Criar Flow de herança automática de gestor em documentos.
- [ ] Criar `scripts/backup.sh` (backup local via `pg_dump`).
- [ ] Documentar em `docs/runbook.md`.

**Aceite:** CRUD de documentos funcional via painel Directus; policies respeitadas; snapshot versionado.

### Fase 2 — Frontend Base + Autenticação

- [ ] Conectar formulário de login do Shadcn Dashboard ao Directus Auth.
- [ ] Implementar store de sessão em Zustand (token, refresh, user).
- [ ] Implementar `<ProtectedRoute>` usando rotas do boilerplate.
- [ ] Mapear rotas da Seção 7 para o `Router.tsx`.
- [ ] Criar `features/documents` com lista e detalhe via `useDirectus`.
- [ ] Criar `DashboardPage` com cards placeholder.

**Aceite:** Login ponta a ponta; rotas protegidas redirecionam; lista de documentos exibida.

### Fase 3 — Portal do Funcionário

- [ ] Cada feature da Seção 7 vira pasta em `src/features/`.
- [ ] Usar componentes de tabela, formulário e card do shadcn/ui.
- [ ] `features/documents`: lista, filtro por categoria, detalhe, download/link externo.
- [ ] Criar collections `routines` e `work_schedules`.
- [ ] `features/routines`: lista de rotinas do usuário e do setor.
- [ ] `features/schedule`: visão de escala semanal/mensal.
- [ ] Implementar permissões granulares de documentos no frontend (verificar `document_permissions`).

**Aceite:** Funcionário vê apenas o permitido; upload de documento com policy de usuário específico funciona.

### Fase 4 — Módulo RH / Recrutamento

- [ ] Criar collections `candidates`, `candidate_documents`.
- [ ] `features/recruitment`: lista com filtro por `stage` e `type`.
- [ ] Detalhe do candidato com upload de documentos e mudança de estágio.
- [ ] Flow de retenção: candidatos `rejected` > 6 meses são anonimizados.
- [ ] Policies: somente `rh` e `admin` acessam.

**Aceite:** Pipeline funcional; retenção aplicada em teste com data simulada.

### Fase 5 — Catálogo de Microapps

- [ ] Criar collection `microapps`.
- [ ] `features/microapps`: grid com cards filtrados por role.
- [ ] Rota dinâmica `/apps/:slug` com placeholder "em desenvolvimento".
- [ ] Documentar padrão para adicionar nova microapp em `docs/adr/`.

**Aceite:** Catálogo renderiza; navegação filtra por role.

### Fase 6 — Hardening e Go-Live

- [ ] Revisão de policies de todas as collections.
- [ ] MFA obrigatório para `admin` e `rh`.
- [ ] Uptime check externo apontando para `/api/server/health`.
- [ ] Configurar backup externo (provedor a definir).
- [ ] Testar restore de backup em ambiente isolado.
- [ ] Escrever `docs/runbook.md` definitivo.
- [ ] Deploy em produção na VPS.
- [ ] Smoke tests manuais executados pelo supervisor.

**Aceite:** Sistema em produção; backup restaurável; monitoramento ativo.

### Fase 7+ — Microapps (individual)

Cada microapp terá seu próprio mini-TDD, seguindo a hierarquia de lógica de backend (Seção 3.3).

---

## 11. Convenções de Qualidade

Toda PR deve conter:

1. Código compilando (`npm run build` sem erros).
2. Lint limpo (`npm run lint` sem warnings).
3. Tipos corretos (`tsc --noEmit` sem erros).
4. Descrição vinculando à fase e tasks do TDD.
5. Instruções de teste manual.
6. Screenshot/GIF quando afeta UI.
7. Atualização do `schema.yaml` quando schema muda.
8. Atualização do `.env.example` quando novas variáveis são introduzidas.

---

## 12. Regras de Engajamento do Agente de IA

Contrato inviolável.

### 12.1 O que o agente DEVE fazer

1. **Perguntar antes de assumir** quando o TDD for ambíguo ou omisso.
2. Seguir a **hierarquia de lógica de backend** (Seção 3.3) — começar pelo nível mais simples.
3. Criar/atualizar testes apenas quando o TDD pedir (Fase 6).
4. Documentar decisões em `docs/adr/` quando houver trade-off relevante.
5. Respeitar as fases — não gerar código de fases futuras.
6. Manter o schema versionado em `schema.yaml`.
7. Usar as versões fixas de dependências (Seção 3.1).
8. Escrever commits em Conventional Commits.
9. Reportar bloqueios em vez de contornar com gambiarras.
10. Preferir soluções nativas do Directus ou do ecossistema React antes de criar do zero.
11. Ao criar telas, usar **preferencialmente** componentes do Shadcn Dashboard (tabelas, formulários, modais, cards).
12. Manter a estrutura `src/features/` para organização por domínio.
13. Usar `@directus/sdk` para toda comunicação com o backend — nunca `fetch` cru.
14. Usar TanStack Query para cache e revalidação.
15. Reutilizar as páginas de autenticação do boilerplate, conectando-as ao Directus Auth.

### 12.2 O que o agente NÃO DEVE fazer

1. ❌ Não criar `leave_requests` ou qualquer coisa relacionada a férias/folgas.
2. ❌ Não criar tabelas de automações financeiras pré-modeladas.
3. ❌ Não criar Edge Functions ou serverless.
4. ❌ Não integrar com ERPs externos.
5. ❌ Não adicionar dependências fora da stack oficial sem aprovação.
6. ❌ Não usar `latest` em imagens Docker.
7. ❌ Não commitar segredos, `.env`, uploads ou `node_modules`.
8. ❌ Não rodar migrations SQL manuais — usar snapshots do Directus.
9. ❌ Não ultrapassar o escopo da fase ativa.
10. ❌ Não gerar código sem antes ler a Seção 5 (dados) e a Seção 6 (permissões).
11. ❌ Não implementar app mobile, assinatura digital ou multi-tenant.
12. ❌ Não adicionar testes automatizados de performance ou segurança.
13. ❌ Não modificar componentes do shadcn/ui em `src/components/ui/`.
14. ❌ Não criar componentes React do zero quando o Shadcn Dashboard já oferece equivalente.
15. ❌ Não usar Headless UI (stack do Dashin) — a stack oficial é Radix UI / shadcn/ui.
16. ❌ Não criar conector customizado para Directus se o SDK oficial resolver.

### 12.3 Formato de resposta do agente

Ao executar uma tarefa:

1. **Confirmação de fase e tarefa** (ex: "Fase 2 — Task: conectar login ao Directus").
2. **Preâmbulo curto** explicando a abordagem e por quê.
3. **Arquivos criados/modificados** (caminho completo).
4. **Comandos a executar** (se houver).
5. **Como testar manualmente** a entrega.
6. **Pendências ou dúvidas** (se houver).

---

## 13. Critérios de Aceite Globais (Definition of Done)

O projeto Fase 1 é considerado **entregue** quando:

- [ ] Todos os fluxos das Fases 0–6 funcionais em produção.
- [ ] Nenhum papel acessa dados fora de sua policy.
- [ ] Backup diário local rodando há ≥ 7 dias sem falha.
- [ ] Restore testado com sucesso em ambiente isolado.
- [ ] Uptime check ativo com > 99% nos últimos 7 dias.
- [ ] Runbook cobre: subir, derrubar, atualizar, restaurar, adicionar usuário.
- [ ] Supervisor validou smoke tests manualmente.
- [ ] Nenhuma dependência com versão `latest` ou flutuante.
- [ ] Shadcn Dashboard operacional e conectado ao Directus via `@directus/sdk`.
- [ ] Todas as telas de CRUD usam componentes do shadcn/ui.
- [ ] Formulário de login conectado ao Directus Auth.
- [ ] `docs/adr/ADR-002-boilerplate-frontend.md` e `ADR-003-integracao-directus.md` escritos e aprovados.
- [ ] Nenhum componente do Dashin utilizado.
- [ ] Este documento (`docs/TDD.md`) reflete a versão final.

---

## 14. Perguntas em Aberto

| # | Pergunta | Status |
|---|---|---|
| 1 | Provedor de storage externo para backup | **Adiado para Fase 6** |
| 2 | Primeira microapp a ser especificada | **Adiado para pós-Fase 6** |

---

## 15. Anexos

### 15.1 `.env.example` completo (`docker/.env.example`)

```bash
# Directus
DIRECTUS_KEY=<random-32-chars>
DIRECTUS_SECRET=<random-32-chars>
DIRECTUS_ADMIN_EMAIL=admin@mook.tech
DIRECTUS_ADMIN_PASSWORD=<strong-password>
DIRECTUS_PUBLIC_URL=https://intranet.mook.tech

# Database
DB_CLIENT=pg
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=intranet
DB_USER=intranet
DB_PASSWORD=<strong-password>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Caddy
DOMAIN=intranet.mook.tech

# Frontend (frontend/.env)
VITE_DIRECTUS_URL=https://intranet.mook.tech/api

# Backup (Fase 6)
BACKUP_S3_ENDPOINT=
BACKUP_S3_BUCKET=
BACKUP_S3_KEY=
BACKUP_S3_SECRET=
```

### 15.2 Referências

- Directus Docs: https://docs.directus.io
- Shadcn Dashboard: https://github.com/shadcndashboard/shadcndashboard
- shadcn/ui: https://ui.shadcn.com
- Vite: https://vitejs.dev
- TanStack Query: https://tanstack.com/query
- Docker Compose: https://docs.docker.com/compose
- Caddy: https://caddyserver.com/docs

---

**Fim do documento.**

> **Instrução final ao agente:** antes de iniciar a Fase 0, responda ao supervisor com um resumo em 5 linhas confirmando que compreendeu o escopo, as regras de engajamento, o plano de fases e a stack (Shadcn Dashboard + Directus + PostgreSQL + Caddy em VPS). Só prossiga após aprovação explícita.