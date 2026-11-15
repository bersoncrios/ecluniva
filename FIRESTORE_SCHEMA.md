# Societas — contrato Cloud Firestore

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

`address` contém exatamente `postalCode` (vazio ou 8 dígitos), `street` (até 160), `number` (até 20; aceita s/n), `complement` (até 100), `neighborhood` (até 100), `city` (até 100) e `state` (vazio ou uma das 27 UFs). Campos parciais são permitidos. Nenhuma consulta de CEP.

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

firestore.rules nega anônimos, terceiros, documentos desconhecidos, chaves extras, ownerId imutável, tipos inválidos e exclusões. A subcoleção valida a propriedade lendo seu documento pai. Usuário que conhece o ID de uma sociedade não obtém acesso a ela. Não criar permissões públicas em fallback.

firebase.json é configuração local dos emuladores Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080 e UI 127.0.0.1:4000. Testar somente no projeto fictício demo-societas. Não há .firebaserc apontando para um projeto real e não há configuração de hosting ou functions. Para iniciar localmente: `firebase emulators:start --project demo-societas --only auth,firestore`. QA deve executar testes com `emulators:exec` e projeto demo-societas; nunca usar credenciais HML/PROD nos testes de regras.

As regras são entregues somente para local/emulator no MVP. Nenhuma implantação de regras ou gravação nos projetos reais faz parte desta entrega. Receber as configurações de Firebase não confirma que Google Sign-In, domínios autorizados ou regras remotas estejam configurados. Não considerar ambiente remoto pronto para dados reais antes de validar esses itens com o proprietário. Promoção para produção exige aprovação explícita.

## Fontes oficiais

- [Regras e consultas Firestore](https://firebase.google.com/docs/firestore/security/rules-query)
- [Condições e validação de dados](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Referência de linguagem das regras](https://firebase.google.com/docs/reference/rules)
- [Testes locais de regras](https://firebase.google.com/docs/rules/unit-tests)
