# Ecluniva — escopo do MVP

Responsável: AGENTE PRODUCT OWNER · 15/11/2026  
Base: [RESEARCH.md](RESEARCH.md) e requisitos do dono do produto. As definições abaixo são decisões iniciais de produto, sem validação de campo. Continuidade da identidade visual autorizada pelo dono do produto em 15/11/2026.

## Problema e resultado

O responsável pela sociedade precisa manter um rol confiável, localizar membros, acompanhar aniversários e produzir arquivos para a rotina da igreja sem operar um sistema complexo. O MVP entrega esse ciclo completo para UPH, SAF, UMP, UCP e UPA.

## Acesso e sociedade

- Entrar com Google cria ou recupera a conta do responsável; sair encerra a sessão do app. Não existe senha própria.
- Cada sociedade tem um único proprietário (`ownerId`, UID do Firebase Auth), igreja informada por nome, tipo entre os cinco permitidos e nome da unidade local. Somente seu proprietário pode consultá-la ou alterar seus membros.
- O responsável pode criar e selecionar suas próprias sociedades. Igreja e sociedade selecionadas ficam visíveis; não há catálogo público, busca de sociedades de terceiros, convites, coadministradores ou transferência de propriedade no MVP.
- Primeiro acesso sem sociedades abre o cadastro da unidade. Campos igreja, tipo e nome da unidade são obrigatórios. Nomes iguais não garantem identidade nem dão acesso a uma unidade existente.
- O sistema não declara verificar vínculo institucional com a IPB. Não há edição cadastral da sociedade nesta versão; a seleção e criação cobrem o onboarding.

## Membros e validação

Cada registro pertence exclusivamente a uma sociedade e contém nome, nascimento, recebimento, ofício, endereço completo, telefone, e-mail, status e observações.

- Nome é obrigatório, após remover espaços nas extremidades, com 2–120 caracteres. Status inicial: ativo.
- Nascimento e recebimento são opcionais para permitir cadastro com informação incompleta. Quando presentes, devem ser datas civis reais, com ano completo, não futuras. Recebimento anterior ao nascimento informado é inválido.
- Datas civis são armazenadas como `YYYY-MM-DD`, sem horário; apresentação `DD/MM/AAAA`. Datas ausentes são `null`, nunca uma data fictícia.
- Ofício é texto opcional (até 100 caracteres), acompanhado de ajuda e sem classificação automática por sociedade. Telefone é opcional, aceita formatação brasileira, exige 10 ou 11 dígitos quando preenchido. E-mail opcional com formato válido (até 254 caracteres).
- Endereço opcional estruturado: CEP, logradouro, número, complemento, bairro, cidade e UF. Campos parciais são aceitos; número admite “s/n”. CEP preenchido exige 8 dígitos; UF preenchida usa uma das 27 siglas. Por solicitação do dono em 15/11/2026, consultar ViaCEP automaticamente ao completar oito dígitos, preenchendo logradouro, bairro, cidade e UF. Número e complemento permanecem manuais. Consulta também disponível ao alterar CEP na edição; abrir cadastro existente não dispara consulta. Campos continuam editáveis. CEP inexistente ou indisponibilidade permitem preenchimento manual e nova tentativa; mudanças de CEP, registro, sessão ou tela invalidam respostas antigas. Edições manuais feitas enquanto a consulta está pendente são preservadas. A consulta não grava dados no Firestore.
- Limites: CEP 8 dígitos; logradouro 160, número 20, complemento 100, bairro 100, cidade 100, observações 2.000 caracteres. Campos opcionais vazios são normalizados de forma consistente pelo schema.
- Nomes repetidos são permitidos; bloquear duplo envio do mesmo formulário evita duplicação acidental. Nunca sobrescrever outro registro pelo nome.
- Editar preserva a identidade do registro. Inativar exige confirmação e mantém os dados; reativar é permitido. Inativo significa fora do rol ativo desta sociedade, sem declarar desligamento da igreja. Não há exclusão definitiva.
- Falha ao salvar preserva o formulário; sucesso só aparece após confirmação do Firestore. Sem edição offline deliberada: operações pendentes não são anunciadas como concluídas.

## Lista, busca e resumo

- Lista inicial mostra ativos, ordenados por nome em português; opções de status: Ativos, Inativos, Todos.
- Busca por trecho do nome ignora acentos e caixa e combina com status. Filtros não alteram os dados.
- Resumo usa todos os registros da sociedade, independentemente dos filtros: total = ativos + inativos; próximo aniversário considera somente ativos com nascimento conhecido.
- Nenhum dado de outra sociedade pode aparecer durante troca, carregamento, erro ou saída. Não se exibe zero como se fosse resultado de uma consulta ainda pendente ou que falhou.

## Aniversariantes

