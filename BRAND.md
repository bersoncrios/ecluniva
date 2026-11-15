# Societas — identidade verbal e microcopy

Responsável: AGENTE COPYWRITER & BRAND STRATEGIST · 15/11/2026  
Base: MVP_SCOPE.md, DESIGN_SYSTEM.md e WIREFRAMES.md. Direção visual liberada para continuidade pelo dono do produto.

## Marca e tom

**Societas** ajuda responsáveis a organizar o rol das sociedades internas e acompanhar as pessoas da comunidade. Assinatura: **Seu rol organizado. Sua comunidade por perto.**

Falar em português brasileiro, com acolhimento, clareza e respeito. Usar frases curtas, verbos conhecidos e ações concretas. Evitar jargão técnico, culpa, promessas de segurança absoluta, alegações de vínculo oficial com a IPB e linguagem que confunda inativação na sociedade com desligamento da igreja. Não incluir versículos, títulos religiosos ou saudações litúrgicas como requisito para usar o app.

Preferir “membro”, “sociedade”, “igreja”, “responsável” e “rol de membros”. Usar “cadastro” para o registro de uma pessoa. Escrever UPH, SAF, UMP, UCP e UPA em maiúsculas. Manter “Societas” como nome próprio; marca visual pode usar minúsculas conforme o design.

## Entrada e primeiro acesso

| Elemento | Texto |
| --- | --- |
| Título de entrada | Organize o rol da sua sociedade |
| Apoio | Cadastre membros, acompanhe aniversários e tenha o rol à mão para a rotina da igreja. |
| Acesso | Entrar com Google |
| Ajuda do acesso | Use sua conta Google para acessar as sociedades sob sua responsabilidade. |
| Em andamento | Entrando… |
| Cancelamento | A entrada foi cancelada. Você pode tentar novamente quando quiser. |
| Popup bloqueado | Seu navegador bloqueou a janela de acesso. Permita a janela e tente novamente. |
| Falha geral | Não foi possível entrar. Verifique sua conexão e tente novamente. |
| Sessão encerrada | Sua sessão terminou. Entre novamente para continuar. |
| Primeira sociedade | Vamos começar pela sua sociedade |
| Apoio da criação | Informe a igreja, o tipo de sociedade e o nome da unidade local. |
| Seleção | Escolha a sociedade que deseja organizar |
| Criar | Criar sociedade |
| Confirmar criação | Criar e continuar |
| Gravação | Criando sociedade… |
| Sucesso | Sociedade criada. Agora você pode cadastrar os membros. |

Campos da sociedade: “Igreja”, “Tipo de sociedade”, “Nome da unidade local”. Exemplo de igreja: “Igreja Presbiteriana do Jardim”; exemplo de unidade: “Esperança”. Ajuda: “O cadastro fica disponível somente para sua conta neste MVP.” Não sugerir associação automática a uma igreja ou sociedade já existente.

## Navegação e ações

Desktop: “Visão geral”, “Membros”, “Aniversariantes”, “Trocar sociedade”. Celular: “Início”, “Membros”, “Aniversários”. Menu: “Conta e sociedade”; saída: “Sair”.

Ações: “Cadastrar membro”, “Editar”, “Salvar membro”, “Cancelar”, “Voltar ao rol”, “Exportar rol”, “Limpar filtros”, “Tentar novamente”, “Ver aniversariantes”, “Ver rol de membros”. Nome acessível da edição: “Editar {nome}”.

Progresso: “Carregando sociedades…”, “Carregando membros…”, “Salvando…”, “Atualizando status…”, “Gerando arquivo…”. Sucesso somente após a conclusão real: “Membro cadastrado.”, “Cadastro atualizado.”, “Membro inativado.”, “Membro reativado.”, “Arquivo gerado. Confira os downloads do seu navegador.”

## Formulário de membro

Introdução: “Preencha o nome para começar. Os outros campos são opcionais e podem ser completados depois.”

Seções: “Identificação”, “Vínculo com a sociedade”, “Contato”, “Endereço” e “Observações”. Rótulos: “Nome completo”, “Data de nascimento (opcional)”, “Data de recebimento (opcional)”, “Ofício (opcional)”, “Telefone (opcional)”, “E-mail (opcional)”, “CEP (opcional)”, “Logradouro (opcional)”, “Número (opcional)”, “Complemento (opcional)”, “Bairro (opcional)”, “Cidade (opcional)”, “UF (opcional)” e “Observações (opcional)”.

Ajuda de datas: “Informe dia, mês e ano. Se não souber a data completa, deixe em branco.” Subcampos rotulados “Dia”, “Mês” e “Ano”, sem mudança automática de foco. Recebimento: “Data de entrada na sociedade.” Ofício: “Informe o ofício, quando houver, conforme o cadastro da sua igreja.” Número: “Se necessário, use s/n.” Observações: “Registre apenas informações necessárias à organização da sociedade. Este campo não aparece nas exportações.”

| Validação | Mensagem |
| --- | --- |
| Nome vazio ou curto | Informe o nome com pelo menos 2 caracteres. |
| Nome longo | Use até 120 caracteres no nome. |
| Data inexistente ou incompleta | Informe uma data válida com dia, mês e ano completos. |
| Data futura | A data não pode estar no futuro. |
| Recebimento anterior ao nascimento | A data de recebimento deve ser igual ou posterior à data de nascimento. |
| Telefone | Informe um telefone com DDD e 10 ou 11 dígitos. |
| E-mail | Confira o e-mail. Exemplo: nome@exemplo.com. |
| CEP | Informe os 8 dígitos do CEP. |
| UF | Selecione uma UF válida. |
| Limite de texto | Use até {limite} caracteres neste campo. |
| Resumo de erros | Confira os campos indicados antes de salvar. |
| Falha ao salvar | Não foi possível salvar. Seus dados continuam no formulário. Tente novamente. |

