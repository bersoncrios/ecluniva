# Revisão de responsividade

A revisão cobre entrada, seleção/criação de sociedade, visão geral, membros, detalhes, cadastro, aniversariantes, diretoria, atas, convocações e seus diálogos. Usa dados extensos, incluindo nomes sem espaços, cargos compridos e observações, além de sociedades sem cadastros.

## Correções

- A lista de presença quebra nomes extensos e respeita a largura do formulário; um nome sem espaços podia levar o editor de atas a mais de 1.000 px em uma tela de 320 px.
- O menu lateral tem rolagem própria e mantém todas as ações acessíveis em notebooks com pouca altura.
- Editores de atas e convocações ficam em uma coluna até 1279 px. Em telas maiores, a prévia fica ao lado, pode ser rolada e recebe foco para leitura pelo teclado.
- Campos em telas compactas ou dispositivos de toque usam fonte de 16 px para evitar zoom automático ao focar. O menu da conta tem área mínima de 44 px.
- Há espaço de rolagem para o menu inferior e a área segura do dispositivo, inclusive ao focar campos com a altura disponível reduzida.
- Ações da tabela de membros ficam dentro da célula. Grids, rodapés e diálogos suportam textos extensos sem ampliar a página.

## Matriz de tamanhos

| Perfil | Resoluções CSS |
| --- | --- |
| Celulares em pé | 320×740, 360×800, 390×844, 430×932 |
| Telas intermediárias | 600×960, 767×900 |
| Tablets em pé | 768×1024, 820×1180 |
| Celular deitado | 844×390 |
| Tablets/notebooks | 1023×768, 1024×768, 1101×768, 1280×720 |
| Computadores | 1440×900, 1920×1080 |

Há também perfis de toque em 390×844, 820×1180 e 1366×1024, com navegação pelos módulos, busca, consulta e edição. O foco no formulário é verificado com altura reduzida a 360 px, simulando a área restante ao abrir um teclado. O menu lateral é testado em 1280 px com alturas de 568, 600 e 720 px.

## Executar e inspecionar

O teste `tests/browser/responsive.test.mjs` depende do Angular com ambiente `emulator` e dos emuladores Auth/Firestore locais. Pode ser executado com `node --test tests/browser/responsive.test.mjs`, ou junto da suíte por `npm run test:local`.

As evidências ficam em `artifacts/responsive/`: capturas por tela/largura e `audit.json` com as telas, resoluções, problemas e exceções de página. O teste falha quando encontra rolagem horizontal de página, elementos fora da largura, ações cortadas, diálogos fora da altura disponível, campos pequenos em telas compactas ou ações inacessíveis no menu lateral.

A automação usa Chromium instalado e emulação de toque. Não substitui uma verificação em aparelhos físicos ou em Safari/iOS; a simulação de altura reduzida não abre um teclado virtual real.

## Resultado — 16/11/2026

- Auditoria aprovada em 24 telas/estados × 15 resoluções, sem rolagem horizontal indevida, ações cortadas ou exceções de página. Perfis de toque e altura reduzida também aprovados.
- Compilação HML concluída e 43 testes unitários aprovados.
- Sete jornadas de navegador verificadas: fluxo principal/exportações, diretoria, detalhes de membros, atas/PDF/DOCX, convocações, responsividade e ViaCEP. Na primeira execução conjunta, ViaCEP aguardou `networkidle` apesar da conexão permanente do Firestore. A espera foi substituída pela observação específica de consultas postais; ViaCEP e a auditoria passaram na reexecução dedicada (2/2).
- As regras de acesso não foram alteradas nesta revisão. Os testes usam somente os emuladores locais.
