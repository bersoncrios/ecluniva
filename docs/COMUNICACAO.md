# Comunicação e aniversariantes

## Acesso do responsável

Abra **Aniversariantes → Comunicação e publicações**. A área reúne aniversariantes do mês e dos próximos 30 dias, busca por nome, filtros de publicação, mensagens para copiar e cartões PNG. A navegação principal mantém os seis destinos existentes.

Em **Equipe e convites**, informe o e-mail do responsável pelas publicações. O convite fica associado a esse endereço, normalizado para minúsculas. Use **Copiar link** ou **Abrir e-mail do convite**. A segunda opção abre o aplicativo de e-mail com destinatário, assunto, instruções e link preenchidos; o envio é concluído pelo usuário. Não há envio automático por SMTP nem publicação automática em redes sociais.

O destinatário entra com Google usando o endereço convidado, aceita o convite e abre a sociedade com o perfil **Comunicação**. O e-mail precisa estar confirmado pelo provedor. O responsável pode cancelar convites pendentes e revogar acessos aceitos. O mesmo endereço pode receber novo convite depois da revogação.

## Dados e permissões

O perfil Comunicação lê apenas uma lista separada com `name`, `month`, `day` e `active`, consultada com `active == true`. Ano de nascimento, telefone, endereço, e-mail do membro, observações, atas e diretoria não são disponibilizados a esse perfil. A restrição é aplicada nas regras Firestore, e não apenas na interface.

Ao abrir Comunicação pela primeira vez, o responsável prepara a lista dos cadastros já existentes, em pequenos lotes com progresso visível. Os cadastros novos, suas edições/inativações e admissões em atas mantêm a lista reduzida na mesma gravação. Após a ativação, as regras rejeitam alterações que deixem os dados compartilhados inconsistentes.

O acesso exige convite aceito pelo e-mail confirmado, vínculo ativo e configuração de compartilhamento ativa. Revogar o convite bloqueia novas leituras mesmo se o vínculo antigo ainda estiver no banco; a interface também remove a sociedade compartilhada e limpa a tela aberta. Dados já copiados ou baixados anteriormente continuam sob o controle de quem os recebeu.

## Trabalho de publicação

Cada ocorrência de aniversário tem estado **Pendente**, **Publicação preparada** ou **Parabéns publicados**. O acompanhamento é compartilhado com a equipe e persistido por membro e data de celebração, incluindo o ano da ocorrência, sem armazenar o ano de nascimento. Transações e revisões evitam sobrescrever estados com uma gravação obsoleta.

29 de fevereiro é lembrado em 28 de fevereiro nos anos não bissextos, conforme a regra já usada nos aniversariantes do app. As listas usam o dia civil de America/Araguaina. Mensagens podem usar `{nome}`, `{sociedade}` e `{data}`; outros textos permanecem literais. Se a cópia automática não estiver disponível no navegador, o texto fica selecionável para cópia manual.

## Cartões

Há dois modelos, **Clássico** e **Celebração**, e três formatos:

| Formato | Resolução PNG |
| --- | --- |
| Feed quadrado | 1080 × 1080 |
| Feed retrato | 1080 × 1350 |
| Story | 1080 × 1920 |

O responsável configura as cores, o logotipo opcional (PNG/JPEG até 180 KB) e a mensagem padrão na seção **Identidade dos cartões**. A equipe usa essa identidade e pode escolher o modelo/formato e editar a mensagem de cada cartão antes de baixar. O nome completo é quebrado em linhas; as imagens não precisam de fontes ou serviços externos. O contraste do texto se adapta à combinação de cores.

## Persistência e entrega

- `communicationInvites/{societyId}__{email}`: convite e seu aceite/revogação, com cópia do nome da sociedade para descoberta do acesso.
- `societies/{societyId}/communicationTeam/{userId}`: vínculo de Comunicação criado atomicamente com o aceite.
- `societies/{societyId}/communicationBirthdays/{memberId}`: projeção reduzida, sem ano de nascimento.
- `societies/{societyId}/communicationSettings/access`: ativação do compartilhamento.
- `societies/{societyId}/communicationSettings/identity`: identidade visual e mensagem padrão.
- `societies/{societyId}/birthdayPublications/{memberId}_{YYYY-MM-DD}`: acompanhamento anual de cada publicação.

As regras Firestore atualizadas fazem parte desta entrega e devem ser publicadas junto da aplicação, antes de disponibilizar o módulo em um ambiente remoto. Não há nova dependência de servidor de e-mail. Os testes usam apenas os emuladores locais, com confirmação de e-mails fictícios pelo Auth Emulator; não enviam mensagens reais.

## Fontes de implementação

A separação de dados segue o modelo de [acesso por documento do Firestore](https://firebase.google.com/docs/firestore/security/rules-fields). As gravações vinculadas usam [validação de transações com getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions), e o aceite verifica [e-mail confirmado no token de autenticação](https://firebase.google.com/docs/rules/rules-and-auth).

## Validação da entrega — 16/11/2026

- 47 testes unitários aprovados, incluindo privacidade da projeção, calendário sem ano de nascimento, virada do ano, 29/02, mensagens e formatos.
- 33 testes de regras aprovados, com isolamento entre sociedades, e-mail confirmado, aceite atômico, bloqueio dos cadastros completos, sincronização da projeção, revogação, identidade e publicações.
- Oito jornadas completas de navegador aprovadas: cadastro/exportações, diretoria, Comunicação, detalhes, atas, convocações, responsividade e ViaCEP.
- Duas contas distintas verificaram criação e aceite do convite, leitura mínima, tentativa de navegação para membros, mensagens, estados persistidos, inativação/reativação, seis PNGs reais e revogação com a página aberta.
- Comunicação conferida em 320, 390, 768, 1024 e 1440 px. A auditoria geral manteve 24 telas/estados em 15 resoluções sem problemas detectados.
- Imagens e capturas de referência em `artifacts/communication/`; nenhum e-mail real ou dado remoto foi usado nos testes.
