# Arquitetura SaaS da Precificadora

## Objetivo

Transformar a precificadora atual em um SaaS vendável, mantendo o motor de cálculo como núcleo do produto e adicionando:

- autenticação
- multiusuário
- persistência real
- suporte e ajuda
- trilha de auditoria
- camada interna para operação da plataforma
- suporte futuro a outros públicos, como produtos artesanais

## Leitura do estado atual

Hoje o projeto já possui:

- motor de precificação consistente e testado
- histórico de cálculos
- preferências da operação
- trilha básica de eventos
- integração parcial com Mercado Livre
- integração parcial com ERP
- utilitário de banco via Neon em [src/lib/server/neon.ts](/Users/moysescosta/Projects/dabi-price-3d/src/lib/server/neon.ts:1)

Hoje ainda não possui, de forma fechada para SaaS:

- login de usuários
- banco de usuários e memberships
- sessão autenticada
- recuperação de acesso
- separação formal entre cliente, admin e super admin
- suporte persistido
- ajuda centralizada
- persistência principal da operação fora de local storage

## Princípios de arquitetura

- O motor de cálculo continua separado da camada visual e da camada de autenticação.
- O workspace passa a ser a unidade principal de operação do cliente.
- Usuário pertence à plataforma; permissões pertencem à relação usuário + workspace.
- A camada interna da plataforma não deve vazar para o cliente final.
- A precificadora deve atender mais de um tipo de produção física, sem misturar regras.

## Estrutura do produto

### Camada pública

Rotas:

- `/`
- `/login`
- `/recuperar-acesso`
- `/contato`

Responsabilidades:

- apresentar proposta de valor
- explicar para quem a ferramenta serve
- mostrar diferença entre custo real, preço saudável e pressão do canal
- captar leads ou iniciar login
- permitir recuperação de acesso
- receber contato comercial

### Camada autenticada do cliente

Prefixo recomendado:

- `/app`

Rotas:

- `/app`
- `/app/precificacao`
- `/app/historico`
- `/app/preferencias`
- `/app/ajuda`
- `/app/suporte`
- `/app/conta`

Responsabilidades:

- usar a precificadora
- salvar histórico
- editar políticas do workspace
- consultar ajuda
- abrir e acompanhar chamados
- ver mensagens operacionais e integrações

### Camada interna da plataforma

Prefixo recomendado:

- `/internal`

Rotas:

- `/internal`
- `/internal/workspaces`
- `/internal/users`
- `/internal/support`
- `/internal/audit`
- `/internal/settings`

Responsabilidades:

- operar clientes
- acompanhar workspaces
- tratar suporte
- ver logs e auditoria
- executar impersonação segura
- bloquear ou liberar contas

## Papéis e permissões

### Papéis da plataforma

- `super_admin`
- `platform_admin`
- `support_agent`
- `developer`

### Papéis do workspace

- `owner`
- `manager`
- `operator`
- `finance`

### Regra principal

Um mesmo usuário pode:

- ser `super_admin` na plataforma
- e ao mesmo tempo não ter papel algum em um workspace

Ou:

- ser usuário comum da plataforma
- e ser `owner` em um workspace específico

### Permissões resumidas

`super_admin`

- acesso irrestrito à camada interna
- impersonação segura
- leitura de todos os workspaces
- gestão de usuários e memberships

`platform_admin`

- gestão operacional da plataforma
- sem permissões técnicas perigosas por padrão

`support_agent`

- acesso a tickets
- leitura limitada de workspaces
- impersonação assistida, com trilha de auditoria

`developer`

- leitura técnica interna
- sem acesso comercial irrestrito por padrão, salvo se acumulado com outro papel

`owner`

- controla preferências
- gerencia membros do workspace
- vê suporte e histórico

`manager`

- gerencia operação e histórico
- não altera tudo que for sensível por padrão

`operator`

- usa a precificadora
- salva histórico
- sem administração do workspace

`finance`

- vê custos, margens, relatórios e histórico
- não necessariamente edita configuração operacional

## Modelo de dados

### 1. `users`

Representa a identidade do usuário na plataforma.

Campos mínimos:

- `id`
- `email`
- `password_hash`
- `full_name`
- `platform_role`
- `status`
- `created_at`
- `updated_at`
- `last_login_at`

### 2. `workspaces`

Representa a conta operacional do cliente.

Campos mínimos:

- `id`
- `name`
- `slug`
- `owner_user_id`
- `business_mode`
- `status`
- `created_at`
- `updated_at`

`business_mode` inicial:

- `3d`
- `artesanal`
- `hibrido`

### 3. `workspace_memberships`

Relaciona usuário com workspace.

Campos mínimos:

- `id`
- `workspace_id`
- `user_id`
- `workspace_role`
- `invited_by_user_id`
- `created_at`

### 4. `workspace_preferences`

Persiste a configuração que hoje vive em preferências locais.

Campos mínimos:

- `id`
- `workspace_id`
- `default_display_currency`
- `business_preset_id`
- `pricing_defaults_json`
- `profit_destinations_json`
- `updated_by_user_id`
- `updated_at`

### 5. `calculation_snapshots`

Persiste cada cálculo salvo.

Campos mínimos:

- `id`
- `workspace_id`
- `created_by_user_id`
- `product_name`
- `production_mode`
- `sales_channel_id`
- `form_payload_json`
- `result_payload_json`
- `summary_json`
- `created_at`

### 6. `workspace_audit_events`

Trilha de ações sensíveis.

Campos mínimos:

- `id`
- `workspace_id`
- `actor_user_id`
- `event_type`
- `message`
- `metadata_json`
- `occurred_at`

### 7. `auth_sessions`

