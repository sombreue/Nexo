/* Temas opcionais de personagens de terceiros.
 * Para uma instalação institucional, defina window.NEXO_SUPER_TEMAS_ENABLED = false
 * antes de carregar global-temas.js. Este arquivo pode ser omitido por completo.
 */
(() => {
  window.NEXO_SUPER_TEMAS = [
        { id: "batman", nome: "Batman", icone: "🦇", cor: "#f2c300", grupo: "Super temas" },
        { id: "spider-man", nome: "Homem-Aranha", icone: "🕷", cor: "#e52521", grupo: "Super temas" },
        { id: "doctor-doom", nome: "Doutor Destino", icone: "☠", cor: "#3fae49", grupo: "Super temas" },
        { id: "iron-man", nome: "Homem de Ferro", icone: "◈", cor: "#e21b23", grupo: "Super temas" },
        { id: "hulk", nome: "Hulk", icone: "✊", cor: "#7bbf35", grupo: "Super temas" },
        { id: "superman", nome: "Superman", icone: "S", cor: "#e52521", grupo: "Super temas" },
        { id: "captain-america", nome: "Capitão América", icone: "★", cor: "#2f6fbd", grupo: "Super temas" },
        { id: "wolverine", nome: "Wolverine", icone: "✕", cor: "#fdb300", grupo: "Super temas" },
        { id: "deadpool", nome: "Deadpool", icone: "☠", cor: "#d71920", grupo: "Super temas" },
        { id: "sonic", nome: "Sonic", icone: "⚡", cor: "#1261c9", grupo: "Super temas" },
        { id: "fantastic-four", nome: "Quarteto Fantástico", icone: "✦", cor: "#2f7ee6", grupo: "Super temas" },
        { id: "punisher", nome: "Justiceiro", icone: "☠", cor: "#d71920", grupo: "Super temas" }
  ];
  window.NEXO_SUPER_TEMA_LOGOS = {
  "batman": "/imagens/batman.png",
  "spider-man": "/imagens/spiderman.png",
  "doctor-doom": "/imagens/doom).png",
  "iron-man": "/imagens/ironman.png",
  "hulk": "/imagens/hulk.png",
  "captain-america": "/imagens/captainamerica.png",
  "wolverine": "/imagens/wolverine.png",
  "deadpool": "/imagens/deadpool.png",
  "sonic": "/imagens/sonic.png",
  "fantastic-four": "/imagens/fantastic4.png",
  "punisher": "/imagens/punisher.png",
  "superman": "/imagens/superman.png"
};
  if (window.NEXO_SUPER_TEMAS_ENABLED !== false && !document.querySelector('link[data-nexo-super-temas]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'global-super-temas.css?v=20261021';
    link.dataset.nexoSuperTemas = 'true';
    document.head.appendChild(link);
  }
})();
