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

Para ativar a consulta oficial de comissao, taxa fixa e estimativa de envio do Mercado Livre, crie um arquivo `.env.local` na raiz do projeto com base em `.env.example`:

```bash
cp .env.example .env.local
```

Preencha:

```env
MELI_ACCESS_TOKEN=seu_token_do_mercado_livre
MELI_USER_ID=seu_user_id_do_mercado_livre
```

Sem essas variaveis, a aplicacao continua funcionando, mas usa fallback local em vez de consulta oficial do Mercado Livre.

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

O projeto esta preparado para deploy na Vercel sem banco de dados.

- O historico usa `localStorage`, entao os calculos ficam salvos no navegador do usuario.
- Neon nao e necessario neste momento.
- So use Neon se quiser historico compartilhado, persistencia em servidor ou contas de usuarios.

Para publicar:

1. Importe o repositorio na Vercel.
2. Se quiser usar a integracao oficial do Mercado Livre em producao, configure estas variaveis:

```text
MELI_ACCESS_TOKEN
MELI_USER_ID
```

3. Faça o deploy.

Observacao: este projeto usa `npm run build:webpack` na Vercel para evitar problemas locais observados com o build padrao via Turbopack.

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
