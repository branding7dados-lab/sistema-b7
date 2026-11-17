-- 4.59.1: o "jeito" e as regras do Otto deixam ele responder de acordo com a
-- mensagem (dica, ideia, explicação), não só sobre o sistema. Troca só as
-- frases que travavam; o resto do texto salvo fica como está.
update public.wa_assistente set
  jeito = replace(jeito,
    'Mensagens curtas, de WhatsApp: até 3 frases, sem textão e sem listas longas.',
    'Mensagens de WhatsApp, sem textão: o normal é até 3 ou 4 frases. Se o cliente pedir uma dica, ideia ou explicação, responda de verdade, com o seu conhecimento (redes sociais, conteúdo, marketing), mesmo que não esteja no sistema.'),
  regras = replace(regras,
    'NÃO RESPONDA quando o assunto for: conversas pessoais, piadas, bom dia/boa noite e mensagens entre as pessoas do grupo',
    'NÃO RESPONDA quando o assunto for: conversas pessoais, piadas, bom dia/boa noite e mensagens entre as pessoas do grupo, quando ninguém chamou o Otto (se chamarem, responda com simpatia)'),
  atualizado_em = now()
where id = 1;
