# Muvpet

**Mais carinho. Mais economia.** Uma aplicação para organizar a vida com cães e gatos, administrar conteúdo e avaliar parceiros comerciais.

## Estado da entrega

O diretório inicial estava vazio. Foi implementada uma fundação com frontend, APIs, autenticação real, esquema relacional e migrações. Não houve substituição de uma aplicação existente nem importação de dados fictícios.

Esta entrega **não deve ser considerada pronta para lançamento comercial** sem publicação, configuração do primeiro administrador, revisão jurídica e validação dos fluxos em um ambiente real. O ambiente desta sessão proibiu iniciar servidores, executar builds e rodar testes. Nenhum teste foi declarado aprovado. As migrações foram geradas, mas sua aplicação e o provisionamento do banco dependem do deploy da plataforma.

### Implementado no código

- Cadastro, login, logout, confirmação de e-mail, convites e recuperação de senha por Netlify Identity.
- Sessões em cookies `HttpOnly`, `Secure` e `SameSite=Lax`. Não há banco ou autenticação em `localStorage`. Nenhum token de sessão é retornado ao frontend em JSON.
- Área do tutor: criação, edição e exclusão de pets, imagens privadas, perfil e preferências.
- Agenda: criação, edição, exclusão, conclusão, reabertura, filtro por pet e histórico de cuidados concluídos.
- Favoritos persistentes de conteúdos publicados.
- Cadastro comercial pendente, edição de perfil e submissões próprias com feedback administrativo.
- Administração protegida: indicadores do banco, aprovação comercial, catálogo unificado de artigos, produtos, lugares e eventos, revisão de links, rascunhos, publicação, despublicação por mudança de status e arquivamento.
- Preços opcionais com data de verificação, identificação de links de afiliado e exclusão de eventos expirados das consultas públicas.
- Upload JPG, PNG e WebP com limite de 5 MB, verificação da assinatura do arquivo e armazenamento em Netlify Blobs.
- Solicitações de suporte, denúncias e exclusão, exportação JSON dos dados da própria conta e auditoria administrativa.
- Teste de 30 dias inicialmente, preço planejado de R$ 5,90, periodicidade indefinida e cobrança bloqueada no servidor e por restrição do banco.
- Interface responsiva, navegação móvel, formulários rotulados, diálogos acessíveis, feedback e confirmação de exclusões.
- Metadados da marca, `robots.txt` e sitemap inicial apenas da página pública principal.

O catálogo público inicia vazio. As fotografias e chamadas da página inicial ilustram recursos da plataforma; não representam cadastros, fornecedores, eventos ou avaliações existentes. O banner de cães e gatos foi criado com IA como imagem de marca; o logo foi fornecido pelo proprietário. As fotografias de inspiração vieram do Unsplash e foram armazenadas localmente.

### Ainda não implementado

- Calendário mensal/semanal, recorrência automática, lembretes enviados por e-mail ou push e central de notificações.
- Avaliações e comentários de usuários, mecanismos adicionais antispam e verificação de avaliações.
- Mapa, geolocalização, distância, filtros avançados por datas, acesso pet-friendly e serviços oferecidos.
- Páginas editoriais individuais com URLs próprias, SEO por publicação, tags e categorias administradas como entidades independentes.
- Publicação programada, gestão de banners, biblioteca completa de arquivos, histórico de versões com comparação e relatórios de uso/retorno/satisfação.
- Todas as 16 páginas administrativas propostas. Nesta fundação, o catálogo é unificado e as áreas de gestão são agrupadas em seis abas. Não há acesso geral a informações privadas dos pets.
- Gestão administrativa completa de tutores, suspensão com procedimento de revisão e papéis adicionais.
- Planos com benefícios configuráveis, cobrança, assinaturas, webhooks, receita, cancelamento e reembolso.
- Exclusão automatizada e download de imagens em lote. Solicitar exclusão registra um pedido; não apaga imediatamente a conta.
- Integrações de marketplaces, afiliados automatizados, marketing e GitHub. Links de afiliado podem ser cadastrados manualmente, mas nenhum programa foi ativado automaticamente.

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Aplicação | TanStack Start, React 19, TypeScript, Vite |
| Interface | Tailwind CSS 4, CSS de marca, Radix UI, Lucide e Sonner |
| API | Netlify Functions, validação Zod e autorização no servidor |
| Dados | Netlify Database, PostgreSQL e Drizzle ORM beta |
| Autenticação | Netlify Identity e `@netlify/identity` para validação server-side e encerramento de sessão |
| Arquivos | Netlify Blobs; imagens da marca por Netlify Image CDN |

