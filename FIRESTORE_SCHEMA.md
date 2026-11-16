# Ecluniva — contrato Cloud Firestore

Responsável: AGENTE BACKEND ENGINEER · 15/11/2026  
Base: MVP_SCOPE.md, BACKLOG.md e BRAND.md. Identidade visual liberada para continuidade. Este contrato precede as regras e o código de persistência.

## Autenticação e acesso

Firebase Authentication com Google Sign-In (`GoogleAuthProvider`). O Firebase UID é a autoridade de acesso; nome e e-mail Google são apenas apresentação da conta. Não criar senhas próprias ou documentos públicos de perfis. O responsável pode possuir várias sociedades. Cada sociedade tem exatamente um proprietário, sem compartilhamento ou transferência no MVP.

O frontend usa AngularFire modular para Auth e Firestore. Sessão inicial deve aguardar a primeira resposta de autenticação. Ao sair, trocar conta ou sociedade, cancelar assinaturas e limpar imediatamente dados anteriores; respostas assíncronas antigas não podem recolocar dados no estado atual. Guardas de rota melhoram navegação, mas a autorização depende das regras.

## `societies/{societyId}`

ID automático Firestore; `id` existe somente no modelo de leitura do cliente, nunca no documento.

| Campo | Tipo | Validação |
| --- | --- | --- |
| ownerId | string | UID autenticado na criação; imutável |
| churchName | string | Igreja, 2–160 caracteres, sem espaços nas extremidades |
| type | string | UPH, SAF, UMP, UCP ou UPA |
| name | string | Nome da unidade local, 2–120 caracteres, sem espaços nas extremidades |
| createdAt | Timestamp | `serverTimestamp()`, igual a request.time ao criar; imutável |
| updatedAt | Timestamp | `serverTimestamp()`, igual a request.time em qualquer gravação |

Todas as chaves acima são obrigatórias; chaves extras são negadas. O frontend não oferece edição da sociedade no MVP. As regras admitem atualização válida dos dados descritivos pelo proprietário, preservando proprietário e criação, sem habilitar transferência. Exclusão é negada.

## `societies/{societyId}/members/{memberId}`

ID automático e estável. Não usar nome como chave; nomes iguais são aceitos. `id` e societyId são contexto do cliente, não campos persistidos.

| Campo | Tipo | Validação |
| --- | --- | --- |
| name | string | 2–120 caracteres, sem espaços nas extremidades |
| birthDate | string ou null | Data civil real `YYYY-MM-DD`, ano 0001–9999, não futura |
| receivedDate | string ou null | Data civil real `YYYY-MM-DD`, não futura; não anterior a birthDate quando ambas existem |
| office | string | Até 100 caracteres |
| address | map | Sete campos obrigatórios descritos abaixo |
| phone | string | Vazio ou 10/11 dígitos; remover formatação antes de gravar |
| email | string | Vazio ou formato básico válido; máximo 254 caracteres |
| status | string | `active` ou `inactive`; frontend cria como active |
| notes | string | Até 2.000 caracteres; fora das exportações |
| createdAt | Timestamp | serverTimestamp na criação e imutável na edição |
| updatedAt | Timestamp | serverTimestamp em toda gravação |

`address` contém exatamente `postalCode` (vazio ou 8 dígitos), `street` (até 160), `number` (até 20; aceita s/n), `complement` (até 100), `neighborhood` (até 100), `city` (até 100) e `state` (vazio ou uma das 27 UFs). Campos parciais são permitidos. ViaCEP auxilia o preenchimento no frontend; não altera o schema nem a autorização. Apenas CEP é enviado ao serviço externo; nome, contato e outros dados do membro não são enviados.

Todas as chaves do membro são obrigatórias, inclusive os campos opcionais ao usuário. Normalização: textos opcionais ausentes viram `''`; datas ausentes viram `null`; endereço ausente vira mapa com sete strings vazias. Retirar espaços nas extremidades de textos no frontend, sem remover acentos nem converter nomes para maiúsculas. Nome não pode ter espaços nas extremidades também nas regras. Telefone e CEP são persistidos somente como dígitos. Não gravar undefined, strings de datas vazias ou campos id.

Inativar/reativar altera apenas status e updatedAt via updateDoc. Não excluir membros. As regras validam o documento completo também em updates parciais. Nas regras, criação de membro exige status active; edição permite os dois estados, inclusive reativação.

## Datas e timestamps

