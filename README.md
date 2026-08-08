# DaBi Price 3D

Precificadora para produtos impressos em 3D, construída com Next.js 16.

Hoje o app cobre:

- precificação 3D com leitura por canal
- autenticação por sessão com cookie `httpOnly`
- fallback local sem `DATABASE_URL`
- persistência real de workspace, usuários, sessões e preferências quando há banco
- gestão de membros e papéis em `/app/conta`
- recuperação de acesso por token
- integração com ERP
- integração do Mercado Livre com status em `/app/preferencias`

## Requisitos

- Node.js 20+
- npm 10+

## Instalação

```bash
npm install
```

## Desenvolvimento local

Rodando com Turbopack:

```bash
npm run dev
```

Rodando com Webpack:

```bash
npm run dev:webpack
```

Aplicação local:

```text
http://localhost:3005
```

## Modos de persistência

O app funciona em dois modos.

### 1. Modo local

Sem `DATABASE_URL`, a aplicação entra em fallback local.

Nesse modo:

- login, sessão, histórico, preferências e recuperação de acesso funcionam localmente
- os dados não são compartilhados entre máquinas
- a interface mostra a tag `Local`
- a gestão de membros persistida do workspace fica indisponível

Bootstrap local padrão:

```text
admin@dabitech3d.com
admin123
```

Você pode sobrescrever isso em desenvolvimento com:

```env
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_PASSWORD=
BOOTSTRAP_ADMIN_NAME=
BOOTSTRAP_WORKSPACE_NAME=
```

### 2. Modo com banco

Com `DATABASE_URL`, o app ativa persistência compartilhada.

Nesse modo:

- sessões passam a ser persistidas em banco
- preferências do workspace passam a ser persistidas
- histórico e contexto do workspace deixam de ser locais
- gestão de membros e papéis fica disponível
- OAuth persistente do Mercado Livre pode ser habilitado por workspace
- a interface mostra a tag `Banco`

Variável obrigatória:

```env
DATABASE_URL=
```

## Autenticação e recuperação de acesso

O login usa sessão por cookie `httpOnly`.

Rotas principais:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/recovery/request`
- `GET /api/auth/recovery/verify`
- `POST /api/auth/recovery/reset`

### Recuperação de acesso

O fluxo público fica em `/recuperar-acesso`.

Há rate limit nas rotas de recuperação:

- solicitação por IP e e-mail
- verificação por IP e token
- redefinição por IP e token

### E-mail transacional

Para envio real de e-mail na recuperação, configure:

```env
RESEND_API_KEY=
AUTH_EMAIL_FROM=
```

Sem `RESEND_API_KEY`, o link de redefinição continua sendo emitido. Em desenvolvimento, o app expõe o link diretamente na interface para teste.

## Gestão de usuários e permissões

A gestão de membros fica em:

```text
/app/conta
```

Papéis de workspace atualmente usados:

- `owner`
- `manager`
- `operator`

Papéis de plataforma hoje suportados na sessão:

- `super_admin`
- `platform_admin`
- `support_agent`
- `developer`
- `user`

Observações:

- sem `DATABASE_URL`, a UI de membros persistidos fica indisponível
- no fallback local ainda existe um fluxo local de convite/ativação para desenvolvimento
- o `super_admin` ignora limites de papel do workspace

## Preferências e integração do Mercado Livre

A tela de preferências fica em:

```text
/app/preferencias
```

Ela concentra:

- parâmetros operacionais da precificadora
- status da integração do Mercado Livre
- botão de conectar ou reconectar a conta quando o OAuth por workspace está disponível

### Mercado Livre: modos suportados

#### OAuth persistente por workspace

Modo recomendado.

Configure:

```env
DATABASE_URL=
MELI_CLIENT_ID=
MELI_CLIENT_SECRET=
MELI_REDIRECT_URI=
```

Fluxo:

1. Configure essas variáveis no ambiente.
2. Cadastre a mesma `MELI_REDIRECT_URI` no app do Mercado Livre.
3. Entre no app.
4. Abra `/app/preferencias`.
5. Clique em `Conectar conta`.

Nesse modo:

- a conta fica vinculada ao workspace atual
- o app persiste `refresh_token`
- o `access_token` é renovado automaticamente quando necessário

#### Token legado por ambiente

Fallback manual:

```env
MELI_ACCESS_TOKEN=
MELI_USER_ID=
```

Nesse modo:

- a integração funciona
- mas não fica separada por workspace
- a tela de preferências mostra que a origem da conexão é um token legado

#### Sem configuração

Sem OAuth persistente e sem token legado:

- o app continua funcionando
- a precificadora usa prévia local de taxas
- a consulta oficial do Mercado Livre não fica disponível

## ERP

Para habilitar `Salvar no ERP`, configure:

```env
ERP_APP_URL=
PRICING_INTEGRATION_TOKEN=
```

O envio passa pela rota:

```text
POST /api/erp-products
```

Hoje o fluxo oficial é:

1. preparar o produto na precificadora
2. salvar no ERP
3. publicar a partir do ERP

### Observabilidade operacional

As rotas críticas de ERP e Mercado Livre agora retornam `requestId` em erros operacionais.

Isso aparece:

- na resposta JSON
- no header `x-request-id`
- na interface, quando a falha vem dessas integrações

Use essa referência para correlacionar logs de suporte.

## Publicação no site

A publicação direta no e-commerce foi desativada.

A rota:

```text
POST /api/site-products/publish
```

retorna `410` com a orientação para salvar no ERP e publicar a partir dele.

### Upload de imagens

O fluxo atual ainda usa upload de imagem para preparar produtos do ERP.

Configure:

```env
BLOB_READ_WRITE_TOKEN=
```

Sem isso, os uploads de imagem do fluxo de produto falham.

## Variáveis de ambiente

Existe um arquivo de referência:

```bash
cp .env.example .env.local
```

Principais grupos:

- persistência e bootstrap: `DATABASE_URL`, `BOOTSTRAP_*`
- recuperação de acesso: `RESEND_API_KEY`, `AUTH_EMAIL_FROM`
- Mercado Livre: `MELI_CLIENT_*`, `MELI_REDIRECT_URI`, `MELI_ACCESS_TOKEN`, `MELI_USER_ID`
- ERP: `ERP_APP_URL`, `PRICING_INTEGRATION_TOKEN`
- Blob: `BLOB_READ_WRITE_TOKEN`

## Testes e validação

Lint:

```bash
npm run lint
```

Typecheck:

```bash
npm run typecheck
```

Suíte atual:

```bash
npm run test:pricing
```

Validação completa:

```bash
npm run check
```

Atualmente essa suíte cobre, entre outros pontos:

- motor de precificação
- modelos de venda
- lucro e destinação
- fallback local de autenticação
- proteção de `/app`
- regras de acesso e papéis
- helpers de observabilidade e rate limit

## Build e execução em produção

Build padrão:

```bash
npm run build
```

Build com Webpack:

```bash
npm run build:webpack
```

Rodando a build localmente:

```bash
npm run start:3005
```

## Estrutura principal

- `src/app`: rotas App Router, páginas e handlers
- `src/components/pricing`: formulário, resultado e publicação para ERP
- `src/components/account`: gestão de membros
- `src/components/preferences`: parâmetros operacionais e integrações
- `src/lib/auth`: autenticação, recuperação e regras de acesso
- `src/lib/server`: persistência, observabilidade, rate limit e integrações servidoras
- `src/lib/pricing`: motor de cálculo, view models e canais de venda
- `tests`: suíte atual em `node --test`
