# Quadrei — sistema de design proposto

Responsável: AGENTE UX/UI DESIGNER · 15/11/2026  
Estado: direção visual liberada pelo dono do produto ao solicitar continuidade até finalizar o desenvolvimento em 15/11/2026. Base: RESEARCH.md, BACKLOG.md e MVP_SCOPE.md.

## Direção visual

Institucional, serena e acolhedora: verde profundo como referência ao contexto presbiteriano, superfícies claras e tipografia de sistema. O verde é uma proposta de identidade do Quadrei, sem alegar que reproduz um manual oficial da IPB. O nome aparece por extenso; um monograma Q pode ocupar espaços compactos. Não usar brasões ou marcas institucionais sem autorização.

## Tokens

| Uso | Valor | Aplicação |
| --- | --- | --- |
| Verde principal | `#145443` | Botões primários, navegação selecionada e links |
| Verde profundo | `#103B31` | Marca e superfícies institucionais |
| Verde suave | `#EAF3EE` | Seleção e status ativo com texto verde profundo |
| Fundo | `#F5F7F4` | Fundo geral |
| Superfície | `#FFFFFF` | Formulários, cartões e tabelas |
| Texto | `#172D25` | Títulos e conteúdo |
| Texto secundário | `#52645B` | Ajuda e contexto |
| Borda decorativa | `#DCE4DE` | Divisores e cartões |
| Borda de controle | `#75867C` | Campos identificáveis no fundo branco |
| Erro | `#A52525` | Mensagem com ícone/texto, nunca somente cor |
| Foco | `#245BB2` | Contorno de 3 px, deslocamento 3 px |

Validar contraste por combinação na implementação: texto comum mínimo 4,5:1; texto grande e limites essenciais de controles mínimo 3:1. Não usar o verde suave como texto. Bordas decorativas não substituem limites essenciais de controles.

## Tipografia e espaço

Fonte: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, sem download externo. Corpo 16 px/1,5; ajuda 14 px/1,5; títulos de tela 28–36 px/1,2; títulos de seção 20 px; números de resumo 32 px. Peso 400 no corpo, 600 nos controles e 700 em títulos. Não reduzir corpo no celular.

Escala de espaço: 4, 8, 12, 16, 24, 32 e 48 px. Margens laterais móveis 16 px; desktop 32 px. Raios de 8 px nos campos e 12 px nos cartões. Sombras discretas somente em camadas elevadas. Ícones de traço simples acompanhados de texto; ausência de fotos decorativas.

## Navegação e responsividade

- Telas autenticadas mantêm igreja, tipo e nome local visíveis. Trocar sociedade abre seleção; sair fica disponível no menu da conta.
- Desktop a partir de 1024 px: barra lateral de 224 px com Visão geral, Membros, Aniversariantes e Trocar sociedade. Conteúdo com largura máxima de 1280 px.
- Celular: cabeçalho com contexto e navegação inferior com três destinos rotulados: Início, Membros e Aniversários. Troca e saída no menu rotulado “Conta e sociedade”. Reservar espaço inferior para não cobrir conteúdo.
- De 320 a 767 px: uma coluna; membros em cartões; botões principais em largura confortável. De 768 a 1023 px: duas colunas quando couber, navegação compacta. Nunca exigir rolagem horizontal da página.

## Componentes

Botão primário verde para uma ação principal por área; secundário branco contornado para cancelar e exportar. Altura mínima 44 px e área de toque mínima 44 × 44 px. Durante gravação, texto “Salvando…” e bloqueio contra duplo envio; falha mantém campos preenchidos.

Campo com rótulo visível, ajuda associada, indicação “opcional” e erro logo abaixo. Datas permitem digitar dia, mês e ano com rótulos individuais e sem avanço automático de foco. Endereço em grupo com legenda. Formulários longos em página, sem modal pequeno. Botões Salvar e Cancelar ao final; se fixos no móvel, garantir espaço e teclado sem sobreposição.

Status com texto Ativo/Inativo e estilo distintivo. Não usar alternador sem explicação: inativar é ação secundária que abre confirmação; reativar é explícito. Tabela desktop com cabeçalhos e ação “Editar [nome]” acessível. Cartões móveis mantêm nome, status, contato disponível e Editar.

Resumo mostra total, ativos e inativos; números permanecem independentes dos filtros do rol. Aniversariante próximo tem nome e data, sem idade. Erro, carregamento e zero são estados diferentes.

Exportação em diálogo com sociedade, filtros, quantidade e campos incluídos; escolha PDF ou planilha e confirmação “Gerar arquivo”. Cancelar sempre disponível. Sem resultados, ação indisponível e motivo visível.

## Acessibilidade e estados

HTML semântico, link “Pular para o conteúdo”, um h1 por tela, ordem de tabulação natural e foco sempre visível. Diálogos recebem foco, contêm navegação por teclado, fecham por Cancelar/Escape e devolvem foco ao acionador. Atualizações acessíveis em região de status; erros de formulário com resumo e links aos campos. Respeitar redução de movimento.

Estados obrigatórios: carregamento sem contagens fictícias; falha com “Tentar novamente”; sociedade sem membros com “Cadastrar primeiro membro”; busca vazia com “Limpar filtros”; aniversários vazios com explicação; gravação pendente e falha preservando conteúdo. Ao trocar sociedade, limpar os dados da anterior antes do carregamento.

## Aprovação visual

O artefato `preview-design.html` mostra a proposta com dados fictícios: visão geral desktop e rol mobile. É uma composição estática para validar paleta, tipografia, hierarquia e navegação. Não autentica, salva, filtra ou exporta. Aprovação desta direção libera Copywriter, Backend, Frontend e QA, sem autorizar promoção para produção.
