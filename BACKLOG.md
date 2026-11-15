# Societas — backlog priorizado

Responsável: AGENTE PRODUCT OWNER · 15/11/2026  
Regras detalhadas em [MVP_SCOPE.md](MVP_SCOPE.md). P0 compõe o MVP; P1 e P2 ficam fora dele. Ordem considera dependências.

| Ordem | Prioridade | História | Critérios de aceite |
| --- | --- | --- | --- |
| 1 | P0 | Como responsável, quero entrar com Google para acessar meus dados. | Entrada bem-sucedida leva à seleção ou criação de sociedade; cancelamento e falha permitem tentar novamente; recarga restaura sessão válida; sair remove dados apresentados e protege rotas. |
| 2 | P0 | Como responsável, quero cadastrar e selecionar minha sociedade para trabalhar na unidade certa. | Exige igreja, tipo permitido e nome local; associa proprietário autenticado; lista somente suas sociedades; primeira entrada orienta criação; seleção mostra igreja/tipo/nome e limpa dados da seleção anterior. |
| 3 | P0 | Como responsável, quero cadastrar membros com dados disponíveis para iniciar meu rol. | Aplica obrigatoriedade, limites e formatos do escopo; aceita campos opcionais ausentes; mostra erros junto aos campos; preserva valores em falha; impede duplo envio; confirma apenas gravação concluída; novo registro surge ativo e ordenado. |
| 4 | P0 | Como responsável, quero consultar e editar um membro para corrigir o cadastro. | Abre dados atuais da sociedade selecionada; salva no mesmo ID; valida também na edição; cancelar não grava; falha preserva alterações; lista e resumo refletem sucesso. |
| 5 | P0 | Como responsável, quero inativar e reativar membros para manter o rol atual sem perder histórico cadastral. | Inativação pede confirmação; cancelar mantém ativo; confirmar muda somente status e metadados; reativação retorna ao rol ativo; dados permanecem íntegros; repetição não duplica registros. |
| 6 | P0 | Como responsável, quero buscar por nome e filtrar status para localizar pessoas rapidamente. | Padrão Ativos; permite Inativos/Todos; trecho ignora caixa/acentos; combina filtros; mantém ordenação em português; diferencia rol vazio de busca sem resultado e oferece limpar filtros. |
| 7 | P0 | Como responsável, quero visualizar o resumo para acompanhar minha sociedade. | Total, ativos e inativos usam todos os membros e fecham aritmeticamente; busca não muda os números; próximo aniversário segue regra de ativos e desempate; carregamento, erro e ausência de candidatos têm estados distintos. |
| 8 | P0 | Como responsável, quero acompanhar aniversariantes para lembrar das pessoas da sociedade. | Mês atual completo e janela hoje…+29 dias são identificados; somente ativos com data conhecida; ordenação por ocorrência e nome; funciona na virada do mês/ano e em 29/02; exibe datas civis sem deslocamento; atualiza na mudança do dia. |
| 9 | P0 | Como responsável, quero exportar o rol em PDF e planilha para a rotina da igreja. | Confirma quantidade, contexto, filtros e campos; exporta todos os resultados filtrados na ordem; PDF multipágina legível e XLSX com endereço estruturado; não inclui observações; preserva acentos e datas; trata textos como texto na planilha; vazio/falha não anunciam sucesso. |
| 10 | P0 | Como responsável, quero usar o app pelo celular e teclado para concluir tarefas sem dificuldade. | Fluxos em largura de 320 px sem rolagem horizontal de página; rótulos persistentes; foco visível e ordem coerente; botões acionáveis por teclado; status comunicado por texto; formulário inválido orienta correção; mensagens de progresso/sucesso/erro acessíveis. |
| 11 | P0 | Como proprietário, quero isolamento dos meus dados para que terceiros não consultem meu rol. | Testes emulator negam usuário anônimo e outro UID para leitura/escrita de sociedade e membros; negam troca de ownerId, status/tipos inválidos e campos indevidos conforme schema; permitem operações válidas do proprietário; consultas não dependem de filtragem visual para segurança. |
| 12 | P0 | Como dono do produto, quero ambientes separados para validar mudanças antes de produção. | `.env.hml`/`.env.prod` ignorados; exemplo sem valores reais; geração valida variáveis; branches mapeadas conforme escopo; branch desconhecida falha; build HML verificável; regras só locais/emulator; nenhuma promoção PROD sem autorização explícita. |
| 13 | P1 | Como proprietário, quero convidar outro responsável para dividir a administração. | Futuro: definir papéis, aceitação, revogação e auditoria antes da implementação. |
| 14 | P1 | Como responsável, quero importar uma planilha para aproveitar um rol existente. | Futuro: prévia, mapeamento, validação por linha e tratamento de duplicados antes de gravar. |
| 15 | P1 | Como responsável, quero alterar os dados da unidade e transferir responsabilidade. | Futuro: definir fluxo de confirmação e autoridade sem comprometer isolamento. |
| 16 | P2 | Como responsável, quero relatórios e lembretes adicionais. | Futuro: validar demanda; agenda, mensagens e análises não integram o MVP. |

## Validação transversal

QA deve cobrir o ciclo Google/sociedade → cadastrar → buscar/filtrar → editar → inativar/reativar → aniversariantes → exportar. Testes de datas recebem “hoje” controlável. Testes de integração usam projetos `demo-*` e emulator, sem credenciais reais. Falhas remotas não podem exibir dados de outra sociedade ou sucesso fictício. Testar a massa de suporte de 1.000 membros antes de afirmar desempenho.

## Entregáveis e dependências

Pesquisa concluída precede decisões de produto. Designer entrega identidade e wireframes; a aprovação visual é a pausa antes de Copywriter, Backend, Frontend e QA seguirem suas entregas. O schema e as regras locais devem documentar e validar os contratos deste escopo. Ajustes posteriores de escopo exigem atualizar os documentos e critérios afetados.

## Incremento autorizado — ViaCEP

Como responsável, quero preencher o endereço pelo CEP para reduzir digitação. Critérios: consultar automaticamente somente CEP completo válido; preencher rua/bairro/cidade/UF sem alterar número/complemento; permitir edição manual e nova tentativa; manter dados em falha/CEP inexistente; cancelar/ignorar consultas obsoletas e preservar edições manuais durante a espera. Não consultar ao abrir um cadastro existente nem persistir automaticamente.

## Incremento — Diretoria anual

Como responsável, quero indicar quem integra a diretoria e qual cargo ocupa em cada ano, para consultar a composição atual e passada. Aceite: página Diretoria [ano] na navegação desktop/mobile; ano atual padrão e seleção de outro ano; adicionar membro cadastrado com cargo; editar cargo sem duplicar membro/ano; confirmar remoção do vínculo; preservar outros anos e dados do membro; exibir inativos; acesso pelo cadastro existente; regras isolam proprietário, validam membro da mesma sociedade, identidade e timestamps; estados de erro/vazio/carregamento e persistência após recarga testados.
