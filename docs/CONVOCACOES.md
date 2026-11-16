# Convocações

O módulo usa como referência os modelos de convocação plenária e de Comissão Executiva fornecidos para a UPH Palmas Norte. A estrutura inclui cabeçalho institucional, título, cidade e data de emissão, convocação, local e endereço, pauta opcional e assinaturas do presidente e do secretário. Não incorpora o logotipo específico da unidade dos modelos em documentos de outras sociedades.

## Uso

Abra **Convocações → Nova convocação**. Escolha Plenária, Comissão Executiva (CE) ou Diretoria. O destinatário muda conforme o tipo: todos os sócios, membros da CE ou membros da diretoria. A finalidade é editável, por exemplo “reunião de planejamento”.

Igreja e sociedade são preenchidas a partir da unidade selecionada. Presidente e secretário são sugeridos quando a diretoria do ano atual já está carregada; nomes e cargos permanecem editáveis. O horário aceita tanto `18:00` quanto “após a Escola Bíblica Dominical”. Informe o local com a preposição desejada, por exemplo “na residência do irmão João”, além do endereço completo.

A referência ao estatuto ou GTSI é opcional e preenchida pelo responsável, sem aplicar automaticamente a referência da UPH a outros tipos de sociedade. A pauta também é opcional, com um assunto por linha, até 50 itens e 10.000 caracteres. O documento numera os itens automaticamente.

A prévia usa os mesmos textos dos downloads. PDF e Word (.docx) têm formato A4, texto justificado, cabeçalho, título e duas assinaturas, sem numeração de páginas. O Word contém texto editável. Documentos extensos podem ocupar mais de uma página.

## Histórico e acesso

Salvar cria ou atualiza uma convocação no histórico da sociedade selecionada. Uma revisão impede que duas sessões sobrescrevam alterações silenciosamente. Os dados institucionais e os nomes dos responsáveis são copiados para o documento; uma alteração posterior na diretoria não reescreve convocações existentes. É possível reabrir, editar e baixar novamente. O download também pode ser feito antes do primeiro salvamento, após preencher os campos obrigatórios.

A subcoleção `societies/{societyId}/notices/{noticeId}` só pode ser lida e gravada pelo proprietário da sociedade. Datas de reunião podem estar no passado ou futuro, permitindo reproduzir os modelos fornecidos. A emissão não pode ser posterior à reunião. Não há exclusão de convocações nem integração automática com a chamada e a lavratura de atas.

## Verificações

Testes unitários verificam destinatários, datas civis, horários em texto, pauta, assinaturas, limites e conteúdo do DOCX. Os testes de regras verificam propriedade, datas, revisão, limites e campos permitidos. A jornada de navegador verifica criação, edição dos três tipos, persistência após recarga, PDF e DOCX reais, navegação em celular e isolamento entre sociedades. Testes usam somente Firebase local com projeto `demo-*`.