Datas de nascimento/recebimento não são timestamps: salvar `YYYY-MM-DD` preserva o dia civil. Apresentar DD/MM/AAAA. Regras conferem calendário (meses com 30/31 dias, fevereiro e ano bissexto) e futuro usando request.time deslocado para UTC−03, correspondente à regra de negócio atual de America/Araguaina. O frontend usa explicitamente America/Araguaina. Mudança futura de fuso exige revisão conjunta.

Carimbos de auditoria são timestamps de servidor. O cliente envia serverTimestamp(), não Date local. createdAt nunca pode ser alterado. Não usar carimbos de auditoria no cálculo de aniversários.

## Queries e gravações

```ts
// listagem de sociedades: a restrição ownerId precisa estar na query
query(collection(firestore, 'societies'), where('ownerId', '==', user.uid));
// membros: caminho da sociedade selecionada e autorizada
collection(firestore, `societies/${societyId}/members`);
// criação e edição: somente campos do contrato, com carimbos de servidor
addDoc(collection(firestore, `societies/${societyId}/members`), {
  ...normalizedMember, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
});
updateDoc(doc(firestore, `societies/${societyId}/members/${memberId}`), {
  ...normalizedMember, updatedAt: serverTimestamp()
});
```

Não consultar todas as sociedades para filtrar depois: regras não são filtros. Evitar orderBy em sociedades; ordenar no cliente. Nenhum índice composto é necessário no MVP, então firestore.indexes.json começa vazio. A coleção de membros é carregada por sociedade; busca normalizada, filtros, contagens, aniversários e ordenação pt-BR acontecem no frontend, com limite de suporte de 1.000 registros, sem truncamento silencioso. Esse limite é de suporte e não é quota imposta pelas regras.

## Regras e ambientes

firestore.rules nega anônimos, terceiros, documentos desconhecidos, chaves extras, ownerId imutável, tipos inválidos e exclusões de sociedades/membros. A remoção de vínculos anuais da diretoria tem permissão específica limitada ao proprietário. A subcoleção valida a propriedade lendo seu documento pai. Usuário que conhece o ID de uma sociedade não obtém acesso a ela. Não criar permissões públicas em fallback.

firebase.json é configuração local dos emuladores Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080 e UI 127.0.0.1:4000. Testar somente no projeto fictício demo-quadrei. Não há .firebaserc apontando para um projeto real e não há configuração de hosting ou functions. Para iniciar localmente: `firebase emulators:start --project demo-quadrei --only auth,firestore`. QA deve executar testes com `emulators:exec` e projeto demo-quadrei; nunca usar credenciais HML/PROD nos testes de regras.

As regras são entregues somente para local/emulator no MVP. Nenhuma implantação de regras ou gravação nos projetos reais faz parte desta entrega. Receber as configurações de Firebase não confirma que Google Sign-In, domínios autorizados ou regras remotas estejam configurados. Não considerar ambiente remoto pronto para dados reais antes de validar esses itens com o proprietário. Promoção para produção exige aprovação explícita.

## Fontes oficiais

