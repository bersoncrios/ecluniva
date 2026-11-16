# Atas e gestão de plenárias

O módulo pertence ao proprietário da sociedade autenticado. O histórico fica em `societies/{societyId}/minutes`; a numeração é reservada atomicamente por ano e não deve ser reutilizada. O número não é editável no formulário. Nenhuma alteração de cadastro ou vínculo anual deve reescrever uma ata já concluída.

## Ciclo de vida

- **Agendada:** reunião futura; é possível preparar os dados institucionais e a pauta, mas a chamada fica bloqueada.
- **Em andamento:** a data civil chegou. O contador de presentes usa os membros efetivamente marcados, sem inferir um quórum estatutário mínimo não informado.
- **Lavrada/concluída:** conteúdo e presença ficam congelados. A exportação usa o retrato histórico, sem consultar nomes ou cargos atuais.

A chamada só aceita alterações durante o dia civil agendado, desde 00h00 inclusive até 00h00 do dia seguinte exclusive, no fuso registrado na plenária. O horário do dispositivo habilita a interface; `request.time` do Firestore controla a autorização real. Uma ata não concluída cujo dia passou permanece pendente de lavratura, sem reabrir a chamada retroativamente.

A diretoria considera o ano civil da plenária. Apenas sócios ativos entram na chamada. Os cargos são os vínculos anuais, e não o campo de ofício eclesiástico. Presidente e secretário são sugeridos entre os presentes; o responsável pode escolher outros presentes para conduzir a sessão. Uma admissão durante a reunião cria o cadastro ativo e registra a recepção e presença na plenária.

## Documento

A redação é contínua: identificação, chamada (primeira ou segunda), presidência, presentes e seus cargos, devocional, admissões, deliberações, hino, encerramento, oração final e lavratura. A exportação usa A4, fonte serifada, logotipo fornecido pelo usuário, texto justificado com destaques, linhas de fechamento e paginação. Rascunhos devem ser identificados como tal.

**Fidelidade pendente:** a ATA 025 da UPH Palmas Norte e seu logotipo não estavam disponíveis no repositório durante a implementação. A redação e diagramação entregues são uma interpretação dos requisitos fornecidos. Não constituem comparação nem reprodução certificada do modelo físico. Quando o original for disponibilizado, conferir termos exatos, margens, tamanho do logotipo, espaçamento, quebras, rodapé e fechamento de todas as páginas lado a lado.

## Verificação

Os testes de domínio cobrem limites da data civil, fusos, retrato da diretoria e redação. Os testes no emulador verificam isolamento por proprietário, chamada antecipada, contador e imutabilidade. Testes de interface usam somente projeto `demo-*`, membros fictícios e emuladores locais. Build e testes não publicam regras nem dados em HML ou produção.

## Persistência e limites

`minutes/{ano}_{número}` armazena o conteúdo da reunião, `attendance` com `memberId`, `name` e `role`, seletores da mesa, `revision`, `dayStart`, `dayEnd`, `createdAt`, `updatedAt`, `concludedAt` e `finalText`. `minuteCounters/{ano}` guarda `year`, `value`, `minuteId` e `updatedAt`. A reserva do contador exige a criação da ata correspondente na mesma gravação atômica. Revisões obsoletas são recusadas. A data civil, o fuso e o número ficam fixos após o agendamento.

O módulo aceita até 500 presentes e logotipo PNG/JPEG de até 180 KB no formulário. Os fusos disponíveis são brasileiros, com deslocamentos UTC−2, UTC−3, UTC−4 e UTC−5; a configuração fica registrada em cada reunião. Os horários de abertura, devocional e encerramento devem ocorrer nessa ordem, no mesmo dia civil. Reuniões que atravessam meia-noite não são suportadas nesta versão.

As leituras transacionais do serviço recompõem nomes e cargos a partir dos cadastros atuais antes de salvar a chamada no dia. As regras garantem proprietário, janela temporal, sequência e congelamento, mas não conferem individualmente cada nome/cargo da lista contra o cadastro. Um proprietário usando diretamente o SDK pode fornecer um retrato diferente antes da lavratura. Validação independente desse conteúdo requer um backend confiável; esta implementação não possui função de servidor para isso.

## Resultado da validação local (15/11/2026)

- Build HML aprovado; compilação Angular da interface aprovada.
- 32 testes de domínio e 21 testes das regras Firestore aprovados.
- Jornada de navegador de atas aprovada: agendamento futuro bloqueado, chamada no dia, cargos anuais e mesa, admissão, persistência após recarga, congelamento após lavratura, alteração posterior de cadastro sem efeito no retrato e download de PDF com duas páginas.
- Capturas sem transbordamento em 320, 390 e 1440 pixels. Primeira página do PDF renderizada para inspeção de legibilidade, logotipo, margens, justificação, negritos e paginação. O logotipo Quadrei foi usado apenas como massa de teste; a sociedade deve fornecer seu logotipo oficial.
- Na suíte geral, o teste do rol de membros excedeu 60 segundos aguardando seu PDF (`tests/browser/app.test.mjs:205`). Esse resultado impede afirmar aprovação integral da suíte do aplicativo. O teste dedicado ao PDF de atas passou.
- Nenhuma regra ou aplicação foi publicada em projeto remoto.