A autenticação usa um gateway server-side para a API oficial do Identity. Isso evita a persistência de tokens no armazenamento local que ocorreria com o SDK de navegador. E-mail e senha só são enviados ao backend de mesma origem e ao serviço Identity do próprio site. O backend não aceita papéis no cadastro; o papel administrativo é lido de metadados controlados pelo Identity.

Tabelas: `profiles`, `pets`, `care_tasks`, `suppliers`, `content`, `favorites`, `settings`, `files`, `support_requests`, `audit_logs` e `rate_limits`.

`content` unifica os quatro tipos de publicação nesta etapa. As tarefas têm vínculo composto entre pet e titular, garantindo a associação também no PostgreSQL. Os índices aceleram consultas por titular, data, status e tipo. Restrições protegem espécies, status, preço verificado, datas de teste e desativação de cobrança.

As operações administrativas de conteúdo, fornecedores e configurações são transacionais com auditoria. As consultas públicas verificam publicação, validade do evento e aprovação do fornecedor, inclusive em caso de alteração concorrente do perfil comercial. Dados de moderação e IDs dos titulares não são incluídos no catálogo público.

## Execução local

Requisitos: Node.js 22.12 ou superior, pnpm e Netlify CLI. Use o arquivo de lock do projeto.

```bash
pnpm install
netlify login
netlify link
netlify dev --port 8889
```

O site deve estar vinculado ao projeto correto. O Netlify CLI fornece o contexto de Identity, Database e Blobs; executar somente Vite não emula toda a aplicação. Os cookies de sessão exigem um contexto seguro; use localhost ou HTTPS. Não desative `Secure` para publicar a aplicação.

Não são necessárias chaves frontend ou uma URL pública de conexão do banco. As configurações das primitivas Netlify são resolvidas pela plataforma. Credenciais de operação, quando necessárias, pertencem ao ambiente protegido, nunca ao repositório. O gerador opcional de imagens usa os nomes `NETLIFY_AI_GATEWAY_KEY` e `NETLIFY_AI_GATEWAY_BASE_URL` apenas no processo de geração; a aplicação não precisa gerar imagens em produção.

## Publicação e banco

1. Vincule o repositório ao projeto Netlify sob sua conta.
2. Preserve `netlify.toml`, `drizzle.config.ts` e `netlify/database/migrations/` no repositório.
3. Publique pelo fluxo Git da plataforma. O build instala dependências e processa a aplicação; as migrações da pasta configurada são aplicadas pelo Netlify Database.
4. Confira no painel o status do banco, das migrações, das Functions e do Identity. Um erro de banco ou serviço é mostrado na interface, não substituído por dados de demonstração.
5. Confirme o endpoint público `/api/muvpet/public` e execute a matriz de validação antes de convidar usuários.

Para alterações de esquema:

```bash
pnpm exec drizzle-kit generate --name add_descriptive_change
```

Edite primeiro `db/schema.ts`, gere e revise a migração e publique junto com o código. Não renomeie ou altere migrações já aplicadas. O projeto usa `drizzle-orm@beta` e `drizzle-kit@beta` porque o adaptador `netlify-db` desta configuração está nessa linha; não atualize para outra distribuição sem revisar compatibilidade.

## Ativar e configurar Identity

O marcador de ativação do Identity foi criado nesta sessão. Quando necessário, execute o script `scripts/enable.cjs` da skill Netlify Identity disponibilizada pelo ambiente de desenvolvimento. Não existe senha administrativa padrão.

No painel do projeto Netlify:

