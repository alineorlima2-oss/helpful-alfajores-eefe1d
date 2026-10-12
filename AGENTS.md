# Muvpet — Guia de arquitetura

## Projeto

Aplicação TanStack Start + React + TypeScript para tutores de cães e gatos, hospedada no Netlify. O projeto partiu de um diretório vazio. A página inicial é uma experiência de aplicativo com navegação lateral, não uma landing page com dados simulados.

## Diretórios

- `src/routes/__root.tsx`: documento HTML, metadados e fontes.
- `src/routes/index.tsx`: entrada da aplicação.
- `src/components/muvpet.tsx`: navegação por query string, estado carregado pelas APIs e telas do tutor/fornecedor.
- `src/components/app-modal.tsx`: formulários, autenticação, uploads, prévia e textos jurídicos iniciais.
- `src/components/admin-panel.tsx`: gestão protegida, catálogo e aprovações.
- `src/components/ui/`: componentes Radix/shadcn já disponibilizados.
- `src/lib/api.ts`: cliente HTTP; não contém segredos ou acesso ao banco.
- `src/styles.css`: Tailwind e variáveis base; `src/brand.css`: identidade visual e estilos responsivos.
- `netlify/functions/auth.ts`: gateway da API oficial do Identity e cookies HttpOnly.
- `netlify/functions/muvpet.ts`: API de dados e autorização por titular/papel.
- `db/schema.ts`, `db/index.ts`: Drizzle e Netlify Database.
- `netlify/database/migrations/`: migrações versionadas aplicadas pela plataforma.
- `server/policies.ts`: políticas puras reutilizadas no backend e nos testes.
- `tests/`: testes unitários e HTTP opcionais, não executados na sessão inicial.
- `public/img/`: logo enviado, imagem de marca gerada e fotografias de inspiração locais.
- `scripts/generate-images.mjs`: geração opcional de asset estático pelo AI Gateway; não é funcionalidade pública.

## Convenções e decisões

Use TypeScript estrito, componentes PascalCase e funções camelCase. Não use variáveis de uma letra. Prefira as primitivas existentes e ícones Lucide. Mensagens da interface são em português brasileiro. A marca usa verde escuro, creme e laranja, com Poppins e Nunito Sans.

Dados essenciais pertencem ao Netlify Database, arquivos ao Netlify Blobs. Não use memória, arquivos JSON locais ou localStorage como persistência. Nunca importe o banco em código frontend. Use `@netlify/database` e Drizzle beta; mudanças no esquema sempre precisam de migração gerada em `netlify/database/migrations/`.

O SDK `@netlify/identity` é usado somente no servidor para validar identidade e encerrar sessão. O gateway server-side usa a API oficial para cadastro, verificação e emissão/renovação de cookies HttpOnly. Não substitua esse fluxo por autenticação simulada ou SDK de navegador que persista tokens em localStorage. Papéis vêm exclusivamente de metadados administrativos do provedor. Não aceite papéis enviados pelo usuário.

Todas as operações privadas verificam a titularidade no servidor. Administrador não tem acesso geral aos pets nem a imagens privadas. Fornecedor gerencia apenas suas submissões; só administrador aprova e publica. Alterar perfil comercial ou conteúdo publicado exige avaliação novamente. A consulta pública também verifica aprovação atual do fornecedor e prazo do evento.

Catálogo unificado: `content.kind` diferencia artigos, produtos, lugares e eventos. Rascunhos, pendências e feedback não são públicos. Auditoria de operações comerciais/críticas acompanha alterações em transações. Contagens administrativas vêm de consultas reais; não adicione métricas demonstrativas.

Cobrança está desativada no código e por CHECK no banco. Não remova o bloqueio sem confirmação comercial e integração real testada. Datas de teste são persistentes, baseadas na criação da identidade, e não podem reiniciar a cada login.

Os textos jurídicos são iniciais e precisam de revisão. A exclusão é uma solicitação administrativa, não uma operação automática já implementada. Não anuncie e-mail/push, pagamento, mapa, avaliações ou funções planejadas como disponíveis.

O arquivo `src/routeTree.gen.ts` é gerado pelo framework; não o edite. A navegação interna usa `/?page=...` nesta etapa, e conteúdos públicos individuais com URLs próprias ainda precisam ser implementados. Imagens privadas não podem passar pelo Image CDN público.

## Operação

Consulte `README.md` para execução com `netlify dev --port 8889`, criação segura do primeiro administrador, migrações, homologação, backup e limitações. Não coloque credenciais em arquivos públicos e nunca registre tokens, senhas ou dados privados. Quando o ambiente impedir testes, documente a limitação e não declare aprovação.
