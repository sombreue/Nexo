# Remoção de temas com personagens e marcas de terceiros

## Objetivo
Este manual orienta a remoção preventiva dos temas de personagens de terceiros registrados anteriormente no seletor do Nexo.

## Temas a remover
- Batman (`batman`)
- Homem-Aranha / Spider-Man (`spider-man`)
- Doutor Destino / Doctor Doom (`doctor-doom`)
- Homem de Ferro / Iron Man (`iron-man`)
- Hulk (`hulk`)
- Superman (`superman`)
- Capitão América / Captain America (`captain-america`)
- Wolverine (`wolverine`)
- Deadpool (`deadpool`)
- Sonic (`sonic`)
- Quarteto Fantástico (`fantastic-four`)
- Justiceiro / Punisher (`punisher`)

## Procedimento
1. Faça backup do repositório antes de excluir arquivos.
2. Remova as opções desses temas de `public/global-temas.js` e as associações de logotipos.
3. Pesquise os identificadores acima em todo o repositório, incluindo HTML, JavaScript, CSS, documentação e configurações.
4. Identifique imagens usadas exclusivamente por esses temas em `public/imagens/`; confirme que nenhum outro recurso as utiliza antes de removê-las.
5. Remova as regras CSS exclusivas desses temas e suas referências de imagem.
6. Teste login, navegação, logo padrão do Nexo, seletor e temas restantes.
7. Atualize as referências de cache e verifique a versão publicada.

## Temas salvos no navegador
Instalações antigas podem manter um tema salvo em `localStorage`. O código deve usar um tema válido quando o identificador salvo não existir mais. Se o tema antigo persistir, faça uma recarga sem cache ou remova a chave `agenda-auruda-tema` nas ferramentas do navegador.

## Nota jurídica
Personagens, imagens, nomes e logotipos podem estar protegidos por direitos autorais e/ou marcas. O risco depende da licença, autorização, origem do material, contexto e forma de distribuição. A remoção é preventiva e não garante ausência de risco jurídico.

Referências oficiais:
- Lei nº 9.610/1998 — Direitos Autorais: https://www.planalto.gov.br/ccivil_03/leis/l9610.htm
- Lei nº 9.279/1996 — Propriedade Industrial: https://www.planalto.gov.br/ccivil_03/leis/l9279.htm
