# Quadrei — plano de qualidade

Responsável: AGENTE QA ENGINEER · 15/11/2026  
Estado inicial: plano escrito antes dos testes. A execução e seus resultados serão registrados pelo orquestrador; presença de testes não significa aprovação.

## Estratégia

Node `--test` nativo executa testes de domínio compilado com TypeScript estrito e integração das Security Rules no Firestore Emulator. Dados de teste são fictícios e o projeto é exclusivamente `demo-quadrei`. Nenhuma consulta, escrita ou implantação remota é necessária.

| Feature | Critérios e evidências |
| --- | --- |
| Cadastro e edição | Obrigatoriedade do nome, limites, normalização, campos opcionais, telefone/CEP, UF/e-mail, calendário real, datas futuras e recebimento anterior ao nascimento. UI: valores preservados em falha, duplo envio bloqueado, sucesso apenas depois de confirmação remota. |
| Busca e status | Pesquisa por trecho sem acentos/caixa, combinação com ativos/inativos/todos, ordenação em português, sem mutação dos dados. Resumo independente dos filtros. |
| Aniversariantes | Mês inteiro separado da janela hoje…+29 dias; exclusão de +30 dias, inativos e datas ausentes; virada de ano; empate por nome; adaptação de 29/02; fuso America/Araguaina. |
| Exportação | Linhas ordenadas a partir do filtro, acentos, datas e campos ausentes, observações excluídas, valores semelhantes a fórmulas mantidos como dados. UI: PDF e XLSX reais, multipágina com cabeçalhos e linhas intactas; arquivo vazio indisponível. |
| Capacidade | Massa de 1.000 registros sem truncar a consulta derivada, com contagem, busca e exportação consistentes. O teste funcional não substitui medição de UX em aparelhos reais. |
| Ambientes | Parser sem efeitos colaterais; variáveis obrigatórias; projectId HML/PROD exato; mapeamento develop/hml e main/master; branch desconhecida e produção sem aprovação bloqueadas. |
| Autorização | Proprietário pode criar/ler/listar/editar sua sociedade e seus membros. Anônimo e terceiro não podem ler, listar ou escrever. Consulta de sociedades exige ownerId. IDs conhecidos não dão acesso. |
| Integridade das regras | Negar ownerId forjado/alterado, createdAt alterado, timestamp cliente, chaves extras/ausentes, status/tipos inválidos, datas impossíveis/futuras, campos fora dos limites e exclusão. Permitir inativação/reativação válidas. |

## Comandos

- `npm test`: compila domínio em `.test-dist` e roda `tests/*.test.mjs`.
- `npm run test:emulator`: inicia Auth/Firestore com projeto demo e roda `tests/emulator/*.test.mjs`; precisa de Java e Firebase CLI.
- `npm run build:hml`: compila a aplicação com configuração HML.

Os testes de regras falham com mensagem explícita se `FIRESTORE_EMULATOR_HOST` não estiver definido; não devem cair silenciosamente para um projeto remoto. A suíte limpa os dados entre os casos e fecha conexões ao terminar. O Node de referência do projeto é 22.12+ compatível com Angular 20.

## Inspeção da interface após implementação

Fluxo principal: entrar → criar/selecionar sociedade → cadastrar membro → buscar/filtrar → editar → inativar/reativar → conferir aniversariantes → exportar PDF/XLSX → trocar sociedade → sair.

Verificar em 320, 390, 768 e 1440 px: ausência de rolagem horizontal de página; formulários e navegação sem sobreposição; rótulos, foco e teclado; cancelamento e restauração de foco em diálogos; saída e troca sem dados anteriores. Diferenciar carregamento, erro e vazio. Testar Google Sign-In com cancelamento e falha e confirmar a configuração remota com o dono antes de receber dados reais. Testes automatizados de regras não comprovam configuração de provedores/domínios no Firebase remoto.

## Critério de aprovação

Build HML, testes unitários e regras aprovados; erros encontrados corrigidos e retestados; fluxo crítico e exportações verificados em navegador quando disponível. Documentar verificações não executadas e limitações. Nenhuma aprovação de qualidade autoriza promoção para produção, que exige decisão explícita do dono do produto.

## Automação de navegador local

`tests/browser/app.test.mjs` usa Node `--test` + Playwright com Chrome instalado. Não inicia serviços nem baixa navegador. Pré-requisitos:

1. Auth/Firestore Emulator ativos com projeto `demo-quadrei` (9099/8080).
2. Angular servido com environment `emulator`, por exemplo `node scripts/angular-env.mjs serve emulator --host 127.0.0.1 --port 4200`.
3. `npm run test:ui`. URL opcional por `QUADREI_BASE_URL` (somente localhost/127.0.0.1); executável Chrome opcional por `QUADREI_CHROME_PATH`.

A suíte falha explicitamente se os serviços não estiverem disponíveis ou se o app não mostrar “Ambiente local de testes”. Cria uma conta fictícia pelo Auth Emulator e uma sociedade pelo próprio app. Valida formulário inválido, cadastro completo, busca sem acentos, edição, preservação de campos, cancelamento/Escape/restauração de foco, inativação/reativação e aniversariante de hoje. Em seguida semeia 45 membros fictícios pelo SDK autenticado, exercitando as regras locais e a atualização da lista.

