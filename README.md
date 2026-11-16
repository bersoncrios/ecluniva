# Quadrei

Gestão do rol das sociedades internas IPB: UPH, SAF, UMP, UCP e UPA. Angular 20 standalone, Signals, AngularFire, Firebase Auth/Firestore e Tailwind CSS. Sem Cloud Functions.

## Desenvolvimento

Use Node 22.12+ da linha 22 ou Node 24 (`nvm use`).

```sh
npm ci
cp .env.example .env.hml
# Preencha .env.hml com a configuração HML. Não versione o arquivo.
npm start
```

Abra `http://localhost:4200`. Na primeira entrada, use Google e crie uma sociedade com igreja, tipo e nome da unidade. O rol permite cadastrar, editar, inativar/reativar, buscar, filtrar e exportar. Ao completar o CEP, o ViaCEP busca logradouro, bairro, cidade e UF; número e complemento permanecem manuais. Todos os campos continuam editáveis, inclusive quando o serviço estiver indisponível. A consulta transmite somente o CEP e não salva o cadastro automaticamente. Os aniversariantes consideram somente ativos e usam o dia civil de America/Araguaina. A página Diretoria organiza os membros e cargos por ano, mantendo composições de anos anteriores.

### Firebase HML

O dono deve habilitar Google em Authentication e autorizar os domínios usados (localhost e domínio Vercel de HML). O Firestore precisa estar criado e ter regras remotas adequadas antes de usar dados reais. **Esta entrega não publica regras Firebase**: `firestore.rules` e `firebase.json` destinam-se a testes locais/emulator. Configuração Firebase Web não substitui autorização de acesso.

Não coloque credenciais de contas de serviço no frontend. `.env.hml` e `.env.prod` são locais e ignorados; `.env.example` contém somente placeholders. As variáveis de configuração Web são incorporadas ao JavaScript compilado, como necessário para o SDK Firebase cliente; o controle de acesso depende das Security Rules.

## Testes locais

```sh
npm test
npm run test:emulator
# Regras + interface, com serviços iniciados e encerrados automaticamente:
npm run test:local
```

Os testes unitários compilam as funções TypeScript reais para `.test-dist/` e executam Node `--test`. Os testes de regras usam somente `demo-quadrei`, sem credenciais reais, exigindo Java e as portas 9099/8080 livres.

Para testar a interface inteira com Auth/Firestore locais, use terminais separados:

```sh
npx firebase emulators:start --project demo-quadrei --only auth,firestore
node scripts/angular-env.mjs serve emulator --host 127.0.0.1 --port 4200
npm run test:ui
```

O formulário de acesso exclusivo do modo emulator recebe contas criadas pelo teste no Auth emulator. Não aparece em HML/PROD. Os testes de navegador usam Google Chrome instalado; `QUADREI_CHROME_PATH` (ou `SOCIETAS_CHROME_PATH`) pode selecionar outro executável quando suportado pelo teste. Não mantenha dados reais nos emuladores.

## Builds e Vercel

```sh
npm run build:hml
npm run build:vercel
```

Saída: `dist/quadrei/browser`. `vercel.json` configura build, diretório estático, navegação SPA e cabeçalhos básicos. Na Vercel, configure as variáveis `FIREBASE_*` de `.env.example` no ambiente correspondente: HML em Preview e PROD em Production. Os arquivos `.env.*` não devem ser enviados ao provedor nem ao Git.

`scripts/vercel-build.mjs` usa `VERCEL_GIT_COMMIT_REF` (ou branch Git local). `develop`/`hml` → HML; `main`/`master` → PROD; outra branch falha com mensagem. O script valida o projectId esperado. Use a branch develop para HML.

**Produção exige aprovação explícita do dono.** Além da branch correta e configuração PROD, o build Vercel exige `QUADREI_PROD_APPROVED=true`, que deve ser configurado somente após essa aprovação. Receber a configuração de produção não autoriza publicação. `npm run build:prod` compila um artefato local; não implanta nem publica regras.

## Estrutura