- [Regras e consultas Firestore](https://firebase.google.com/docs/firestore/security/rules-query)
- [Condições e validação de dados](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Referência de linguagem das regras](https://firebase.google.com/docs/reference/rules)
- [Testes locais de regras](https://firebase.google.com/docs/rules/unit-tests)

## Incremento — `societies/{societyId}/boardAssignments/{year}_{memberId}`

Contrato documentado antes do código. Um vínculo por membro/ano, com ID determinístico `String(year) + '_' + memberId`. O documento tem exatamente `year` (inteiro 1900–2100), `memberId` (string não vazia de até128 caracteres, sem `/`, referenciando membro existente da mesma sociedade), `role` (texto com2–100 caracteres, sem espaços nas extremidades), `createdAt` e `updatedAt` (Timestamp servidor). `id` só existe no cliente. Na edição, year/memberId/createdAt são imutáveis. Uma transação lê o documento e cria ou atualiza preservando createdAt, evitando duplicação em gravações concorrentes.

Acesso exclusivo ao proprietário da sociedade, sem relação entre cargo na diretoria e autorização administrativa. Ativos e inativos podem ser vinculados para recomposição histórica; inativar não remove vínculo. Cargos são livres e podem se repetir; ofício na igreja permanece no cadastro do membro. Consulta: `query(collection(firestore, 'societies', societyId, 'boardAssignments'), where('year', '==', year))`; ordenação de cargos e nomes no cliente, sem índice composto.

Permite excluir somente o vínculo anual pelo proprietário; não exclui cadastro nem vínculos de outros anos. Não há cascata, migração de membros existentes, cargos automáticos na virada do ano ou gravações remotas nesta entrega. Troca de ano/sociedade/conta cancela a assinatura e limpa os resultados anteriores. O frontend usa `boardYear`, `boardAssignments`, `boardLoading`, `boardError`, `loadBoard(year)`, `saveBoardAssignment(year, memberId, role)` e `removeBoardAssignment(entry)` do DataService.

## Convocações — `societies/{societyId}/notices/{noticeId}`

Cada documento contém `meetingType` (`plenary`, `executive`, `board`), `churchName`, `societyName`, `issueCity`, `issueDate`, `meetingDate`, `timeDescription`, `meetingPurpose`, `meetingLocation`, `address`, `legalBasis`, `agenda`, `presidentName`, `secretaryName`, `presidentRole`, `secretaryRole`, `revision`, `createdAt` e `updatedAt`.

Datas são strings civis `YYYY-MM-DD` (1900–2100), com emissão até a data da reunião. Pauta opcional: até 50 linhas e 10.000 caracteres. Referência opcional: até 1.000 caracteres. Igreja, finalidade, local, endereço, responsáveis e cargos são obrigatórios. Campos desconhecidos são recusados. `createdAt` é imutável, `updatedAt` usa o timestamp de servidor e cada atualização incrementa `revision`. Leitura e gravação exigem o proprietário da sociedade; exclusões são negadas. A consulta usa a coleção da sociedade selecionada, com busca e ordenação locais, sem índice composto.

## Comunicação

O contrato completo está em [COMUNICACAO.md](docs/COMUNICACAO.md). Convites ficam na coleção raiz `communicationInvites`, consultados por sociedade pelo proprietário e por e-mail confirmado pelo convidado. A chave `${societyId}__${email}` evita duplicar convites ativos do mesmo endereço. O aceite atualiza o convite e cria o vínculo de Comunicação na mesma transação; as regras conferem ambos com `getAfter`.

A projeção `communicationBirthdays` contém somente nome, mês, dia e um indicador de participação. Não contém dados de contato, observações, ofício nem ano de nascimento. Nas sociedades com compartilhamento ativo, as regras exigem consistência dessa projeção ao gravar membros. Projeções já existentes também são protegidas antes da ativação. O perfil de Comunicação consulta somente documentos ativos e não recebe leitura de `members`, `boardAssignments`, `minutes` ou `notices`.

Identidade visual fica em `communicationSettings/identity`, com cores hexadecimais, imagem PNG/JPEG em data URL até 250.000 caracteres e mensagem até 1.000 caracteres; só o responsável pode alterar. Os estados em `birthdayPublications` validam a ocorrência contra o mês/dia compartilhado, têm revisão e autor/carimbo de servidor. Revogação é verificada no convite e no vínculo em cada acesso. Índices simples atendem às consultas por e-mail, sociedade, ativo e faixa de datas.

## Presença pública das plenárias

`societies/{societyId}/attendanceSessions/{minuteId}` guarda `token` e `code`, restritos ao proprietário. `plenaryAttendance/{token}` guarda somente `societyId`, `minuteId`, `title`, `date`, `timeZone` e `open`. Em `requests/{receipt}`, cada envio tem `name`, `code`, `status`, `memberId`, `createdAt` e `processedAt`. Tokens e comprovantes são capacidades aleatórias de 192 bits. Consulta pública somente por documento conhecido; listagem dos envios e conferência somente pelo proprietário. Criação exige código correto, horário de servidor dentro do dia civil e ata não concluída. Conferência atualiza a chamada em transação com revisão e preserva ofício/cargo. A conclusão encerra o link atomicamente. Detalhes em [Presença nas plenárias](docs/PRESENCA_PLENARIAS.md).

## Exclusão lógica de atas

`minutes/{ano}_{número}` admite uma atualização exclusiva de exclusão pelo proprietário: `deletedAt` e `updatedAt` com horário do servidor, `deletedBy` com UID do proprietário, `deletionReason` com 10–500 caracteres, `deletionConfirmation` igual a `EXCLUIR ATA NNN` e `revision` anterior + 1. Nenhum outro campo pode mudar nessa operação, inclusive em atas concluídas. Se existe uma sessão de presença, `getAfter` exige o link fechado na mesma transação. O documento excluído permanece privado e imutável, é filtrado da listagem e mantém a reserva do número. A interface sugere o próximo número considerando também as atas excluídas. Remoção física, restauração e reabertura da presença são negadas.