Verifica downloads reais: planilha com 46 membros, células de texto sem fórmulas, acentos/datas e exclusão de observações; PDF com assinatura `%PDF-`, tamanho plausível e pelo menos duas páginas. Faz inspeção automatizada de overflow em 320/390/1440 px e capturas em `artifacts/browser/` (ignorado pelo Git). Finaliza com troca de sociedade, saída e recarga, confirmando ausência dos dados anteriores e de exceções não tratadas no navegador.

Limite: assinatura e contagem de páginas do PDF não comprovam, sozinhas, integridade visual de todas as linhas; abrir o artefato gerado complementa a verificação. Teste do login Google real e validação em aparelhos reais permanecem verificações distintas do acesso exclusivo de emulador usado nesta suíte.

## Resultado final — 15/11/2026

Execução concluída pelo orquestrador: 18 testes unitários/ambientes, 9 de regras e 1 jornada completa de navegador aprovados (28/28), além do build HML estrito. PDF real de 3 páginas e XLSX com 46 registros verificados; primeira página do PDF e capturas de interface inspecionadas visualmente. Testes de largura: 320, 390 e 1440 px. O PDF é rasterizado; assinatura e páginas foram verificadas automaticamente, sem afirmar acessibilidade semântica do documento exportado.

`npm run test:local` gerencia regras + servidor Angular emulator + browser sob emulators:exec. `QUADREI_CHROME_PATH` (ou `SOCIETAS_CHROME_PATH`) seleciona o executável do Chrome; o padrão é o Chrome instalado no macOS. Evidências em artifacts/browser/, ignoradas pelo Git. A execução deste ambiente usou CLI15.36/Firestore Emulator1.22 disponíveis; os detalhes e limites externos estão em STUDIO_STATUS.md. Login Google real e publicação não integram esta evidência local.

## Incremento ViaCEP

Validar consulta somente com oito dígitos; mapeamento da resposta; preservação de número/complemento e edições manuais pendentes; CEP inexistente, falha HTTP, timeout e JSON inesperado; cancelamento na troca de CEP/formulário/tela/sessão e ao salvar. Testes de navegador interceptam a API, sem depender de rede externa ou consumir consultas reais em lote. Verificar cadastro e edição.

### Evidência do incremento ViaCEP — 15/11/2026

Build HML aprovado. Testes unitários: 26/26 (18 existentes + 8 novos ViaCEP). Navegador: 2/2, com a jornada original e a nova jornada ViaCEP, usando Auth/Firestore locais e API interceptada. Cobertos formato incompleto/inválido sem requisição, auto preenchimento, deduplicação por CEP, preservação de número/complemento e edições pendentes, respostas concorrentes, CEP inexistente e repetição, timeout de 8 segundos, HTTP 503 com salvamento manual, edição de cadastro existente e descarte ao navegar para outro formulário. Sem exceções não tratadas nas páginas. Regras Firestore não mudaram e não foram reexecutadas neste incremento; 9 testes de regras aprovados na base anterior.

## Incremento Diretoria anual — plano antes do código

Testar validação de ano/cargo/identidade, relação com membro e ordenação da composição; isolamento de anos e preservação do histórico; criação e edição sem duplicar membro/ano; permitir inativos para histórico. Emulator: proprietário/terceiros/anônimo, referência a membro de outra sociedade/inexistente, ID adulterado, extras, tipos/limites, timestamps/criação imutáveis e exclusão de vínculo limitada ao proprietário. Browser: adicionar/editar/remover/cancelar, trocar ano e sociedade, atalho do cadastro, recarga, estados vazios e larguras320/390/1440. Nenhuma regra remota é publicada.

### Resultado do incremento Diretoria anual — 15/11/2026

Build HML aprovado. Unitários: 29/29; regras emulator: 14/14, incluindo 5 novos testes de diretoria; navegador: jornada do MVP, ViaCEP e diretoria aprovadas. Na jornada nova, o mesmo membro foi Presidente no ano atual e Tesoureiro no seguinte; edição, mudança de ano, recarga, membro inativo, remoção/cancelamento, cadastro preservado, atalho da edição e isolamento entre sociedades foram verificados. Layout sem overflow em320/390/1440px, quatro destinos mobile. Capturas de diretoria desktop/mobile em artifacts/browser/, inspecionadas visualmente.

A primeira execução de navegador detectou uma leitura do teste feita após a atualização otimista e antes da confirmação de remoção. O teste passou a aguardar a mensagem de sucesso (emitida após deleteDoc confirmar), e a jornada dedicada passou no reteste. O código da aplicação não precisou de correção para esse caso. Testes de regras executados em série para que a limpeza de dados de um arquivo não interfira no outro. Nenhum projeto real ou regra remota foi alterado.

## Revisão geral de responsividade — 16/11/2026