1. Abra **Identity** e confirme a ativação e o cadastro aberto para tutores.
2. Mantenha a confirmação de e-mail ativada para produção. Confira o URL de retorno dos e-mails, os templates de confirmação, convite e recuperação e as regras de senha.
3. Configure o remetente/SMTP apropriado e teste a entrega real das mensagens. Enviar uma solicitação à API não prova entrega do e-mail.
4. Ative proteção contra abuso e limites disponíveis no serviço. O gateway da aplicação também limita tentativas por um hash temporário do IP; não mantém o endereço bruto no banco.

### Primeiro administrador

1. Em **Identity → Invite users**, convide o e-mail do proprietário.
2. Aceite o convite pela aplicação, escolha a senha e aceite os termos.
3. No detalhe desse usuário no painel Identity, adicione o papel **`admin`** e salve.
4. Saia e entre novamente. O link **Administração** aparece na navegação; o servidor verifica o papel em cada acesso administrativo.

Não configure papéis em `user_metadata`, não aceite papéis enviados por formulários e não crie uma senha pública. Use uma conta separada para atuar como fornecedor. Novos fornecedores ficam pendentes mesmo que tentem enviar outro status.

## Armazenamento e privacidade

O store persistente de imagens se chama `muvpet-images`. Cada chave é um UUID, e sua autorização e tipo ficam no banco. Imagens privadas são servidas somente ao titular, sem transformação pública pelo Image CDN. Administradores podem visualizar imagens vinculadas a conteúdo comercial para revisão, não imagens privadas de pets de outras contas. Uma imagem comercial se torna pública somente enquanto estiver vinculada a conteúdo publicado de fornecedor aprovado.

Os textos jurídicos iniciais estão em diálogos de termos e privacidade. O aceite de cadastro/convite é verificado no servidor e armazenado com data e versão; preferências de comunicação são independentes. Contas criadas diretamente fora do fluxo da aplicação podem ter aceite não registrado e precisam de regularização antes do lançamento.

Para lançar, obtenha revisão jurídica e defina controlador, canal de contato, retenção, bases legais, contratos com operadores e procedimentos de atendimento. A aplicação não declara conformidade LGPD completa. A edição integral dos textos jurídicos pelo painel ainda está pendente.

Solicitações de exclusão devem ser avaliadas e atendidas por um operador autorizado. Exporte os registros necessários, identifique chaves de arquivos, decida a retenção legítima de conteúdo comercial/auditoria, remova os dados autorizados no banco e no Blobs e encerre a identidade no painel. O pedido só deve ser marcado como resolvido depois do procedimento. Não exclua diretamente um perfil de fornecedor sem tratar seus conteúdos e relacionamentos.

## Teste gratuito e cobrança

O teste começa na data de criação da identidade. No cadastro pela aplicação, início, término e aceite são gravados no PostgreSQL. Convites/contas legadas são cadastrados no banco no fluxo de convite ou no primeiro acesso autenticado. Uma vez persistidas, as datas não são recalculadas nos logins seguintes.

Configurações iniciais: 30 dias, R$ 5,90 e periodicidade não definida. Ajustes administrativos afetam novos períodos; não reiniciam testes concedidos. O fim do teste não provoca cobrança nem bloqueio de acesso nesta versão, pois não existem plano pago e integração ativa.

Para ativar pagamentos em outra fase, confirme periodicidade, início, benefícios, cancelamento e reembolso. Implemente checkout seguro, assinatura, webhooks autenticados, idempotência, histórico e reconciliação. Remova a restrição que impede `billing_enabled=true` somente em uma migração específica acompanhada de testes reais. Não colete cartão no frontend.

## Validação

Foram escritos testes de políticas de publicação/afiliados, URLs, assinaturas de arquivos e cálculo do teste. Também foram escritos testes HTTP opcionais para bloqueio anônimo, rejeição de origem indevida e ausência de dados de moderação no catálogo. **Eles não foram executados nesta sessão.**

Em um ambiente autorizado:

```bash
pnpm test
pnpm typecheck
```

Para os testes HTTP, configure `MUVPET_TEST_URL` apontando para um deploy de teste. Sem essa configuração, eles são ignorados, não aprovados. Os testes atuais não substituem testes autenticados ponta a ponta e de interface.

