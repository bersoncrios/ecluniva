# Ecluniva — entrega e verificação

Atualizado em 15/11/2026. Desenvolvimento do MVP concluído e validado localmente. A solicitação de continuidade do dono liberou a identidade visual e o avanço automático das especialidades. Produção não foi promovida.

## Entregas do estúdio

| Especialidade | Entregas |
| --- | --- |
| Pesquisador | RESEARCH.md, fontes primárias e limites da pesquisa |
| Product Owner | BACKLOG.md e MVP_SCOPE.md, histórias e critérios de aceite |
| UX/UI Designer | DESIGN_SYSTEM.md, WIREFRAMES.md e preview-design.html |
| Copywriter & Brand Strategist | BRAND.md, onboarding, ações, erros e estados vazios |
| Backend Engineer | FIRESTORE_SCHEMA.md, firestore.rules, firestore.indexes.json e firebase.json local |
| Frontend Developer | Angular standalone + Signals, AngularFire, Tailwind, autenticação, sociedades, rol, aniversariantes e exportações |
| QA Engineer | QA_PLAN.md, testes de domínio, ambientes, regras e navegador |

## Evidências executadas

| Verificação | Resultado |
| --- | --- |
| Build HML otimizado, TypeScript e templates estritos | Aprovado; saída dist/quadrei/browser |
| Domínio e ambientes, Node --test | 18/18 aprovados |
| Integração de Security Rules em emulator | 9/9 aprovados |
| Jornada completa no Chrome com Auth/Firestore locais | 1/1 aprovada |
| Larguras de 320, 390 e 1440 px | Sem rolagem horizontal de página nos fluxos exercitados |
| Planilha real com 46 registros | Aprovada: acentos/datas, endereço, todas células de texto, sem fórmulas ou observações |
| PDF real com 46 registros | Aprovado: 3 páginas; assinatura PDF; primeira página inspecionada visualmente |
| Massa sintética de 1.000 membros | Busca, resumo, aniversários e linhas de exportação consistentes |
| Lockfile | 1.300 entradas de dependências com versão; sem entradas incompletas |
| Ambientes | Arquivos locais com permissões 0600; padrões .gitignore e placeholders verificados |

Total: **28 testes aprovados**, sem falhas ou testes ignorados na execução final. O teste de capacidade valida funções de domínio; não mede latência de rede nem tempo de PDF para 1.000 registros.

O navegador exerceu entrada de conta local, criação de sociedade, validação de formulário, cadastro com todos os grupos, busca sem acentos, edição, inativação/cancelamento/reativação, aniversariante de hoje, filtros, exportações, foco/Escape de diálogo, troca de sociedade, saída e recarga após saída. Nenhuma exceção não tratada de página foi registrada.

Os testes de regras negaram anônimos e terceiros, consultas sem ownerId, alteração de proprietário, adulteração de timestamps, chaves indevidas, status/tipos inválidos, datas impossíveis/futuras e exclusão. Permissões negadas nesses casos são resultados esperados.

### Ambiente de verificação

Node 22.12.0 para build/testes, Firebase SDK 11.10.0, Firebase CLI 15.36.0 disponível no ambiente de desenvolvimento, Firestore Emulator 1.22.0, Java 24 e Google Chrome local. O projeto fixa Firebase CLI 14.27.0, compatível com o peer opcional do AngularFire 20; essa CLI pode baixar sua própria versão do emulador ao usar os comandos do README.

A integração completa foi executada com a CLI disponível usando `emulators:exec --project demo-quadrei --only auth,firestore` e `node scripts/qa-local.mjs`. O harness inicia o servidor Angular no modo emulator, executa testes e encerra o servidor; ao final restaura a geração do environment HML. Nenhum emulador ou servidor de QA foi deixado ativo pela execução.

Build inicial com dois workers encerrou sem diagnóstico neste ambiente; o padrão foi reduzido para um worker, e o build subsequente passou. Uma instalação interrompida deixou dependências incompletas; foram removidas e instaladas do zero antes da validação final. O compilador dos testes passou a emitir ESM explicitamente. Esses problemas de infraestrutura foram resolvidos.

O build emite avisos de dependências CommonJS transitivas de canvg/html2canvas na exportação lazy de PDF. Não são falhas de compilação; o download foi verificado no navegador. PDF usa rasterização html2canvas e não promete texto selecionável ou estrutura acessível no documento exportado.

