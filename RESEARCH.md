# Pesquisa de referências — Societas

Responsável: AGENTE PESQUISADOR  
Data: 15/11/2026  
Estado: pesquisa documental; não representa validação com responsáveis por sociedades IPB.

## Método e limites

Consulta a páginas oficiais de produtos e guias primários de acessibilidade. Foram observados padrões de cadastro, consulta, filtros, exportação e preenchimento de formulários. Não houve teste dos produtos com contas reais, entrevista com usuários ou medição comparativa de usabilidade. Funcionalidades anunciadas não comprovam facilidade de uso. As recomendações abaixo são hipóteses para Product Owner e Designer, e não decisões de escopo.

## Referências de gestão comunitária

| Fonte primária | Achado observado | Possível aplicação ao Societas |
| --- | --- | --- |
| [Planning Center People](https://www.planningcenter.com/people) | Centraliza perfis, oferece campos personalizáveis e listas por critérios; menciona aniversários como condição de agrupamento. | Tratar o membro como unidade principal e apresentar aniversariantes como consulta derivada do cadastro. |
| [Planning Center — listas](https://help.planningcenter.com/en/139197-lists-overview.html) | Listas filtram pessoas com base em informações e atividades; o guia chama atenção para a atualização dos resultados. | Mostrar filtros ativos e atualizar a lista após salvar ou alterar status, evitando resultados visualmente desatualizados. |
| [Breeze — introdução a People](https://support.breezechms.com/hc/en-us/articles/360049088914-Getting-Started-With-People) | Reúne inclusão, busca, filtros, ações e exportação; distingue arquivar e excluir. | Manter as ações do rol próximas à lista e tornar a inativação recuperável. A distinção de status deve ser explicada no contexto da sociedade. |
| [Breeze — exportação](https://support.breezechms.com/hc/en-us/articles/360001160713-Exporting-People) | Exporta pessoas para Excel e permite selecionar campos. O fluxo parte da lista que o usuário quer exportar. | Explicitar se a exportação corresponde ao rol completo ou ao resultado filtrado; informar quantidade e campos antes de gerar. |

As aplicações propostas são inferências, não funcionalidades copiadas integralmente. Sistemas amplos também incluem contribuições, comunicação e automações; sua existência não justifica adicioná-las ao MVP do Societas.

## Formulários para pessoas com pouca familiaridade digital

1. **Identificar campos de modo persistente.** A [W3C WAI](https://www.w3.org/WAI/tutorials/forms/labels/) recomenda rótulos associados aos controles. Aplicação sugerida: rótulo visível sobre cada campo, associação `for`/`id` e placeholder usado somente como exemplo.
2. **Explicar formato e obrigatoriedade.** O [critério WCAG sobre rótulos e instruções](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions) orienta explicar a entrada esperada. Aplicação sugerida: marcar campos opcionais, informar o formato de datas e não exigir contato completo para iniciar um cadastro sem validar essa necessidade com o responsável.
3. **Ajudar a corrigir erros e confirmar sucesso.** O [tutorial de notificações WAI](https://www.w3.org/WAI/tutorials/forms/notifications/) recomenda feedback claro, erros próximos aos campos e orientação para correção. Aplicação sugerida: preservar os valores após falha, apresentar resumo de erros com links para os campos e confirmar salvamento somente após conclusão da operação.
4. **Facilitar datas antigas.** O [GOV.UK Design System](https://design-system.service.gov.uk/components/date-input/) apresenta entrada de dia, mês e ano para datas conhecidas, como nascimento, e orienta não avançar o foco automaticamente. Aplicação sugerida: permitir digitação direta e testar a experiência em celular, sem obrigar navegação mensal por décadas em um calendário.

## Hipóteses a encaminhar ao produto e design

- Priorizar tarefas reconhecíveis: “Cadastrar membro”, “Buscar por nome”, “Aniversariantes” e “Exportar rol”.
- Manter igreja e sociedade atual visíveis para reduzir edição na unidade errada.
- Organizar o formulário em identificação, vínculo, contato, endereço e observações, mantendo uma ação de salvar clara.
- Em telas pequenas, experimentar cartões com nome, status e ação de edição; validar se são mais fáceis que tabela horizontal.
- Diferenciar “Ainda não há membros” de “Nenhum membro encontrado com estes filtros”, com ação pertinente a cada situação.
- Usar texto além da cor para comunicar ativo/inativo e falhas; prever navegação por teclado e foco visível.
- Explicar que inativar mantém o registro e permitir reativação; a definição operacional de inativo deve constar no escopo.
- Antes da exportação, deixar claro quais registros e dados serão incluídos. Downloads contêm dados pessoais e devem ser compartilhados somente pelo responsável conforme a finalidade da comunidade.

## Pontos a validar em uso

Estas perguntas não bloqueiam a elaboração inicial dos documentos: significado de “ofício” para a rotina local; quais campos realmente precisam ser obrigatórios; responsável por mais de uma sociedade; política para aniversários em 29/02; inclusão de inativos nos aniversariantes; necessidade de exportar observações e endereço completo. O Product Owner deve registrar premissas explícitas e critérios de aceite para evitar comportamentos ambíguos.

## Conclusão para o estúdio

As referências sustentam a investigação de um fluxo centrado em perfis, consulta filtrada e exportação contextual, com formulários que expliquem campos e recuperação de erros. Não há evidência nesta pesquisa de preferência dos usuários IPB por paleta, tipografia ou disposição específica de telas; essas escolhas deverão ser apresentadas como proposta do Designer e submetidas à validação visual solicitada pelo dono do produto.

## Extensão autorizada — consulta de CEP (15/11/2026)

Fonte primária: [documentação ViaCEP](https://viacep.com.br/), consultada antes da decisão de implementação. A API recebe oito dígitos em `https://viacep.com.br/ws/{cep}/json/`; formato inválido retorna HTTP 400 e CEP inexistente retorna propriedade `erro`. Mapeamento: logradouro → street, bairro → neighborhood, localidade → city, uf → state. O complemento retornado pode descrever trecho do logradouro e não identifica a unidade do membro; número e complemento residencial permanecem manuais. A documentação alerta contra uso massivo: consultar somente CEP completo alterado, sem consultas de base em lote.