- Dois recortes: mês civil atual completo (inclui datas já passadas) e próximos 30 dias, de hoje até hoje + 29 dias, inclusive. São visões independentes e podem conter a mesma pessoa.
- Somente ativos com nascimento conhecido participam. Mostrar nome e dia/mês, sem exigir ou divulgar idade na lista.
- Usar dias civis em `America/Araguaina`, evitando deslocamentos por UTC ou soma de milissegundos. Recalcular ao entrar na tela e ao mudar o dia com app aberto.
- Aniversário de 29/02 ocorre em 28/02 nos anos não bissextos. No mês atual permanece no recorte de fevereiro; apresentar indicação da adaptação quando aplicável.
- “Próximo aniversariante” inclui hoje, procura a próxima ocorrência inclusive no ano seguinte e desempata por nome; os demais aniversariantes da mesma data continuam no painel. Sem candidatos, mostrar estado vazio.

## Exportação

- Formatos PDF (jsPDF + html2canvas) e planilha `.xlsx` (xlsx), gerados no navegador.
- Exportar o resultado completo da busca e do filtro de status atuais, não apenas os itens visíveis na tela. Antes de gerar, mostrar sociedade, quantidade, filtros e campos incluídos; permitir cancelar.
- PDF: igreja, sociedade, data de geração, filtros, quantidade e colunas nome, nascimento, recebimento, ofício, telefone, e-mail e status. Quebrar páginas sem cortar linhas e repetir identificação/cabeçalho.
- XLSX: os mesmos dados e endereço separado por campos. Observações ficam fora de ambos os formatos no MVP. Nascimento e recebimento usam `DD/MM/AAAA`; ausentes ficam em branco.
- Manter ordenação por nome. Textos da planilha são células de texto, inclusive valores iniciados por `=`, `+`, `-` ou `@`; nunca fórmulas geradas a partir do cadastro.
- Lista vazia desabilita exportação com explicação. Falhas não produzem confirmação de sucesso. Nome do arquivo usa tipo da sociedade e data, sem nome de membro.

## Limites e entrega

MVP pensado para sociedades de até 1.000 membros, carregadas por sociedade para busca, resumo e exportação no frontend. Esse é limite de suporte, não afirmação de desempenho comprovado; validar com massa de teste. Não há relatórios analíticos, importação, cobrança, contribuição financeira, agenda, mensagens, fotos, portal do membro ou cadastro de menores por responsável legal específico.

Stack obrigatória: Angular 17+ standalone, Signals, AngularFire, Tailwind, TypeScript estrito (`strict`, `noImplicitReturns`, `noImplicitOverride`), Firebase Auth Google e Firestore, sem Cloud Functions. Node `--test` para testes unitários e integração; regras verificadas localmente/emulator, sem publicação de regras no MVP.

HML e PROD usam configurações locais separadas, ignoradas pelo Git, com `.env.example` versionado. `scripts/angular-env.mjs` gera os environments; `scripts/vercel-build.mjs` mapeia develop/hml → HML e main/master → PROD; branch desconhecida falha sem selecionar produção. Configuração de produção não equivale a autorização de implantação. A promoção exige aprovação explícita; não implantar em branch de produção antes dela. Sem regras remotas aprovadas e implantadas pelo responsável, não declarar o MVP apto a receber dados reais em ambiente remoto.

## Critério de conclusão

Fluxos do backlog P0 implementados, erros e estados vazios definidos, identidade visual validada, build HML aprovado, testes unitários e emulator passando e exportações verificadas com acentos, datas, múltiplas páginas e textos semelhantes a fórmulas. Documentar qualquer verificação inviável. Produção permanece fora da conclusão do MVP local/HML até aprovação explícita.

## Incremento autorizado — Diretoria por ano

Página Diretoria com ano selecionável (1900–2100), padrão ano civil atual em America/Araguaina. Cada vínculo reúne membro cadastrado da sociedade, ano e cargo de 2–100 caracteres. Um membro possui no máximo um cargo por ano; o mesmo membro pode ter cargos diferentes em outros anos. Cargos são livres, com sugestões: Presidente, Vice-presidente, 1º Secretário, 2º Secretário e Tesoureiro. Mais de uma pessoa pode ter o mesmo cargo, pois não se presume exclusividade estatutária.

O responsável adiciona, altera cargo e remove a participação de um ano com confirmação; remover vínculo não exclui o membro nem seus outros anos. Não há exclusão/alteração automática de diretorias na virada do ano. Ativos e inativos podem ser vinculados para recomposição de histórico; inativos são indicados com texto. Nomes são consultados do cadastro atual, sem cópia histórica de nome/contato. Não é um histórico de substituições dentro do mesmo ano, eleições, votação ou controle de acesso administrativo. Ser da diretoria não dá acesso ao sistema.

A página lista cargo e nome, com consulta por ano. O cadastro de membro já salvo oferece acesso à diretoria com aquele membro pré-selecionado. Para membro novo, salvar o cadastro precede o vínculo; são ações independentes e explicitamente confirmadas. Ofício na igreja e cargo anual são conceitos separados. Exportações do rol permanecem com seus campos atuais; exportação específica da diretoria não foi solicitada. Consultas/erros/mudanças de ano, conta e sociedade não podem deixar dados da seleção anterior visíveis.