Matriz mínima de homologação — todos os fluxos abaixo ficaram pendentes de execução real nesta entrega:

| Fluxo | Verificação |
| --- | --- |
| Cadastro | Conta real, aceite registrado, confirmação e entrega do e-mail |
| Acesso | Login, recuperação, convite, logout e expiração/renovação da sessão |
| Pets | Criar, editar, excluir, imagem privada e persistência após novo login |
| Isolamento | Segunda conta não acessa, altera ou exclui pets, tarefas, favoritos ou imagens da primeira |
| Agenda | Criar, editar, concluir, reabrir e excluir cuidados; histórico e titular correto |
| Fornecedor | Cadastro pendente, revisão, rejeição, correções e aprovação administrativa |
| Conteúdo | Submissão invisível antes de aprovação, nova avaliação depois de edição e impedimento de autopublicação |
| Administração | Cadastro e atualização de todos os quatro tipos, links, preço/data, prévia e arquivamento |
| Arquivos | JPG/PNG/WebP reais, rejeição de extensão falsificada, limite e persistência entre deploys |
| Segurança | Requisições sem sessão, origem indevida, tentativa de elevação de papel e limite de tentativas |
| Teste | Início/fim salvos, não reiniciar após login e impossibilidade de ativar cobrança |
| Privacidade | Exportação apenas dos próprios registros, denúncia e solicitação de exclusão |
| Interface | Teclado, leitor de tela, celular, tablet, computador e falhas de rede |
| Publicação | Migrações aplicadas, links externos reais, domínio HTTPS e textos jurídicos revisados |

## Backup, restauração e manutenção

- Antes de publicar mudanças estruturais, faça um backup PostgreSQL pelo procedimento disponibilizado pelo Netlify Database ou use `pg_dump` a partir de uma conexão protegida obtida no painel. Nunca publique a string de conexão.
- Guarde o dump criptografado fora do repositório, junto com a versão das migrações e data da cópia. Valide a restauração em um ambiente separado antes de confiar no backup.
- Faça backup separado do store `muvpet-images`, preservando chaves UUID e vínculos da tabela `files`. Um dump do banco não inclui os arquivos binários.
- Restaure com `pg_restore`/`psql` no ambiente escolhido e confira chaves, restrições, contagens e permissões. Não restaure usuários Identity apenas a partir de `profiles`: contas e senhas são geridas separadamente pelo provedor.
- Monitore falhas e latência em **Functions → Logs** e os eventos do banco no painel. Logs da API não incluem senha, token ou conteúdo privado dos pets. Um serviço externo de monitoramento ainda não foi integrado.
- Atualize dependências em mudanças pequenas, mantenha o lockfile e valide os fluxos em deploy preview. Reverter código não desfaz uma migração; mudanças de esquema devem ser reversíveis ou retrocompatíveis.

Para domínio próprio, configure **Domain management**, DNS e TLS no Netlify e atualize URLs de retorno do Identity e `public/sitemap.xml`. Confira os fluxos de e-mail novamente após mudar o domínio.

Para GitHub, exporte/vincule este repositório a uma conta sob seu controle e conecte o projeto Netlify. Nenhum repositório GitHub foi criado automaticamente. Para outra hospedagem, preserve o código React e o esquema PostgreSQL e implemente adaptadores para Identity, Database e Blobs; exporte dados e imagens e planeje a migração de autenticação com o provedor. Não troque os serviços sem testar autorização e recuperação de contas.

## Próximas fases

1. **Fundação:** código entregue; homologação real, primeiro administrador e revisão jurídica pendentes. Não considerada concluída para lançamento.
2. **Rotina:** agenda em lista e histórico entregues; calendário, recorrência e notificações pendentes.
3. **Descobertas:** catálogo editorial/lugares/eventos e filtros básicos entregues; URLs individuais, SEO por conteúdo e filtros avançados pendentes.
4. **Parceiros:** produtos/links manuais e aprovação entregues; avaliações, integrações e histórico detalhado de versões pendentes.
5. **Crescimento:** pagamento desativado; requisitos comerciais, cobrança, indicadores de utilidade e comunicação pendentes.