## Artefatos locais de QA

Em `artifacts/browser/` (ignorado pelo Git): capturas de dashboard desktop, formulário e rol mobile, XLSX, PDF e imagem da primeira página do PDF. São dados fictícios, sem dados de HML/PROD.

## Operação e limites externos

- `npm start` inicia o app com HML; `npm run build:hml` gera o artefato para Vercel. Consulte README.md.
- Autenticação Google real, domínios autorizados, regras remotas e conectividade com HML/PROD não foram exercitados. As configurações recebidas não comprovam que esses serviços estejam configurados.
- Sem Cloud Functions. Regras Firebase entregues somente para local/emulator, conforme instrução do dono; nenhuma publicação de regras foi executada.
- Nenhum deploy Vercel, configuração de conta externa ou promoção para produção foi realizado. PROD continua exigindo aprovação explícita do dono; o build Vercel também exige QUADREI_PROD_APPROVED=true.
- O dono inicializou o repositório e a base foi publicada em main no GitHub (first commit 3458394). Os arquivos de ambiente foram confirmados ignorados por git check-ignore. O incremento ViaCEP descrito abaixo está entregue no diretório de trabalho.

## Incremento ViaCEP — 15/11/2026

Solicitado pelo dono após o MVP: consulta automática de CEP no cadastro/edição, sem Cloud Functions ou mudança do schema. Fonte oficial consultada e documentos atualizados antes do código. O app preenche logradouro, bairro, cidade e UF ao completar oito dígitos; preserva número/complemento e alterações manuais durante a consulta. Abrir edição não dispara consulta. Respostas antigas são canceladas/descartadas na troca de CEP, formulário, sessão/tela e ao salvar. Falha, CEP inexistente e timeout de 8 segundos permitem preenchimento manual e repetição. Somente o CEP é enviado ao ViaCEP; não há gravação automática.

Build HML aprovado; 26 testes unitários e 2 jornadas de navegador aprovadas nesta rodada. ViaCEP interceptado nos testes para simular respostas concorrentes, sucesso, CEP inexistente, timeout e HTTP503, sem consultas externas em lote. A jornada do MVP também passou, com PDF/XLSX. Não houve alteração das regras Firestore nem sua republicação. Nenhuma implantação Vercel foi realizada neste incremento. Servidor e emuladores de QA encerrados pelo harness, com environment local restaurado para HML.

## Incremento Diretoria anual — 15/11/2026

Concluído: nova página Diretoria [ano] com seleção de ano, inclusão de membro/cargo, edição e remoção com confirmação. O cargo não é permanente: a composição pode ser definida após cada eleição anual, sem alterar outros anos. Ofício permanece no cadastro da igreja, separado de cargo da diretoria. Na edição de um membro salvo, atalho abre a diretoria do ano atual com aquele membro pré-selecionado; a ação não salva alterações cadastrais pendentes.

Vínculos em societies/{societyId}/boardAssignments/{year}_{memberId}, um cargo por membro/ano, com transação para preservar identidade e createdAt. Ativos/inativos aceitos para recompor histórico; status exibido é o do rol atual. Remover vínculo não remove membro nem participações em outros anos. Não há eleição/votação no aplicativo ou exclusividade estatutária de cargos. Sem migração de cadastros existentes.

Validação: build HML aprovado; 29 unitários e14 testes de regras aprovados;3 jornadas de navegador aprovadas (MVP, ViaCEP e diretoria). Composição anual preservada na troca de ano/recarga; dados de sociedades isolados; layout320/390/1440px sem overflow. Primeira execução do teste novo leu o estado otimista antes de confirmação; o teste foi sincronizado à mensagem de sucesso e passou no reteste, sem alteração do código de produção. Capturas desktop/mobile inspecionadas em artifacts/browser/. As verificações representam 46 testes aprovados no conjunto atual.

Regras locais foram atualizadas para a nova coleção e verificadas somente no emulator, conforme instrução do dono. O projeto Firebase remoto precisará de regras equivalentes aplicadas pelo responsável antes de gravar participações; nenhuma publicação de regras ou deploy foi realizada. Sem commit/push automático neste incremento. O código anterior ViaCEP já consta no GitHub em b45fdf9. Serviços de QA foram encerrados e environment gerado voltou a HML.
