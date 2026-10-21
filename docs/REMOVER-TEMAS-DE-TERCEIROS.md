# Temas opcionais e uso institucional do Nexo

## Objetivo
O Nexo separa o núcleo da aplicação dos super temas que usam personagens ou marcas de terceiros. Uma instituição pode desativar o pacote opcional sem precisar editar as regras internas do seletor de temas.

## Arquivos
- `public/global-temas.js`: seletor, aplicação de temas e núcleo.
- `public/global-temas-estilos.css`: estilos compartilhados e temas base.
- `public/global-super-temas.js`: metadados e caminhos das logos dos super temas.
- `public/global-super-temas.css`: estilos exclusivos dos super temas.
- `docs/REMOVER-TEMAS-DE-TERCEIROS.md`: este manual.

## Desativação recomendada para instituições
Antes de carregar `global-temas.js`, defina a opção abaixo no HTML da implantação:

```html
<script>window.NEXO_SUPER_TEMAS_ENABLED = false;</script>
<script src="global-temas.js?v=20261021"></script>
```

Com a opção desativada, o seletor não registra os super temas e não carrega o módulo opcional. Temas salvos anteriormente que não existirem mais serão substituídos pelo tema base `ruby`. Também é possível omitir `global-super-temas.js` e `global-super-temas.css` da distribuição: o núcleo inicia sem os super temas se o módulo opcional não estiver disponível.

## Remoção completa do pacote
Se a distribuição institucional precisar excluir os recursos por completo:
1. Defina `window.NEXO_SUPER_TEMAS_ENABLED = false` antes de `global-temas.js`.
2. Remova `public/global-super-temas.js` e `public/global-super-temas.css` da cópia distribuída.
3. Pesquise os identificadores dos personagens no repositório para identificar imagens e referências antigas que possam estar fora do pacote CSS/JS.
4. Remova somente imagens usadas exclusivamente por esses temas, depois de verificar que nenhum outro recurso depende delas.
5. Faça uma busca final por `batman`, `spider-man`, `doctor-doom`, `iron-man`, `hulk`, `superman`, `captain-america`, `wolverine`, `deadpool`, `sonic`, `fantastic-four` e `punisher`.
6. Teste login, navegação, agenda, logo padrão, temas restantes e tema salvo no navegador.

## Temas incluídos no pacote opcional
Batman, Homem-Aranha, Doutor Destino, Homem de Ferro, Hulk, Superman, Capitão América, Wolverine, Deadpool, Sonic, Quarteto Fantástico e Justiceiro.

## Nota jurídica
Personagens, imagens, nomes e logotipos podem estar protegidos por direitos autorais e/ou marcas. O risco depende de licença, autorização, origem do material, contexto e forma de distribuição. O isolamento facilita a remoção, mas não substitui uma revisão de licenças nem garante ausência de risco jurídico.

Referências oficiais:
- Lei nº 9.610/1998 — Direitos Autorais: https://www.planalto.gov.br/ccivil_03/leis/l9610.htm
- Lei nº 9.279/1996 — Propriedade Industrial: https://www.planalto.gov.br/ccivil_03/leis/l9279.htm
