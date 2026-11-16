# Presença nas plenárias

Em **Atas e plenárias**, abra uma plenária e selecione **Gerar link e QR Code**. O link pode ser preparado antecipadamente; o recebimento só abre no dia da reunião. Compartilhe o link ou baixe o QR Code em PNG. Exiba o código de seis dígitos no local da reunião.

O participante acessa sem conta, informa seu nome completo e o código. A página acompanha o resultado e guarda um comprovante neste navegador para evitar reenvios acidentais. Ela não mostra a lista de membros ou as confirmações de outras pessoas.

Mantenha a plenária aberta na conta do secretário: a conferência automática ocorre nessa tela. Se ela estiver fechada ou sem conexão, os envios continuam armazenados como pendentes até a reabertura. Nenhum serviço de processamento em segundo plano foi adicionado.

## Conferência e chamada

- Nomes completos idênticos, com diferenças apenas de acentuação, maiúsculas e espaços, são vinculados quando há exatamente um membro ativo correspondente.
- Nomes aproximados, homônimos, nomes de inativos e pessoas sem cadastro ficam pendentes. O secretário escolhe o membro correto ou desconsidera o envio. Os dados de contato do cadastro ajudam a distinguir homônimos na tela privada.
- A confirmação atualiza a própria lista de presença da plenária, com nome, ofício e cargo da diretoria daquele ano. A ata usa essa mesma lista.
- Uma nova confirmação para o mesmo membro informa presença já registrada, sem duplicar a chamada.
- O horário do envio e o da conferência são registrados pelo servidor no comprovante.
- Alterações de presença recebidas preservam a redação ainda não salva do secretário. Alterações concorrentes na redação continuam sujeitas à revisão de versão existente.

O código compartilhado ajuda a restringir os envios aos participantes da reunião, mas não comprova identidade ou localização. O secretário continua responsável pela conferência final.

## Encerramento

**Encerrar confirmações** bloqueia novos envios imediatamente, mantendo as pendências para conferência no mesmo dia. É possível reabrir durante a data da reunião. A conclusão da ata encerra o link na mesma transação e congela as presenças. O servidor também impede envios em outra data, segundo o fuso da plenária.

## Armazenamento e publicação

- `societies/{societyId}/attendanceSessions/{minuteId}`: vínculo do link e código, acessíveis somente ao responsável pela sociedade.
- `plenaryAttendance/{token}`: metadados mínimos da reunião e indicação de recebimento aberto/fechado. O token aleatório tem 192 bits; a coleção não permite listagem pública.
- `plenaryAttendance/{token}/requests/{receipt}`: nome informado, código, horários, resultado e membro vinculado. O público pode criar um envio válido e consultar apenas um comprovante cujo identificador aleatório já conheça; não pode listar ou modificar envios. Somente o responsável pode conferir a coleção.

A aplicação e as regras atualizadas de `firestore.rules` devem ser publicadas juntas. Não é necessário habilitar login anônimo ou configurar uma Cloud Function. A geração do QR Code ocorre localmente, sem serviços externos.
