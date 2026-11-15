# Societas — wireframes por tela

Responsável: AGENTE UX/UI DESIGNER · 15/11/2026  
Direção visual liberada para implementação em 15/11/2026. Conteúdo verbal detalhado em BRAND.md.

## Fluxo principal

Entrar com Google → selecionar sociedade (ou criar a primeira) → visão geral → membros → cadastrar/editar → confirmar salvamento. Aniversariantes é destino próprio; exportação parte do rol e usa os filtros atuais.

## 1. Entrada

Marca Societas, título curto sobre organizar o rol, explicação do acesso do responsável e botão “Entrar com Google”. Mostrar progresso, cancelamento recuperável e falha com nova tentativa. Sem campos de senha própria.

## 2. Selecionar ou criar sociedade

Lista de cartões somente das sociedades do responsável, cada um com igreja, tipo e nome local. Ação “Criar sociedade”. Sem unidades, abrir formulário com igreja, tipo (UPH/SAF/UMP/UCP/UPA) e nome local, todos obrigatórios. Botão “Criar e continuar”; erros próximos aos campos. Sem catálogo público ou edição da unidade no MVP.

## 3. Visão geral

Contexto da sociedade no topo; título “Visão geral” e ação “Cadastrar membro”. Linha de três cartões: total, ativos e inativos. Abaixo, próximo aniversário em destaque discreto e lista curta dos próximos 30 dias com link “Ver aniversariantes”; acesso “Ver rol de membros”. No celular, cartões numéricos em grade apenas se legíveis; caso contrário empilhar. Carregamento, erro e ausência de aniversariantes próprios.

## 4. Rol de membros

Título, contagem do resultado e ações Cadastrar membro/Exportar rol. Campo “Buscar por nome” seguido de filtro rotulado Status (Ativos padrão, Inativos, Todos). Desktop: tabela Nome, Contato, Status e Ações; dados completos na edição. Mobile: cartões com os mesmos dados essenciais e botão Editar. Exportação aparece abaixo das ações principais se faltar espaço. Filtros combinados e contexto permanecem visíveis; sem resultado, explicar e oferecer Limpar filtros. Rol realmente vazio oferece cadastro.

## 5. Cadastro e edição

Página com Voltar ao rol, título e indicação de campos opcionais. Seções: Identificação (nome, nascimento); Vínculo (recebimento, ofício com ajuda); Contato (telefone, e-mail); Endereço (CEP, logradouro, número, complemento, bairro, cidade e UF); Observações. Nome obrigatório; demais conforme escopo. Rótulos permanecem visíveis. Datas em dia/mês/ano digitáveis. No CEP, ajuda informa busca automática ao completar oito dígitos. Exibir progresso, resultado ou falha junto ao campo em região de status; falha permite nova tentativa e preenchimento manual. Logradouro, bairro, cidade e UF recebem o retorno; número e complemento são manuais. Todos os controles permanecem editáveis. Salvar membro e Cancelar ao final. Na edição, status atual e ação secundária Inativar ou Reativar. Salvar não muda o ID. Falha mantém valores; resumo de erros recebe foco quando inválido.

## 6. Confirmar inativação

Diálogo: nome do membro, explicação de que o cadastro será mantido e sairá do rol ativo da sociedade. Cancelar e Inativar membro. Progresso e falha recuperável. Reativar usa ação explícita e confirma resultado após gravação.

## 7. Aniversariantes

Título e explicação “Somente membros ativos com nascimento informado”. Duas seções rotuladas “Neste mês” (mês completo) e “Próximos 30 dias” com intervalo explícito. Listas de nome e dia/mês; Hoje em texto quando aplicável, sem idade. Indicação de 29/02 adaptado para 28/02 nos anos comuns. No celular, seções empilhadas; desktop pode usar duas colunas. Sem candidatos, mensagem específica sem sugerir cadastro inexistente.

## 8. Exportar rol

Diálogo amplo ou folha móvel: igreja, sociedade, filtros aplicados e quantidade de registros. Escolha PDF ou Planilha, com lista de campos por formato e informação de que observações não são incluídas. Gerar arquivo/Cancelar. Quantidade refere-se ao conjunto filtrado inteiro. Progresso, sucesso real e falha separados. Desabilitar geração para conjunto vazio com motivo legível.

## Estados transversais

Sessão expirada retorna à entrada; saída limpa dados apresentados. Troca de sociedade retorna à seleção e limpa contexto anterior. Falha de consulta não apresenta zero como resultado. Teclado e leitor de tela devem alcançar todos os destinos e ações. Layout alvo desde 320 px, sem sobreposição da navegação com os controles finais.