Sessões de login.

Campos mínimos:

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`
- `revoked_at`
- `ip_address`
- `user_agent`

### 8. `password_reset_tokens`

Recuperação de acesso.

Campos mínimos:

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `used_at`
- `created_at`

### 9. `support_tickets`

Canal de suporte dentro do produto.

Campos mínimos:

- `id`
- `workspace_id`
- `created_by_user_id`
- `subject`
- `status`
- `priority`
- `category`
- `created_at`
- `updated_at`

### 10. `support_messages`

Mensagens do ticket.

Campos mínimos:

- `id`
- `ticket_id`
- `author_user_id`
- `author_type`
- `message`
- `attachments_json`
- `created_at`

### 11. `workspace_contacts`

Canal comercial e operacional.

Campos mínimos:

- `id`
- `workspace_id`
- `contact_type`
- `name`
- `email`
- `phone`
- `created_at`

## Fluxo de autenticação

### Login

1. usuário acessa `/login`
2. envia email e senha
3. sistema valida credenciais
4. cria sessão persistida
5. redireciona para `/app`

### Recuperação de acesso

1. usuário acessa `/recuperar-acesso`
2. informa email
3. sistema gera token temporário
4. envia link seguro
5. usuário redefine senha
6. tokens antigos são invalidados

### Proteção de rotas

- rotas públicas: livres
- rotas `/app`: exigem sessão válida
- rotas `/internal`: exigem `platform_role`

### Impersonação segura

Disponível apenas para `super_admin` e, opcionalmente, `support_agent`.

Regras:

- sempre registrar auditoria
- mostrar banner visível de impersonação
- exigir motivo
- permitir encerrar sessão assistida

## Suporte, ajuda e orientação de uso

Os itens `5, 6, 7 e 8` podem ficar parcialmente na área do usuário, mas não exclusivamente nela.

### Onde cada item deve viver

`canal de contato`

- público em `/contato`
- autenticado em `/app/suporte`

`resposta a erro`

- distribuída no produto todo
- com mensagens amigáveis
- com fallback operacional
- com registro técnico interno

`recuperar acesso`

- público em `/recuperar-acesso`

`orientação de uso`

- central em `/app/ajuda`

### Estrutura sugerida da ajuda

- primeiros passos
- como precificar produto 3D
- como ler lucro, margem e preço mínimo
- quando um canal está inviável
- como funciona benchmark comercial
- limites da ferramenta

## Resposta a erro

Não tratar erro como tela isolada. Tratar como sistema.

Camadas:

- erro de formulário
- erro de autenticação
- erro de integração
- erro de permissão
- erro inesperado

Regras:

- mensagem clara para o usuário
- ação recomendada
- id do erro quando necessário
- log interno para suporte

## Estrutura de navegação recomendada

### Público

- `Home`
- `Como funciona`
- `Para quem é`
- `Contato`
- `Login`

### Cliente autenticado

- `Precificadora`
- `Histórico`
- `Preferências`
- `Ajuda`
- `Suporte`
- `Conta`

### Interno

- `Workspaces`
- `Usuários`
- `Suporte`
- `Auditoria`
- `Operação`

## Expansão para público artesanal

O item `9` faz sentido, mas deve entrar como extensão arquitetural do produto, não como remendo.

### Estratégia correta

Criar um `production_mode` no motor e na interface.

Modos iniciais:

- `3d`
- `artesanal`

### O que é compartilhado

- embalagem
- mão de obra
- perdas
- taxas de canal
- imposto operacional
- margem alvo
- lucro e leitura de viabilidade

### O que muda no modo `3d`

- tempo de impressão
- filamento
- consumo da impressora
- manutenção por hora da máquina

### O que muda no modo `artesanal`

- lista de matérias-primas
- etapas manuais
- tempo de produção manual
- custo por técnica ou acabamento

### Recomendação de modelagem

Não duplicar a precificadora.

Fazer:

- um núcleo de cálculo comum
- adaptadores de entrada por modo de produção
- seções de formulário específicas por modo

## Estratégia de persistência

Estado local atual deve virar persistência real em fases.

### Fase 1

Migrar primeiro:

- usuários
- sessões
- workspaces
- memberships
- preferências do workspace

### Fase 2

Migrar:

- histórico de cálculos
- auditoria
- tickets de suporte

### Fase 3

Migrar:

- presets avançados
- relatórios
- validações comerciais

## Roadmap recomendado

### Fase A: base comercial mínima

- landing page
- login
- recuperação de acesso
- banco de usuários
- workspaces
- memberships

### Fase B: operação SaaS mínima

- persistência de preferências
- persistência de histórico
- suporte interno
- ajuda do usuário
- resposta a erro consistente

### Fase C: operação madura

- super admin
- auditoria forte
- impersonação segura
- status operacional de integrações
- relatórios por workspace

### Fase D: expansão de produto

- modo artesanal
- benchmarks por nicho
- presets por segmento

## Decisões recomendadas agora

1. Criar prefixos de rota separados: público, app e interno.
2. Formalizar `users`, `workspaces` e `workspace_memberships` como núcleo de dados.
3. Tratar `super admin` como papel explícito de plataforma, não como gambiarra de acesso irrestrito.
4. Tirar dependência principal de local storage para preferências e histórico.
5. Estruturar suporte e ajuda já pensando em escala.
6. Preparar o motor para `production_mode`, abrindo caminho para o público artesanal.

## Ordem de implementação sugerida

1. landing page
2. autenticação
3. banco de usuários e workspaces
4. proteção de rotas
5. preferências persistidas
6. histórico persistido
7. ajuda e suporte
8. camada interna da plataforma
9. modo artesanal