Erros devem aparecer junto ao campo, além do resumo acessível; nunca depender apenas de cor ou de uma notificação que desaparece.

## Status e confirmação

Rótulos: “Ativo” e “Inativo”; filtros: “Ativos”, “Inativos”, “Todos”. Ajuda: “Inativar mantém o cadastro e retira o membro do rol ativo desta sociedade.”

Diálogo: título “Inativar membro?”; corpo “{nome} sairá do rol ativo desta sociedade. O cadastro será mantido e poderá ser reativado depois.” Ações: “Cancelar” e “Inativar membro”. Reativação: “Reativar membro”. Falha: “Não foi possível atualizar o status. Tente novamente.”

## Busca, resumo e estados vazios

| Contexto | Texto e ação |
| --- | --- |
| Busca | Buscar por nome |
| Status | Status |
| Contagem | 1 membro encontrado / {quantidade} membros encontrados |
| Resumo | Total de membros · Ativos · Inativos · Próximo aniversário |
| Sem membros | Ainda não há membros cadastrados. Comece pelo primeiro cadastro da sua sociedade. → Cadastrar primeiro membro |
| Busca sem resultado | Nenhum membro encontrado com estes filtros. Tente outro nome ou altere o status. → Limpar filtros |
| Sem ativos | Não há membros ativos nesta sociedade. Você pode consultar os inativos pelo filtro de status. |
| Sem inativos | Não há membros inativos nesta sociedade. |
| Falha de consulta | Não foi possível carregar os membros. → Tentar novamente |
| Sem sociedades | Sua primeira sociedade começa aqui. Informe os dados para organizar o rol. → Criar sociedade |
| Falha de acesso aos dados | Não foi possível acessar esta sociedade. Volte à seleção e tente novamente. |
| Sem próximo aniversário | Nenhum aniversário disponível. Informe a data de nascimento nos cadastros para acompanhar os próximos aniversários. |

Não mostrar números zero durante carregamento ou falha. Mensagens sobre ausência de resultados devem corresponder ao conjunto realmente consultado.

## Aniversariantes

Título: “Aniversariantes”. Apoio: “Somente membros ativos com nascimento informado.” Seções: “Neste mês” e “Próximos 30 dias”. Mostrar o intervalo da segunda seção: “De {início} a {fim}”. Próximo aniversário hoje: “Hoje”; futuro: “Em {quantidade} dias”, com singular “Amanhã” quando conveniente.

Vazio do mês: “Não há aniversariantes ativos com data informada neste mês.” Vazio da janela: “Não há aniversariantes ativos com data informada nos próximos 30 dias.” Nota para 29/02 em ano comum: “Nascimento em 29/02. Neste ano, lembrado em 28/02.” Exibir dia e mês, sem idade.

## Exportação

Título: “Exportar rol”. Resumo: “Serão incluídos {quantidade} membros de {sociedade}, conforme a busca e o filtro de status atuais.” Exibir igreja, sociedade, busca aplicada e status. Quando a busca estiver vazia: “Busca: todos os nomes”.

Formatos: “PDF” e “Planilha (.xlsx)”. Ações: “Gerar arquivo” e “Cancelar”.

Campos PDF: “Nome, nascimento, recebimento, ofício, telefone, e-mail e status.” Campos XLSX: “Os mesmos dados do PDF, além dos campos de endereço.” Nota: “Observações não são incluídas. Compartilhe o arquivo apenas conforme a necessidade da sociedade.”

Vazio: “Não há membros neste resultado para exportar.” Falha: “Não foi possível gerar o arquivo. Tente novamente.” Não afirmar que o arquivo foi salvo em pasta específica ou compartilhado automaticamente.

## Critérios editoriais de implementação

- Preservar acentos e nomes cadastrados; não converter nomes para caixa alta automaticamente.
- Tratar singular e plural nas contagens; evitar “membro(s)”.
- Usar data civil em DD/MM/AAAA e intervalo explícito quando necessário.
- Mensagens de erro devem indicar a próxima ação, sem expor códigos Firebase ao usuário.
- Identificar dados fictícios somente em demonstrações; não preencher o produto real com pessoas inventadas.
- Textos de carregamento e sucesso devem ser anunciados por região de status; erros importantes por alerta acessível.

## Consulta de endereço pelo CEP

Ajuda: “Informe o CEP para buscar o endereço. Número e complemento são preenchidos por você.” Progresso: “Buscando endereço…” Sucesso: “Endereço encontrado. Confira os dados e informe número e complemento, se houver.” CEP inexistente: “CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.” Falha: “Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.” Ação de repetição: “Buscar endereço novamente”. Os avisos são apresentados junto ao CEP e anunciados em região de status.

## Diretoria anual

Navegação: “Diretoria”. Título: “Diretoria [ano]”. Ajuda: “Escolha o ano e indique os membros e seus cargos. Isso não altera o ofício na igreja.” Ações: “Adicionar à diretoria”, “Salvar participação”, “Editar cargo”, “Remover da diretoria”. Vazio: “A diretoria de [ano] ainda não foi definida”. Remoção: “[nome] deixará a diretoria de [ano]. O cadastro e as participações de outros anos serão mantidos.” Sucesso somente após persistência: “Participação salva.” / “Participação removida da diretoria.” Erro: “Não foi possível salvar a participação. Os dados continuam no formulário. Tente novamente.”
