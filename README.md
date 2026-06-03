# DaBi Price 3D

Precificadora para produtos impressos em 3D, feita em Next.js.

## Requisitos

- Node.js 20+
- npm 10+

## Instalação

```bash
npm install
```

## Rodando localmente

Modo padrão:

```bash
npm run dev
```

Aplicação disponível em:

```text
http://localhost:3005
```

Se o ambiente apresentar erro com Turbopack, use a variante com Webpack:

```bash
npm run dev:webpack
```

## Mercado Livre API

### Modo rápido

Para ativar a consulta oficial de comissao, taxa fixa e estimativa de envio do Mercado Livre com token manual, crie um arquivo `.env.local` na raiz do projeto com base em `.env.example`:

```bash
cp .env.example .env.local
```

Preencha:

```env
MELI_ACCESS_TOKEN=seu_token_do_mercado_livre
MELI_USER_ID=seu_user_id_do_mercado_livre
```

Sem essas variaveis, a aplicacao continua funcionando, mas usa fallback local em vez de consulta oficial do Mercado Livre.

### Modo de produção

Para deixar a integracao pronta para producao, use OAuth persistente com refresh automatico. Nesse modo, o app salva o refresh token em banco e renova o access token sozinho.

Variaveis necessarias:

```env
DATABASE_URL=sua_connection_string_do_neon
MELI_CLIENT_ID=seu_app_id
MELI_CLIENT_SECRET=sua_secret_key
MELI_REDIRECT_URI=https://SEU-DOMINIO/api/auth/meli/callback
```

Fluxo:

1. Crie um banco no Neon.
2. Configure essas variaveis na Vercel.
3. No DevCenter do Mercado Livre, cadastre a mesma `MELI_REDIRECT_URI`.
4. Abra `/preferencias` no app publicado.
5. Clique em `Conectar Mercado Livre`.

Observacoes:

- A tabela `meli_oauth_tokens` e criada automaticamente no primeiro uso.
- O modo com Neon passa a ser o modo preferencial da aplicacao.
- `MELI_ACCESS_TOKEN` e `MELI_USER_ID` ficam como fallback legado/manual.

## Deploy

### GitHub

O projeto ja pode ser versionado normalmente com Git. Depois de criar um repositorio vazio no GitHub, conecte o remote e envie:

```bash
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git add .
git commit -m "feat: initial Dabi Price 3D app"
git push -u origin main
```

### Vercel

O projeto esta preparado para deploy na Vercel.

- O historico usa `localStorage`, entao os calculos ficam salvos no navegador do usuario.
- O app nao precisa de banco para funcionar.
- Para Mercado Livre em producao com renovacao automatica de token, use Neon.

Para publicar:

1. Importe o repositorio na Vercel.
2. Configure as variaveis necessarias para o ambiente desejado.

Modo rapido/manual:

```text
MELI_ACCESS_TOKEN
MELI_USER_ID
```

Modo de producao:

```text
DATABASE_URL
MELI_CLIENT_ID
MELI_CLIENT_SECRET
MELI_REDIRECT_URI
```

3. Faça o deploy.

Observacao: este projeto usa `npm run build:webpack` na Vercel para evitar problemas locais observados com o build padrao via Turbopack.

## Publicação no site

Para usar o fluxo `Criar produto no site`, configure a API do projeto
`e-commerce-3D` nas variáveis abaixo:

```env
ECOMMERCE_API_URL=http://127.0.0.1:4020
ECOMMERCE_STOREFRONT_URL=http://127.0.0.1:3010
ECOMMERCE_ADMIN_EMAIL=admin@dabitech3d.com
ECOMMERCE_ADMIN_PASSWORD=admin123
```

- `ECOMMERCE_API_URL`: URL da API Fastify do `e-commerce-3D`
- `ECOMMERCE_STOREFRONT_URL`: URL pública da loja para montar o link final do produto
- `ECOMMERCE_ADMIN_EMAIL` e `ECOMMERCE_ADMIN_PASSWORD`: credenciais admin usadas pela precificadora para publicar via `POST /api/products`

O fluxo de produto do site envia as imagens primeiro para um Blob público da Vercel e depois publica no e-commerce usando as URLs geradas. Crie um store público na Vercel Storage e conecte-o a este projeto. Em integrações novas, a Vercel usa OIDC e injeta `BLOB_STORE_ID` e `BLOB_WEBHOOK_PUBLIC_KEY`.

## Build de produção

Build padrão:

```bash
npm run build
```

Build com Webpack:

```bash
npm run build:webpack
```

Para iniciar a versão de produção na mesma porta local:

```bash
npm run start:3005
```

## Estrutura principal

- `src/app`: layout global e página principal
- `src/components/pricing`: formulário e cards de resultado
- `src/lib/pricing`: regras de cálculo, formatação e canais de venda