- `src/app/app.*`, `icon.ts`, `src/styles.css`: telas, navegação, formulários e identidade visual.
- `src/app/core/data.service.ts`: autenticação e assinaturas Firestore com isolamento por contexto.
- `src/app/core/models.ts`: contrato TypeScript dos registros.
- `src/app/core/domain.ts`: validação, normalização, filtros e calendário.
- `src/app/core/export.ts`: exportações PDF e XLSX carregadas sob demanda.
- `src/app/core/viacep.ts`: consulta HTTPS ViaCEP, validação de formato e resposta; sem chave de API ou Cloud Functions.
- `src/app/core/board.ts` e `src/app/features/board/`: vínculo anual de diretoria, validação e página de composição.
- `scripts/angular-env.mjs`: lê `.env.hml`/`.env.prod`, ou variáveis do provedor, e gera environments ignorados.
- `tests/`: testes unitários, emulator e navegador.

O código já está organizado nos caminhos de destino; não é necessário criar os arquivos manualmente. As datas civis são strings ISO e não timestamps. Telefone/CEP são normalizados como dígitos. Observações não entram nas exportações. O filtro ativo é o padrão; exportar usa todo o resultado filtrado.

## Documentação de produto

[Pesquisa](RESEARCH.md) · [Backlog](BACKLOG.md) · [Escopo](MVP_SCOPE.md) · [Design](DESIGN_SYSTEM.md) · [Wireframes](WIREFRAMES.md) · [Marca e textos](BRAND.md) · [Schema e regras](FIRESTORE_SCHEMA.md) · [Plano de QA](QA_PLAN.md) · [Andamento e verificação](STUDIO_STATUS.md)

Limite inicial de suporte: 1.000 membros por sociedade, sem paginação de rede. As consultas carregam o rol da sociedade do proprietário para cálculos e busca locais. Validação automatizada com massa sintética não substitui avaliação de latência e custos no projeto real. O app não inclui importação, convites ou administração compartilhada.

## Diretoria por ano

Na página Diretoria, escolha o ano e adicione membros cadastrados com seus cargos. Há sugestões de cargos e espaço para escrever outro nome. Cada membro tem um cargo por ano; editar ou remover sua participação não altera outros anos nem o cadastro. Inativos podem constar para recompor histórico. Na edição de um membro, o atalho para definir participação abre a diretoria do ano atual com ele pré-selecionado; salve antes as alterações do cadastro. A ação da diretoria é independente do salvamento cadastral.

O campo Ofício registra a função na igreja; cargo da diretoria é anual e não concede acesso ao sistema. Os nomes exibidos vêm do cadastro atual. Vínculos são armazenados em `societies/{societyId}/boardAssignments/{year}_{memberId}`. Nenhuma migração dos membros existentes é necessária. As regras locais foram estendidas para essa coleção; um projeto remoto precisa de regras equivalentes aplicadas pelo responsável antes de usar essa funcionalidade. Esta entrega mantém a política de não publicar regras remotas automaticamente.

### Atas e plenárias

O menu **Atas e plenárias** reúne agendamento, chamada no dia civil da reunião, diretoria anual, recepção de novos sócios, redação com prévia e exportação PDF A4. A lavratura congela o documento e os presentes. Consulte [regras e limitações do módulo](docs/ATAS.md), incluindo a comparação pendente com o original da ATA 025.

### Convocações

O menu **Convocações** permite criar documentos para reuniões plenárias, da Comissão Executiva e da diretoria, com local, endereço, horário livre, pauta opcional e assinaturas. Oferece prévia, histórico editável e download em PDF ou Word, sem numeração de páginas. Consulte [o módulo de convocações](docs/CONVOCACOES.md).

### Comunicação e cartões de aniversário

Em **Aniversariantes → Comunicação e publicações**, convide a equipe por e-mail, compartilhe apenas nomes e dia/mês, acompanhe publicações e gere cartões PNG para feed e story. O destinatário entra com o Google do endereço convidado e aceita o acesso. O responsável configura cores, logotipo e mensagem padrão e pode revogar o acesso. O convite pode ser copiado ou aberto como e-mail pronto para envio no cliente do usuário. Consulte [Comunicação e permissões](docs/COMUNICACAO.md).

### Presença por QR Code

Abra uma plenária no dia da reunião e gere seu link e QR Code. Os participantes informam nome completo e código, sem conta. O secretário acompanha a vinculação com os membros ativos, revisa homônimos e usa a mesma chamada na ata. Mantenha a plenária aberta para a conferência automática. Consulte [Presença nas plenárias](docs/PRESENCA_PLENARIAS.md).
