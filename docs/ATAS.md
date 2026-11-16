# Atas e gestão de plenárias

O módulo pertence ao proprietário da sociedade autenticado. O histórico fica em `societies/{societyId}/minutes`; o usuário define o número ao agendar, com sugestão do próximo número livre do ano. A reserva é atômica por ano e impede atas ativas duplicadas. O cabeçalho exibe apenas o número, sem sufixo de ano. Nenhuma alteração de cadastro ou vínculo anual deve reescrever uma ata já concluída.

## Ciclo de vida

- **Agendada:** reunião futura; é possível preparar os dados institucionais e a pauta, mas a chamada fica bloqueada.
- **Em andamento:** a data civil chegou. O contador de presentes usa os membros efetivamente marcados, sem inferir um quórum estatutário mínimo não informado.
- **Lavrada/concluída:** conteúdo e presença ficam congelados. A exportação usa o retrato histórico, sem consultar nomes ou cargos atuais.

A chamada só aceita alterações durante o dia civil agendado, desde 00h00 inclusive até 00h00 do dia seguinte exclusive, no fuso registrado na plenária. O horário do dispositivo habilita a interface; `request.time` do Firestore controla a autorização real. Uma ata não concluída cujo dia passou permanece pendente de lavratura, sem reabrir a chamada retroativamente.

A diretoria considera o ano civil da plenária. Apenas sócios ativos entram na chamada. O ofício na igreja é preservado no retrato da presença e acompanha o nome na redação, nas orações e na presidência. Os cargos são os vínculos anuais, e não o campo de ofício eclesiástico. Presidente e secretário são sugeridos entre os presentes; o responsável pode escolher outros presentes para conduzir a sessão. Uma admissão durante a reunião cria o cadastro ativo e registra a recepção e presença na plenária.

## Exclusão com confirmação reforçada

O responsável pela sociedade pode selecionar **Excluir ata** no histórico ou **Excluir esta ata** no editor, inclusive para documentos já lavrados. A confirmação mostra número, data, sociedade e situação; exige motivo de 10 a 500 caracteres e a digitação exata de `EXCLUIR ATA 001`, substituindo pelo número exibido. Sem os dois campos válidos, o botão fica desabilitado. **Manter ata** ou Escape cancela e limpa os campos.

A exclusão remove a ata da listagem e fecha o editor. Trata-se de exclusão lógica: o documento permanece privado com conteúdo histórico, `deletedAt`, `deletedBy`, `deletionReason` e `deletionConfirmation`. O número fica disponível novamente no mesmo ano e pode ser sugerido para uma nova ata. A nova ata recebe um identificador interno próprio, preservando a ata excluída e seus registros. Não há restauração pela interface; o corpo de atas lavradas não é reescrito e arquivos já baixados não são recolhidos.

O servidor exige proprietário, confirmação correta, motivo, timestamp de servidor e incremento da revisão. O serviço verifica se a versão exibida ainda é atual, recusando a exclusão após alteração em outra sessão. O link de presença é encerrado na mesma transação; atas excluídas não recebem novas confirmações, não reabrem a chamada e não aceitam edição, nova exclusão ou remoção física pelo cliente. As regras atualizadas devem acompanhar a publicação da aplicação.

## Documento

O hino é opcional: informe somente seu número para incluir o trecho na ata. Sem número, o trecho é omitido.

O local da reunião é informado separadamente do endereço completo e pode identificar o templo, a casa de um irmão ou outro espaço.

A redação é contínua: identificação, chamada (primeira ou segunda), presidência, presentes e seus cargos, devocional, admissões, deliberações, hino, encerramento, oração final e lavratura. A exportação usa A4, fonte serifada, texto justificado com destaques, linhas de fechamento, sem numeração de páginas. Também é possível baixar a ata em Word (.docx), com texto editável, destaques e identificação de rascunho. Rascunhos devem ser identificados como tal.

**Fidelidade pendente:** a ATA 025 da UPH Palmas Norte e seu logotipo não estavam disponíveis no repositório durante a implementação. A redação e diagramação entregues são uma interpretação dos requisitos fornecidos. Não constituem comparação nem reprodução certificada do modelo físico. Quando o original for disponibilizado, conferir termos exatos, margens, tamanho do logotipo, espaçamento, quebras, rodapé e fechamento de todas as páginas lado a lado.

## Verificação

Os testes de domínio cobrem limites da data civil, fusos, retrato da diretoria e redação. Os testes no emulador verificam isolamento por proprietário, chamada antecipada, contador e imutabilidade. Testes de interface usam somente projeto `demo-*`, membros fictícios e emuladores locais. Build e testes não publicam regras nem dados em HML ou produção.

## Persistência e limites

`minutes/{id}` armazena o conteúdo da reunião, `attendance` com `memberId`, `name`, `office` e `role`, seletores da mesa, `revision`, `dayStart`, `dayEnd`, `createdAt`, `updatedAt`, `concludedAt` e `finalText`. `minuteNumbers/{ano}_{número}` reserva atomicamente cada número em uso e aponta para o ID da ata. Se o número for reutilizado, a ata antiga excluída permanece preservada com seu conteúdo e trilha de auditoria, e a nova recebe outro ID. Revisões obsoletas são recusadas. A data civil, o fuso e o número ficam fixos após o agendamento.

O módulo aceita até 500 presentes. O formulário não solicita logotipo; atas antigas que já possuem imagem mantêm seu registro. Os fusos disponíveis são brasileiros, com deslocamentos UTC−2, UTC−3, UTC−4 e UTC−5; a configuração fica registrada em cada reunião. Os horários de abertura, devocional e encerramento devem ocorrer nessa ordem, no mesmo dia civil. Reuniões que atravessam meia-noite não são suportadas nesta versão.

As leituras transacionais do serviço recompõem nomes e cargos a partir dos cadastros atuais antes de salvar a chamada no dia. As regras garantem proprietário, janela temporal, reserva do número e congelamento, mas não conferem individualmente cada nome/cargo da lista contra o cadastro. Um proprietário usando diretamente o SDK pode fornecer um retrato diferente antes da lavratura. Validação independente desse conteúdo requer um backend confiável; esta implementação não possui função de servidor para isso.

## Resultado da validação local (15/11/2026)

- Build HML aprovado; compilação Angular da interface aprovada.
- 32 testes de domínio e 21 testes das regras Firestore aprovados.
- Jornada de navegador de atas aprovada: agendamento futuro bloqueado, chamada no dia, cargos anuais e mesa, admissão, persistência após recarga, congelamento após lavratura, alteração posterior de cadastro sem efeito no retrato e download de PDF com duas páginas.
- Capturas sem transbordamento em 320, 390 e 1440 pixels. Primeira página do PDF renderizada para inspeção de legibilidade, logotipo, margens, justificação, negritos e paginação. O logotipo Ecluniva foi usado apenas como massa de teste na validação original.
- Na suíte geral, o teste do rol de membros excedeu 60 segundos aguardando seu PDF (`tests/browser/app.test.mjs:205`). Esse resultado impede afirmar aprovação integral da suíte do aplicativo. O teste dedicado ao PDF de atas passou.
- Nenhuma regra ou aplicação foi publicada em projeto remoto.