A matriz e as correções estão documentadas em [RESPONSIVIDADE.md](docs/RESPONSIVIDADE.md). A nova auditoria percorre as telas e os estados vazios em 15 resoluções, verifica conteúdo longo, detalhes, formulários, prévias, diálogos e navegação lateral/inferior, além de perfis de toque em celular e tablet. Evidências e resultados ficam em `artifacts/responsive/audit.json`; presença do teste não substitui a execução. A suíte completa de navegador continua responsável pelos fluxos de cadastro, edição, diretoria, atas, convocações, CEP e downloads.

Resultado: 43 unitários aprovados. Auditoria de 24 telas/estados em 15 resoluções e três perfis de toque aprovada, com zero problemas detectados e zero exceções de página. Na execução conjunta de navegador, seis jornadas passaram; ViaCEP parou em uma espera genérica por `networkidle`, incompatível com as conexões persistentes do Firestore. O teste passou a observar apenas consultas postais; a reexecução de ViaCEP e da auditoria passou (2/2). As sete jornadas ficaram verificadas. Regras e dados remotos não foram alterados.

Compilação HML concluída após a revisão, sem erros.

## Comunicação compartilhada — 16/11/2026

47 unitários, 33 testes de regras e oito jornadas de navegador aprovados. A jornada nova usa duas contas com e-mail confirmado pelo Auth Emulator e verifica convite, aceite, dados mínimos sem ano de nascimento/contato, bloqueio de navegação privada, acompanhamento, seis cartões PNG, identidade, inativação/reativação e revogação em tempo real. A interface de Comunicação foi conferida em 320/390/768/1024/1440 px; a auditoria geral passou nas 24 telas/estados × 15 resoluções. Detalhes e requisitos de publicação em [COMUNICACAO.md](docs/COMUNICACAO.md). Testes exclusivamente locais, sem e-mails reais.

## Presença pública em plenárias — 16/11/2026

50 testes unitários aprovados. Os 33 testes de regras existentes e os cinco novos cenários de presença foram verificados: abertura privada, metadados públicos mínimos, código e timestamps, revisão dos envios, encerramento/data/conclusão e preparação antecipada de link fechado.

As oito jornadas de navegador existentes passaram. A jornada nova passou após corrigir a preparação do cadastro inativo no teste, incluindo leitura efetiva do QR Code com decodificador independente, código incorreto, acesso sem conta, correspondência por nome, duplicidades, homônimos, inativos, revisão manual, persistência do comprovante, cópia do link, preservação da redação, admissão seguida de confirmação automática, encerramento e lavratura. Interface conferida em 320/390/768/1024/1440 px. Auditoria geral: 24 telas × 15 resoluções, sem problemas.

Os testes usam exclusivamente Auth/Firestore locais. Não houve publicação de regras nem gravação remota. Uso e arquitetura em [PRESENCA_PLENARIAS.md](docs/PRESENCA_PLENARIAS.md).

Verificação final de presença e atas: 5/5 regras e 2/2 jornadas aprovadas após o ajuste de sincronização na admissão. Compilação HML aprovada; carregamento inicial de 846,03 kB, dentro do limite de aviso de 850 kB, com telas de presença e QR Code carregadas sob demanda.

## Regressão do QR Code na compilação otimizada — 16/11/2026

Corrigido o carregamento da exportação padrão da biblioteca CommonJS `qrcode`. O servidor de desenvolvimento disponibilizava exportações nomeadas, mas o chunk otimizado exportava apenas `default`, causando falha na chamada `toDataURL`.

`npm run test:attendance:optimized` compila em modo production com configuração exclusiva dos emuladores, serve os arquivos estáticos em uma porta local e executa a jornada de presença. Teste aprovado: QR Code decodificado com `jsqr` e comparado ao link real, cópia do link, nomes/duplicidades/homônimos, admissão e presença automática, responsividade e encerramento com a ata. O teste não usa Vite e não grava em projetos remotos.

## Exclusão de atas com confirmação reforçada — 16/11/2026

51 testes unitários e 42 testes de regras aprovados. As regras novas verificam proprietário, frase exata, motivo limitado, timestamp, revisão, preservação de ata lavrada, reserva do número e encerramento atômico da presença. Edição, restauração, nova exclusão, remoção física, novos envios e reabertura de uma ata excluída são recusados.

Os fluxos de ata e presença passaram na rodada conjunta. A jornada nova de exclusão passou na reexecução após corrigir a simulação do teste para usar o estado em andamento ao editar uma plenária no dia da reunião. Verifica campos obrigatórios, frase incorreta, Enter sem confirmação válida, cancelamento, campos limpos ao reabrir, revisão concorrente, exclusão persistida após recarga, encerramento da página pública, ata lavrada preservada, editor fechado e número não reutilizável. Diálogo conferido em 320/390/768/1440 px, com capturas em `artifacts/minute-deletion`.

Testes exclusivamente em Auth/Firestore locais. Aplicação e regras remotas não foram publicadas.

Compilação final HML aprovada após os testes de exclusão.
