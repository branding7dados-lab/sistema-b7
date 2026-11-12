/* =====================================================================
   NAVEGAÇÃO GLOBAL — um modelo só, duas apresentações

   Regra de produto:
     • PERMISSÃO decide o que a pessoa PODE abrir (B7.Perm.podeRota —
       papel + funções extras, a mesma guarda que o roteador usa);
     • FUNÇÃO OPERACIONAL decide o que aparece PRIMEIRO
       (B7.Perm.funcoesOperacionais: coordenador, videomaker, designer).
   Administrador é gestão/acesso, não persona operacional: admin puro
   não ganha "Meu trabalho" nem Painel — a casa dele é a Central B7.

   Desktop/tablet: barra lateral em grupos (Principal · Meu trabalho ·
   Operação · Mais ferramentas). Celular (≤760px): topo de vidro + barra
   inferior (até 4 destinos + "Mais") + folha "Mais". Mesma resolução de
   itens nos dois — só a apresentação muda.

   Nada aqui é segurança: esconder um item não bloqueia a rota; a guarda
   de rota (app.js) e o banco continuam valendo.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Nav = (function () {
  const esc = s => B7.UI.esc(s);
  /* 4.4.5: ícones da coleção Phosphor (MIT) — traço fino; o destino ativo
     mostra a versão cheia (.phi-f). WhatsApp: o logo oficial (Simple Icons, CC0). */
  const IC = {
    "painel": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M207.06,72.67A111.24,111.24,0,0,0,128,40h-.4C66.07,40.21,16,91,16,153.13V176a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V152A111.25,111.25,0,0,0,207.06,72.67ZM224,176H119.71l54.76-75.3a8,8,0,0,0-12.94-9.42L99.92,176H32V153.13c0-3.08.15-6.12.43-9.13H56a8,8,0,0,0,0-16H35.27c10.32-38.86,44-68.24,84.73-71.66V80a8,8,0,0,0,16,0V56.33A96.14,96.14,0,0,1,221,128H200a8,8,0,0,0,0,16h23.67c.21,2.65.33,5.31.33,8Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M240,152v24a16,16,0,0,1-16,16H115.93a4,4,0,0,1-3.24-6.35L174.27,101a8.21,8.21,0,0,0-1.37-11.3,8,8,0,0,0-11.37,1.61l-72,99.06A4,4,0,0,1,86.25,192H32a16,16,0,0,1-16-16V153.13c0-1.79,0-3.57.13-5.33a4,4,0,0,1,4-3.8H48a8,8,0,0,0,8-8.53A8.17,8.17,0,0,0,47.73,128H23.92a4,4,0,0,1-3.87-5c12-43.84,49.66-77.13,95.52-82.28a4,4,0,0,1,4.43,4V72a8,8,0,0,0,8.53,8A8.17,8.17,0,0,0,136,71.73V44.67a4,4,0,0,1,4.43-4A112.18,112.18,0,0,1,236.23,123a4,4,0,0,1-3.88,5H208.27a8.17,8.17,0,0,0-8.25,7.47,8,8,0,0,0,8,8.53h27.92a4,4,0,0,1,4,3.86C240,149.23,240,150.61,240,152Z\"/></svg>",
    "gestao": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z\"/></svg>",
    "central": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M120,56v48a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40h48A16,16,0,0,1,120,56Zm80-16H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm-96,96H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm96,0H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Z\"/></svg>",
    "clientes": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z\"/></svg>",
    "publicacoes": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z\"/></svg>",
    "aprovacoes": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z\"/></svg>",
    "kanban": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,48H40a8,8,0,0,0-8,8V208a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V160h48v16a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V56A8,8,0,0,0,216,48ZM88,208H48V128H88Zm0-96H48V64H88Zm64,32H104V64h48Zm56,32H168V128h40Zm0-64H168V64h40Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M160,56v96a8,8,0,0,1-8,8H112a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h40A8,8,0,0,1,160,56Zm64-8H184a8,8,0,0,0-8,8v52a4,4,0,0,0,4,4h48a4,4,0,0,0,4-4V56A8,8,0,0,0,224,48Zm4,80H180a4,4,0,0,0-4,4v44a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V132A4,4,0,0,0,228,128ZM80,48H40a8,8,0,0,0-8,8v52a4,4,0,0,0,4,4H84a4,4,0,0,0,4-4V56A8,8,0,0,0,80,48Zm4,80H36a4,4,0,0,0-4,4v76a16,16,0,0,0,16,16H72a16,16,0,0,0,16-16V132A4,4,0,0,0,84,128Z\"/></svg>",
    "design": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM156,88a12,12,0,1,1-12,12A12,12,0,0,1,156,88Zm60,112H40V160.69l46.34-46.35a8,8,0,0,1,11.32,0h0L165,181.66a8,8,0,0,0,11.32-11.32l-17.66-17.65L173,138.34a8,8,0,0,1,11.31,0L216,170.07V200Z\"/></svg>",
    "video": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M192,72V184a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V72A16,16,0,0,1,32,56H176A16,16,0,0,1,192,72Zm58,.25a8.23,8.23,0,0,0-6.63,1.22L209.78,95.86A4,4,0,0,0,208,99.19v57.62a4,4,0,0,0,1.78,3.33l33.78,22.52a8,8,0,0,0,8.58.19,8.33,8.33,0,0,0,3.86-7.17V80A8,8,0,0,0,250,72.25Z\"/></svg>",
    "gravacoes": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,104H102.09L210,75.51a8,8,0,0,0,5.68-9.84l-8.16-30a15.93,15.93,0,0,0-19.42-11.13L35.81,64.74a15.75,15.75,0,0,0-9.7,7.4,15.51,15.51,0,0,0-1.55,12L32,111.56c0,.14,0,.29,0,.44v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V112A8,8,0,0,0,216,104ZM192.16,40l6,22.07-22.62,6L147.42,51.83Zm-66.69,17.6,28.12,16.24-36.94,9.75L88.53,67.37Zm-79.4,44.62-6-22.08,26.5-7L94.69,89.4ZM208,200H48V120H208v80Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,104H102.09L210,75.51a8,8,0,0,0,5.68-9.84l-8.16-30a15.93,15.93,0,0,0-19.42-11.13L35.81,64.74a15.75,15.75,0,0,0-9.7,7.4,15.51,15.51,0,0,0-1.55,12L32,111.56c0,.14,0,.29,0,.44v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V112A8,8,0,0,0,216,104ZM192.16,40l6,22.07L164.57,71,136.44,54.72ZM77.55,70.27l28.12,16.24-59.6,15.73-6-22.08Z\"/></svg>",
    "calendario": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z\"/></svg>",
    "oportunidades": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z\"/></svg>",
    "trends": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M240,56v64a8,8,0,0,1-13.66,5.66L200,99.31l-58.34,58.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,188.69,88,162.34,61.66A8,8,0,0,1,168,48h64A8,8,0,0,1,240,56Z\"/></svg>",
    "roteiros": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,176H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm-8-56V44l44,44Z\"/></svg>",
    "linhas": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M80,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H88A8,8,0,0,1,80,64Zm136,56H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Zm0,64H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM44,52A12,12,0,1,0,56,64,12,12,0,0,0,44,52Zm0,64a12,12,0,1,0,12,12A12,12,0,0,0,44,116Zm0,64a12,12,0,1,0,12,12A12,12,0,0,0,44,180Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM68,188a12,12,0,1,1,12-12A12,12,0,0,1,68,188Zm0-48a12,12,0,1,1,12-12A12,12,0,0,1,68,140Zm0-48A12,12,0,1,1,80,80,12,12,0,0,1,68,92Zm124,92H104a8,8,0,0,1,0-16h88a8,8,0,0,1,0,16Zm0-48H104a8,8,0,0,1,0-16h88a8,8,0,0,1,0,16Zm0-48H104a8,8,0,0,1,0-16h88a8,8,0,0,1,0,16Z\"/></svg>",
    "semanas": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM169.66,133.66l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35a8,8,0,0,1,11.32,11.32ZM48,80V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80Z\"/></svg>",
    "legendas": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,144H32V64H224V192ZM118.92,151.71A8,8,0,0,1,116,162.64a40,40,0,1,1,0-69.28,8,8,0,1,1-8,13.85,24,24,0,1,0,0,41.58A8,8,0,0,1,118.92,151.71Zm80,0A8,8,0,0,1,196,162.64a40,40,0,1,1,0-69.28,8,8,0,1,1-8,13.85,24,24,0,1,0,0,41.58A8,8,0,0,1,198.92,151.71Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM116,162.64a40,40,0,1,1,0-69.28,8,8,0,1,1-8,13.85,24,24,0,1,0,0,41.58,8,8,0,0,1,8,13.85Zm80,0a40,40,0,1,1,0-69.28,8,8,0,1,1-8,13.85,24,24,0,1,0,0,41.58,8,8,0,0,1,8,13.85Z\"/></svg>",
    "projetos": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.35,44L178.57,92.29l-80.35-44Zm0,88L47.65,76,81.56,57.43l80.35,44Zm88,55.85h0l-80,43.79V133.83l32-17.51V152a8,8,0,0,0,16,0V107.56l32-17.51v85.76Z\"/></svg>",
    "arquivados": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm-72,96H104a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm72-56H32V64H224V88Z\"/></svg>",
    "site": "<svg class=\"phi phi-r\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.6 2.9 3.9 5.9 3.9 9s-1.3 6.1-3.9 9c-2.6-2.9-3.9-5.9-3.9-9s1.3-6.1 3.9-9z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"currentColor\" fill-opacity=\".25\"/><path d=\"M3 12h18M12 3c2.6 2.9 3.9 5.9 3.9 9s-1.3 6.1-3.9 9c-2.6-2.9-3.9-5.9-3.9-9s1.3-6.1 3.9-9z\"/></svg>",
    "jogos": "<svg class=\"phi phi-r\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.5 8h11a4 4 0 0 1 3.9 3.1l1 4.6A2.7 2.7 0 0 1 17.6 17l-1.6-2H8l-1.6 2a2.7 2.7 0 0 1-4.8-1.3l1-4.6A4 4 0 0 1 6.5 8z\"/><path d=\"M8 10.5v3M6.5 12h3\"/><circle cx=\"15.5\" cy=\"11\" r=\".6\" fill=\"currentColor\"/><circle cx=\"17.2\" cy=\"12.8\" r=\".6\" fill=\"currentColor\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.5 8h11a4 4 0 0 1 3.9 3.1l1 4.6A2.7 2.7 0 0 1 17.6 17l-1.6-2H8l-1.6 2a2.7 2.7 0 0 1-4.8-1.3l1-4.6A4 4 0 0 1 6.5 8z\" fill=\"currentColor\"/></svg>",
    "lixeira": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z\"/></svg>",
    "usuarios": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136Zm-57.87,58.85a8,8,0,0,1-12.26,10.3C165.75,181.19,138.09,168,108,168s-57.75,13.19-77.87,37.15a8,8,0,0,1-12.25-10.3c14.94-17.78,33.52-30.41,54.17-37.17a68,68,0,1,1,71.9,0C164.6,164.44,183.18,177.07,198.13,194.85ZM108,152a52,52,0,1,0-52-52A52.06,52.06,0,0,0,108,152Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136ZM144,157.68a68,68,0,1,0-71.9,0c-20.65,6.76-39.23,19.39-54.17,37.17A8,8,0,0,0,24,208H192a8,8,0,0,0,6.13-13.15C183.18,177.07,164.6,164.44,144,157.68Z\"/></svg>",
    "config": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm109.94-52.79a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A112.1,112.1,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.62a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21Zm-15,34.91-28.57,16.25a8,8,0,0,0-3,3c-.58,1-1.19,2.06-1.81,3.06a7.94,7.94,0,0,0-1.22,4.21l-.15,32.25a95.89,95.89,0,0,1-25.37,14.3L134,199.13a8,8,0,0,0-3.91-1h-.19c-1.21,0-2.43,0-3.64,0a8.08,8.08,0,0,0-4.1,1l-28.84,16.1A96,96,0,0,1,67.88,201l-.11-32.2a8,8,0,0,0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.09,8.09,0,0,0-3-3.06l-28.6-16.29a90.49,90.49,0,0,1,0-28.26L61.67,97.63a8,8,0,0,0,3-3c.58-1,1.19-2.06,1.81-3.06a7.94,7.94,0,0,0,1.22-4.21l.15-32.25a95.89,95.89,0,0,1,25.37-14.3L122,56.87a8,8,0,0,0,4.1,1c1.21,0,2.43,0,3.64,0a8.08,8.08,0,0,0,4.1-1l28.84-16.1A96,96,0,0,1,188.12,55l.11,32.2a8,8,0,0,0,1.22,4.22c.62,1,1.23,2,1.8,3.06a8.09,8.09,0,0,0,3,3.06l28.6,16.29A90.49,90.49,0,0,1,222.9,142.12Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M237.94,107.21a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z\"/></svg>",
    "atalhos": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,144H32V64H224V192Zm-16-64a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H200A8,8,0,0,1,208,128Zm0-32a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H200A8,8,0,0,1,208,96ZM72,160a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16h8A8,8,0,0,1,72,160Zm96,0a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,160Zm40,0a8,8,0,0,1-8,8h-8a8,8,0,0,1,0-16h8A8,8,0,0,1,208,160Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM64,168H48a8,8,0,0,1,0-16H64a8,8,0,0,1,0,16Zm96,0H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm48,0H192a8,8,0,0,1,0-16h16a8,8,0,0,1,0,16Zm0-32H48a8,8,0,0,1,0-16H208a8,8,0,0,1,0,16Zm0-32H48a8,8,0,0,1,0-16H208a8,8,0,0,1,0,16Z\"/></svg>",
    "aovivo": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Zm73.71,7.14a80,80,0,0,1-14.08,22.2,8,8,0,0,1-11.92-10.67,63.95,63.95,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67,80.08,80.08,0,0,1,14.08,84.47ZM69,103.09a64,64,0,0,0,11.26,67.58,8,8,0,0,1-11.92,10.67,79.93,79.93,0,0,1,0-106.67A8,8,0,1,1,80.29,85.34,63.77,63.77,0,0,0,69,103.09ZM248,128a119.58,119.58,0,0,1-34.29,84,8,8,0,1,1-11.42-11.2,103.9,103.9,0,0,0,0-145.56A8,8,0,1,1,213.71,44,119.58,119.58,0,0,1,248,128ZM53.71,200.78A8,8,0,1,1,42.29,212a119.87,119.87,0,0,1,0-168,8,8,0,1,1,11.42,11.2,103.9,103.9,0,0,0,0,145.56Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M168,128a40,40,0,1,1-40-40A40,40,0,0,1,168,128Zm40,0a79.74,79.74,0,0,0-20.37-53.33,8,8,0,1,0-11.92,10.67,64,64,0,0,1,0,85.33,8,8,0,0,0,11.92,10.67A79.79,79.79,0,0,0,208,128ZM80.29,85.34A8,8,0,1,0,68.37,74.67a79.94,79.94,0,0,0,0,106.67,8,8,0,0,0,11.92-10.67,63.95,63.95,0,0,1,0-85.33Zm158.28-4A119.48,119.48,0,0,0,213.71,44a8,8,0,1,0-11.42,11.2,103.9,103.9,0,0,1,0,145.56A8,8,0,1,0,213.71,212,120.12,120.12,0,0,0,238.57,81.29ZM32.17,168.48A103.9,103.9,0,0,1,53.71,55.22,8,8,0,1,0,42.29,44a119.87,119.87,0,0,0,0,168,8,8,0,1,0,11.42-11.2A103.61,103.61,0,0,1,32.17,168.48Z\"/></svg>",
    "mais": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,128Zm-88,0a12,12,0,1,1-12-12A12,12,0,0,1,96,128Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24ZM84,140a12,12,0,1,1,12-12A12,12,0,0,1,84,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,172,140Z\"/></svg>",
    "vercomo": "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z\"/></svg>",
    "whatsapp": "<svg class=\"phi phi-wa\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z\"/></svg>"
  };

  /* ------------------------------------------------------------ itens
     Um registro por destino: rota, rótulo completo, rótulo curto (só a
     barra inferior usa — compressão de rótulo, não renomeação), ícone,
     prefixos de rota que o mantêm ativo em telas internas e a regra de
     acesso. */
  const perm = () => B7.Perm;
  const pode = r => !!(perm() && perm().podeRota(r));
  const papel = () => (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || null;
  const ehAdmin = () => papel() === 'admin';

  const ITENS = {
    /* zzz266: Gestão — painel do dono, saúde dos clientes e pedidos (só admin) */
    gestao:      { rota: '#/gestao', rotulo: 'Gestão', curto: 'Gestão', id: 'nav-gestao', base: ['gestao'], pode: () => ehAdmin() },
    painel:      { rota: '#/painel', rotulo: 'Painel', curto: 'Painel', id: 'nav-painel', base: ['painel'],
                   pode: () => !!(perm() && perm().painelElegivel()) },
    /* Central: para o Designer (papel) a rota "#/" é a Central de Design;
       para o videomaker puro "#/" redireciona ao Painel, então some. */
    /* zzz269: o Panorama é a visão de gestão do mês, cliente a cliente —
       para a produção (fora o designer, cujo "#/" é a Central de Design)
       só aparece para quem tem o módulo Clientes */
    central:     { rota: '#/', rotulo: 'Panorama', curto: 'Panorama', base: [''],
                   pode: () => pode('') && !(papel() === 'videomaker' && perm().painelElegivel()) &&
                     (ehAdmin() || papel() === 'designer' || !perm().temModulo || perm().temModulo('clientes')) },
    clientes:    { rota: '#/clientes', rotulo: 'Clientes', curto: 'Clientes', base: ['clientes', 'cliente'], pode: () => pode('clientes') },
    /* zzz274: projetos avulsos (js/projetos.js) — só aparece quando existe algum */
    projetos:    { rota: '#/projetos', rotulo: 'Projetos avulsos', curto: 'Projetos', id: 'nav-projetos', base: ['projetos'],
                   pode: () => pode('projetos') && !!(B7.Projetos && B7.Projetos.temAlgum()) },
    publicacoes: { rota: '#/publicacoes', rotulo: 'Publicações do Dia', curto: 'Publicações', id: 'nav-publicacoes', base: ['publicacoes'], pode: () => pode('publicacoes') },
    aprovacoes:  { rota: '#/aprovacoes', rotulo: 'Aprovações', curto: 'Aprovações', id: 'nav-aprovacoes', base: ['aprovacoes'], pode: () => pode('aprovacoes') },
    kanban:      { rota: '#/kanban', rotulo: 'Produção', curto: 'Produção', id: 'nav-kanban', base: ['kanban'], pode: () => pode('kanban') },
    design:      { rota: '#/design', rotulo: 'Design', curto: 'Design', id: 'nav-design', base: ['design'], pode: () => pode('design') },
    legendas:    { rota: '#/legendas', rotulo: 'Legendas', curto: 'Legendas', id: 'nav-legendas', base: ['legendas'], pode: () => pode('legendas') },
    video:       { rota: '#/video', rotulo: 'Edição de vídeo', curto: 'Vídeo', id: 'nav-video', base: ['video'], pode: () => pode('video') },
    gravacoes:   { rota: '#/gravacoes', rotulo: 'Gravações', curto: 'Gravações', base: ['gravacoes', 'gravacao', 'diaria'], pode: () => pode('gravacoes') },
    calendario:  { rota: '#/calendario', rotulo: 'Calendário', curto: 'Calendário', id: 'nav-calendario', base: ['calendario'], pode: () => pode('calendario') },
    oportunidades: { rota: '#/oportunidades', rotulo: 'Oportunidades', curto: 'Oportunidades', id: 'nav-oportunidades', base: ['oportunidades'], pode: () => pode('oportunidades') },
    /* zzz170: WhatsApp dentro do sistema (js/whatsapp.js) — só equipe */
    whatsapp:    { rota: '#/whatsapp', rotulo: 'WhatsApp', curto: 'WhatsApp', id: 'nav-whatsapp', base: ['whatsapp'],
                   pode: () => !!(B7.Auth && B7.Auth.usuario() && !B7.Auth.ehCliente()) && pode('whatsapp') },
    trends:      { rota: '#/trends', rotulo: 'Trends', curto: 'Trends', id: 'nav-trends', base: ['trends'], pode: () => pode('trends') },
    roteiros:    { rota: '#/roteiros', rotulo: 'Roteiros', curto: 'Roteiros', base: ['roteiros'], pode: () => pode('roteiros') },
    linhas:      { rota: '#/linhas', rotulo: 'Linhas editoriais', curto: 'Linhas', base: ['linhas', 'linha'], pode: () => pode('linhas') },
    semanas:     { rota: '#/semanas', rotulo: 'Status semanal', curto: 'Status', base: ['semanas', 'semana'], pode: () => pode('semanas') },
    arquivados:  { rota: '#/arquivados', rotulo: 'Arquivados', curto: 'Arquivados', base: ['arquivados'], pode: () => pode('arquivados') },
    /* zzz297: só aparece com o modo entretenimento ligado (js/console.js) */
    jogos:       { rota: '#/jogos', rotulo: 'Jogos', curto: 'Jogos', base: ['jogos'], pode: () => !!(B7.Console && B7.Console.ligado()) },
    /* 4.36.0: painel do site da agência (js/site-painel.js) — só admin */
    site:        { rota: '#/site', rotulo: 'Site', curto: 'Site', base: ['site'], pode: () => ehAdmin() },
    lixeira:     { rota: '#/lixeira', rotulo: 'Lixeira', curto: 'Lixeira', base: ['lixeira'], pode: () => pode('lixeira') },
    usuarios:    { rota: '#/usuarios', rotulo: 'Usuários e acessos', curto: 'Usuários', base: ['usuarios'], pode: () => pode('usuarios') },
    /* Configurações na lateral só para o admin (as preferências de todo
       mundo estão no menu da conta); Atalhos só faz sentido com teclado */
    config:      { rota: '#/config', rotulo: 'Configurações', curto: 'Configurações', id: 'nav-config', base: ['config'], pode: () => ehAdmin() && pode('config') },
    atalhos:     { acao: 'atalhos', rotulo: 'Atalhos', curto: 'Atalhos', id: 'nav-atalhos', base: [], pode: () => ehAdmin() },
    /* zzz284: só super admin / admin supremo — o botão nem aparece para os outros */
    aovivo:      { acao: 'aovivo', rotulo: 'Equipe ao vivo', curto: 'Ao vivo', id: 'nav-aovivo', base: [], pode: () => !!(B7.Auth && B7.Auth.superadmin && B7.Auth.superadmin()) }
  };

  /* --------------------------------------------------- prioridades
     O que cada função operacional faz no dia a dia. Só PRIORIZA: um item
     só aparece se ITENS[x].pode() deixar. */
  const MEU_TRABALHO = {
    coordenador: ['linhas', 'publicacoes', 'roteiros', 'gravacoes', 'aprovacoes'],
    videomaker:  ['video', 'legendas', 'gravacoes', 'roteiros', 'calendario'],
    designer:    ['design', 'linhas']
  };
  /* barra inferior: frequência > completude (máx. 3 além da casa) */
  const INFERIOR = {
    coordenador: ['publicacoes', 'linhas', 'aprovacoes', 'gravacoes'],
    videomaker:  ['video', 'gravacoes', 'calendario', 'roteiros'],
    designer:    ['design', 'linhas', 'calendario'],
    gestao:      ['kanban', 'clientes', 'gravacoes', 'publicacoes']   /* sem função operacional (ex.: admin puro) */
  };
  const OPERACAO = ['clientes', 'projetos', 'publicacoes', 'aprovacoes', 'kanban', 'design', 'video', 'legendas', 'gravacoes', 'calendario', 'oportunidades',
                    'roteiros', 'trends', 'linhas', 'semanas'];
  /* Atalhos saiu da barra permanente: continua no menu da conta e na tecla "?" */
  /* zzz200: Usuários e acessos saiu da lateral e do "Mais": fica em
     Configurações → Admin → Pessoas e no menu da conta */
  /* zzz289: "Equipe ao vivo" saiu da barra — virou parte do "Visualizar como" */
  const FERRAMENTAS = ['site', 'jogos', 'arquivados', 'lixeira', 'config'];

  function rotuloDe(id) {
    if (id === 'central' && papel() === 'designer') return 'Central de Design';
    /* zzz269: para a produção, os nomes falam do trabalho, não da gestão */
    if (!ehAdmin() && PRODUCAO[id]) return PRODUCAO[id];
    return ITENS[id].rotulo;
  }
  const PRODUCAO = { central: 'Visão do mês' };
  function curtoDe(id) {
    if (id === 'central' && papel() === 'designer') return 'Central';
    return ITENS[id].curto;
  }
  const permitido = id => { try { return !!ITENS[id] && ITENS[id].pode(); } catch (e) { return false; } };

  /* round-robin entre as funções, na ordem fixa delas: quem tem duas
     funções recebe o 1º de cada antes do 2º de qualquer uma — nenhuma
     função "engole" a outra e o resultado é sempre o mesmo */
  function intercalar(listas) {
    const out = [];
    const max = Math.max(0, ...listas.map(l => l.length));
    for (let i = 0; i < max; i++) listas.forEach(l => { if (l[i] && !out.includes(l[i])) out.push(l[i]); });
    return out;
  }

  /* ================================================ RESOLVEDOR ÚNICO */
  function resolver() {
    if (!B7.Auth || !B7.Auth.usuario() || !perm()) return null;
    const funcoes = perm().funcoesOperacionais ? perm().funcoesOperacionais() : [];
    /* zzz119 — "Principal é só o meu Painel" (Kevin). O Panorama saiu do
       grupo Principal e abre a Operação. Exceções, para ninguém ficar sem
       casa: o designer (para ele "#/" é a Central de Design, a tela de
       trabalho dele) e quem não tem Painel (aí o Panorama é a casa). */
    const temPainel = permitido('painel');
    const centralEhCasa = papel() === 'designer' || !temPainel;
    const principal = (centralEhCasa ? ['painel', 'central', 'gestao', 'whatsapp'] : ['painel', 'gestao', 'whatsapp']).filter(permitido);
    const usados = new Set(principal);
    const trabalho = intercalar(funcoes.map(f => MEU_TRABALHO[f] || [])).filter(id => permitido(id) && !usados.has(id));
    trabalho.forEach(id => usados.add(id));
    const operacao = (centralEhCasa ? [] : ['central']).concat(OPERACAO).filter(id => permitido(id) && !usados.has(id));
    operacao.forEach(id => usados.add(id));
    const ferramentas = FERRAMENTAS.filter(permitido);

    /* barra inferior: a casa (Painel se houver; senão a Central) + até 3 */
    const casa = principal[0] || null;
    const prioridade = funcoes.length ? intercalar(funcoes.map(f => INFERIOR[f] || [])) : INFERIOR.gestao;
    const inferior = (casa ? [casa] : []);
    prioridade.concat(trabalho, operacao).forEach(id => {
      if (inferior.length < 4 && !inferior.includes(id) && permitido(id)) inferior.push(id);
    });
    return { funcoes, principal, trabalho, operacao, ferramentas, inferior, casa };
  }

  /* -------------------------------------------------- rota → item */
  function baseAtual() {
    return String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
  }
  function itemDaRota(base) {
    const b = base === undefined ? baseAtual() : base;
    /* 4.17.1: banco de roteiros (#/gravacao/banco-…) é da área Roteiros */
    if (base === undefined && /^#\/gravacao\/banco-/.test(location.hash || '')) return 'roteiros';
    /* #/ do designer (Central de Design) e do resto (Central B7) */
    for (const id of Object.keys(ITENS)) if ((ITENS[id].base || []).includes(b)) return id;
    return null;
  }

  /* ============================================== BARRA LATERAL */
  function linkLateral(id) {
    const it = ITENS[id], rot = rotuloDe(id);
    const attrs = (it.rota ? ' data-ir="' + it.rota + '"' : '') + (it.id ? ' id="' + it.id + '"' : '') +
      ' data-nav="' + id + '" aria-label="' + esc(rot) + '"';
    return '<a' + attrs + (it.rota ? ' href="' + it.rota + '"' : ' href="#" role="button"') + '>' + IC[id] + '<span>' + esc(rot) + '</span></a>';
  }
  /* ============================================ SANFONA (desktop)
     Os mesmos quatro grupos de sempre (Principal · Meu trabalho ·
     Operação · Mais ferramentas), agora em sanfona: UM grupo aberto por
     vez. Quem abre: 1) o grupo da rota atual; 2) o último aberto à mão
     (localStorage, só quando a rota não resolve); 3) Meu trabalho para
     quem tem função operacional, Principal para os demais.
     Fechar à mão o grupo da rota atual deixa um ponto discreto nele.
     Recolhida (ou tablet em trilho): em vez de uma coluna com todos os
     ícones, um ícone por GRUPO, que abre um painel flutuante ao lado. */
  const SVGN = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC_GRUPO = {
    principal: "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z\"/></svg>",
    trabalho: "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M152,112a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,112Zm80-40V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V72A16,16,0,0,1,40,56H80V48a24,24,0,0,1,24-24h48a24,24,0,0,1,24,24v8h40A16,16,0,0,1,232,72ZM96,56h64V48a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8Zm120,57.61V72H40v41.61A184,184,0,0,0,128,136,184,184,0,0,0,216,113.61Z\"/></svg>",
    operacao: "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M220,169.09l-92,53.65L36,169.09A8,8,0,0,0,28,182.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,169.09Z\"/><path d=\"M220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09Z\"/><path d=\"M28,86.91l96,56a8,8,0,0,0,8.06,0l96-56a8,8,0,0,0,0-13.82l-96-56a8,8,0,0,0-8.06,0l-96,56a8,8,0,0,0,0,13.82Z\"/></svg>",
    ferramentas: "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M40,88H73a32,32,0,0,0,62,0h81a8,8,0,0,0,0-16H135a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16Zm64-24A16,16,0,1,1,88,80,16,16,0,0,1,104,64ZM216,168H199a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16h97a32,32,0,0,0,62,0h17a8,8,0,0,0,0-16Zm-48,24a16,16,0,1,1,16-16A16,16,0,0,1,168,192Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M32,80a8,8,0,0,1,8-8H77.17a28,28,0,0,1,53.66,0H216a8,8,0,0,1,0,16H130.83a28,28,0,0,1-53.66,0H40A8,8,0,0,1,32,80Zm184,88H194.83a28,28,0,0,0-53.66,0H40a8,8,0,0,0,0,16H141.17a28,28,0,0,0,53.66,0H216a8,8,0,0,0,0-16Z\"/></svg>"
  };
  const CHEVRON = '<svg class="ng-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHAVE_GRUPO = 'b7-nav-grupo';
  let G = { grupos: [], aberto: null, rota: null, funcoes: [] };

  function gruposDe(r) {
    /* zzz269: o administrador vê a casa como gestão; a equipe, como produção */
    const adm = ehAdmin();
    return [
      { id: 'principal', rotulo: adm ? 'Principal' : 'Meu dia', ids: r.principal },
      { id: 'trabalho', rotulo: 'Meu trabalho', ids: r.trabalho },
      { id: 'operacao', rotulo: adm ? (r.trabalho.length ? 'Operação' : 'Produção') : (r.trabalho.length ? 'Produção da equipe' : 'Produção'), ids: r.operacao },
      { id: 'ferramentas', rotulo: adm ? 'Mais ferramentas' : 'Mais', ids: r.ferramentas }
    ].filter(g => g.ids.length);            /* grupo sem item autorizado não existe */
  }
  function grupoHTML(g) {
    return '<section class="ng" data-grupo="' + g.id + '">' +
      '<button type="button" class="ng-cab" id="ng-cab-' + g.id + '" aria-expanded="false" aria-controls="ng-painel-' + g.id + '">' +
        '<span class="ng-tit">' + esc(g.rotulo) + '</span>' +
        '<i class="ng-ponto" aria-hidden="true"></i><span class="ng-leitor"></span>' + CHEVRON + '</button>' +
      '<div class="ng-painel" id="ng-painel-' + g.id + '" role="region" aria-labelledby="ng-cab-' + g.id + '">' +
        '<div class="ng-in"><div class="ng-lista">' + g.ids.map(linkLateral).join('') + '</div></div></div>' +
    '</section>';
  }
  function trilhoHTML() {
    return '<div class="nav-trilho" role="toolbar" aria-orientation="vertical" aria-label="Grupos de navegação">' +
      G.grupos.map(g => '<button type="button" class="ntr-bt" data-grupo-bt="' + g.id + '" aria-label="' + esc(g.rotulo) + '" aria-haspopup="true" aria-expanded="false">' +
        IC_GRUPO[g.id] + '<i class="ntr-ponto" aria-hidden="true"></i></button>').join('') + '</div>';
  }

  function montarLateral() {
    const nav = document.querySelector('.nav');
    const r = resolver();
    if (!nav || !r) return false;
    fecharFlyout(true);
    G = { grupos: gruposDe(r), aberto: null, rota: null, funcoes: r.funcoes };
    nav.innerHTML = '<div class="nav-acordeao">' + G.grupos.map(grupoHTML).join('') + '</div>' + trilhoHTML();
    nav.dataset.shell = 'interno';
    /* zzz115 — todos os grupos ficam abertos ao mesmo tempo (antes só um
       abria por vez e a barra ficava quase vazia). Cada grupo pode ser
       recolhido sozinho pelo título; a escolha fica guardada. */
    nav.classList.add('multi');
    const fechados = lerFechados();
    nav.querySelectorAll('.ng').forEach(sec => sec.classList.toggle('fechado', fechados.includes(sec.dataset.grupo)));
    nav.querySelectorAll('.ng-cab').forEach(b => b.onclick = () => {
      const sec = b.closest('.ng');
      sec.classList.toggle('fechado');
      try { localStorage.setItem(CHAVE_FECHADOS, JSON.stringify([...nav.querySelectorAll('.ng.fechado')].map(s => s.dataset.grupo))); } catch (e) {}
      ariaMulti(); marcarGrupoAtivo();
    });
    /* zzz116: recolhida, a barra mostra os ícones de cada destino (não
       mais um botão por grupo); o nome aparece numa dica ao passar */
    /* zzz118: ordem de cada peça de cima para baixo, para a cascata */
    nav.querySelectorAll('.ng-cab, .ng a').forEach((el, i) => el.style.setProperty('--n', i));
    nav.querySelectorAll('.ng a').forEach(a => {
      const dica = () => { if (document.body.classList.contains('recolhida')) B7.UI.dica(a, a.getAttribute('aria-label') || a.textContent.trim()); };
      a.addEventListener('mouseenter', dica);
      a.addEventListener('focus', dica);
      a.addEventListener('mouseleave', () => B7.UI.esconderDica());
      a.addEventListener('blur', () => B7.UI.esconderDica());
    });
    nav.querySelectorAll('.ntr-bt').forEach(b => {
      b.onclick = ev => alternarFlyout(b.dataset.grupoBt, b, ev.detail === 0);
      const dica = () => { if (!flyout || flyout.dataset.grupo !== b.dataset.grupoBt) B7.UI.dica(b, b.getAttribute('aria-label')); };
      b.addEventListener('mouseenter', dica);
      b.addEventListener('focus', dica);
      b.addEventListener('mouseleave', () => B7.UI.esconderDica());
      b.addEventListener('blur', () => B7.UI.esconderDica());
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const bts = [...nav.querySelectorAll('.ntr-bt')], i = bts.indexOf(b);
        (bts[(i + (e.key === 'ArrowDown' ? 1 : bts.length - 1)) % bts.length]).focus();
      });
    });
    /* zzz286: "Equipe ao vivo" é item de ação (href="#"), não navega — abre o painel.
       (antes o onclick estava em ligarDicas(), que não é chamada, e o link caía no Panorama) */
    nav.querySelectorAll('a[data-nav]').forEach(a => {
      if (ITENS[a.dataset.nav] && ITENS[a.dataset.nav].acao === 'aovivo')
        a.onclick = e => { e.preventDefault(); B7.AoVivo && B7.AoVivo.abrir(); };
    });
    sincronizar(true);
    marcarAtivo();
    return true;
  }

  /* qual grupo contém o destino atual? (o módulo marca .on; antes disso,
     a rota decide) */
  function grupoAtivo() {
    const on = document.querySelector('.nav .ng a.on');
    const id = (on && on.dataset.nav) || itemDaRota();
    const g = G.grupos.find(x => x.ids.includes(id));
    return g ? g.id : null;
  }
  function grupoPadrao() {
    let lembrado = null;
    try { lembrado = localStorage.getItem(CHAVE_GRUPO); } catch (e) {}
    const existe = id => G.grupos.some(g => g.id === id);
    if (lembrado && existe(lembrado)) return lembrado;
    if (G.funcoes.length && existe('trabalho')) return 'trabalho';
    return existe('principal') ? 'principal' : (G.grupos[0] && G.grupos[0].id) || null;
  }
  const CHAVE_FECHADOS = 'b7-nav-fechados';
  function lerFechados() {
    try { const v = JSON.parse(localStorage.getItem(CHAVE_FECHADOS) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  /* com todos abertos, "expandido" é simplesmente "não recolhido" */
  function ariaMulti() {
    const nav = document.querySelector('.nav.multi'); if (!nav) return;
    nav.querySelectorAll('.ng').forEach(sec => {
      const cab = sec.querySelector('.ng-cab'); if (cab) cab.setAttribute('aria-expanded', String(!sec.classList.contains('fechado')));
    });
  }
  function abrirGrupo(id, manual) {
    G.aberto = id;
    /* a rota entrou num grupo que a pessoa tinha recolhido: ele abre,
       para a tela atual nunca ficar escondida */
    if (id && !manual) {
      const alvo = document.querySelector('.nav.multi .ng[data-grupo="' + id + '"]');
      if (alvo) alvo.classList.remove('fechado');
    }
    document.querySelectorAll('.nav .ng').forEach(sec => {
      const ab = sec.dataset.grupo === id;
      sec.classList.toggle('aberto', ab);
      const cab = sec.querySelector('.ng-cab');
      cab.setAttribute('aria-expanded', String(ab));
    });
    if (manual) { try { if (id) localStorage.setItem(CHAVE_GRUPO, id); } catch (e) {} }
    ariaMulti();
    marcarGrupoAtivo();
  }
  /* ponto discreto no grupo (fechado) que contém a tela atual, e o
     mesmo sinal no ícone do grupo quando a barra está recolhida */
  function marcarGrupoAtivo() {
    const ativo = grupoAtivo();
    document.querySelectorAll('.nav .ng').forEach(sec => {
      const tem = sec.dataset.grupo === ativo;
      sec.classList.toggle('tem-ativo', tem);
      const leitor = sec.querySelector('.ng-leitor');
      const escondido = sec.closest('.nav.multi') ? sec.classList.contains('fechado') : !sec.classList.contains('aberto');
      if (leitor) leitor.textContent = tem && escondido ? ' (tela atual está aqui)' : '';
    });
    document.querySelectorAll('.nav .ntr-bt').forEach(b => b.classList.toggle('tem-ativo', b.dataset.grupoBt === ativo));
    document.querySelectorAll('.nav .ng a').forEach(a => { if (a.classList.contains('on')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  /* chamado pelo marcarNav dos módulos e na troca de rota: a rota tem
     prioridade — se ela mudou e mora em outro grupo, esse grupo abre */
  /* B7.Perm.aplicarNavegacao ainda pode retirar itens do DOM depois da
     montagem: o modelo acompanha, e grupo que ficar vazio some inteiro */
  function podarVazios() {
    const nav = document.querySelector('.nav'); if (!nav) return;
    G.grupos = G.grupos.filter(g => {
      g.ids = g.ids.filter(id => nav.querySelector('.ng a[data-nav="' + id + '"]'));
      if (g.ids.length) return true;
      const sec = nav.querySelector('.ng[data-grupo="' + g.id + '"]'); if (sec) sec.remove();
      const bt = nav.querySelector('[data-grupo-bt="' + g.id + '"]'); if (bt) bt.remove();
      return false;
    });
  }
  function sincronizar(inicial) {
    podarVazios();
    if (!G.grupos.length) return;
    const rota = String(location.hash || '#/').split('?')[0];
    const mudou = rota !== G.rota;
    G.rota = rota;
    const ativo = grupoAtivo();
    if (inicial) abrirGrupo(ativo || grupoPadrao(), false);
    else if (mudou && ativo && ativo !== G.aberto) abrirGrupo(ativo, false);
    else marcarGrupoAtivo();
    if (mudou && !inicial) {
      /* item ativo fora da área visível da barra: traz para perto, sem
         rolar a página e só quando precisa */
      setTimeout(() => requestAnimationFrame(() => {   /* v3.1.1: mede junto com o quadro */
        const nav = document.querySelector('.nav'), a = nav && nav.querySelector('.ng.aberto a.on');
        if (!a || document.body.classList.contains('recolhida')) return;
        const rn = nav.getBoundingClientRect(), ra = a.getBoundingClientRect();
        if (ra.top < rn.top || ra.bottom > rn.bottom) nav.scrollTop += ra.top < rn.top ? ra.top - rn.top - 8 : ra.bottom - rn.bottom + 8;
      }), 200);
    }
  }

  /* ---------------------------------------- painel flutuante (recolhida)
     Vive no <body> (position:fixed): não entra na caixa de rolagem da
     barra, então não cria rolagem lateral. Abre por clique/Enter/Espaço;
     fecha ao navegar, clicar fora, Esc ou abrir outro grupo. */
  let flyout = null, flyoutBt = null;
  function alternarFlyout(id, bt, peloTeclado) {
    if (flyout && flyout.dataset.grupo === id) return fecharFlyout();
    abrirFlyout(id, bt, peloTeclado);
  }
  function abrirFlyout(id, bt, peloTeclado) {
    fecharFlyout(true);
    const g = G.grupos.find(x => x.id === id); if (!g) return;
    B7.UI.esconderDica();
    const el = document.createElement('div');
    el.className = 'nav-flyout';
    el.id = 'nav-flyout';
    el.dataset.grupo = id;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', g.rotulo);
    const ativoId = (document.querySelector('.nav .ng a.on') || {}).dataset;
    el.innerHTML = '<div class="nf-tit">' + esc(g.rotulo) + '</div>' + g.ids.map(i => {
      const it = ITENS[i], on = ativoId && ativoId.nav === i;
      return '<a class="nf-item' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') + (it.rota ? ' href="' + it.rota + '" data-ir="' + it.rota + '"' : ' href="#" role="button"') + ' data-nf="' + i + '">' +
        IC[i] + '<span>' + esc(rotuloDe(i)) + '</span></a>';
    }).join('');
    document.body.appendChild(el);
    const rl = document.querySelector('.lateral').getBoundingClientRect(), rb = bt.getBoundingClientRect();
    const alt = el.offsetHeight;
    el.style.left = Math.round(rl.right + 8) + 'px';
    el.style.top = Math.round(Math.max(8, Math.min(rb.top - 6, window.innerHeight - alt - 8))) + 'px';
    requestAnimationFrame(() => el.classList.add('aberto'));
    flyout = el; flyoutBt = bt;
    bt.setAttribute('aria-expanded', 'true');
    bt.setAttribute('aria-controls', 'nav-flyout');
    bt.classList.add('aberto');
    el.querySelectorAll('[data-nf]').forEach(a => {
      if (ITENS[a.dataset.nf].acao === 'atalhos') a.onclick = e => { e.preventDefault(); fecharFlyout(); B7.UI.atalhos(); };
      if (ITENS[a.dataset.nf].acao === 'aovivo') a.onclick = e => { e.preventDefault(); fecharFlyout(); B7.AoVivo && B7.AoVivo.abrir(); };
    });
    el.addEventListener('keydown', e => {
      const links = [...el.querySelectorAll('a')], i = links.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); const b = flyoutBt; fecharFlyout(); if (b) b.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    if (peloTeclado) { const a = el.querySelector('a.on') || el.querySelector('a'); if (a) a.focus(); }
  }
  function fecharFlyout(imediato) {
    if (!flyout) return;
    const el = flyout, bt = flyoutBt;
    flyout = null; flyoutBt = null;
    if (bt) { bt.setAttribute('aria-expanded', 'false'); bt.classList.remove('aberto'); }
    if (imediato) { el.remove(); return; }
    el.classList.remove('aberto');
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 170);
  }
  document.addEventListener('mousedown', e => {
    if (flyout && !e.target.closest('.nav-flyout') && !e.target.closest('.ntr-bt')) fecharFlyout();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && flyout && !flyout.contains(document.activeElement)) fecharFlyout(); });
  window.addEventListener('resize', () => fecharFlyout(true));
  window.addEventListener('hashchange', () => { fecharFlyout(); setTimeout(() => sincronizar(false), 0); });

  /* Recolhida: o nome do item vira dica flutuante (B7.UI.dica, fixa no
     documento — não alarga o contêiner de rolagem da barra).

     zzz48: esta função não é chamada, e é de propósito. Quando a barra
     recolhe, styles/nav.css esconde o acordeão inteiro
     (`body.recolhida .nav[data-shell="interno"] .nav-acordeao{display:none}`)
     e quem aparece é o trilho, cujos botões já ganham dica em
     montarLateral. Fica aqui porque volta a servir no dia em que a barra
     recolhida mostrar os itens em vez dos grupos. */
  function ligarDicas(nav) {
    nav.querySelectorAll('a').forEach(a => {
      const tx = () => (a.querySelector('span') || {}).textContent || '';
      const mostrar = () => { if (document.body.classList.contains('recolhida')) B7.UI.dica(a, tx()); };
      a.addEventListener('mouseenter', mostrar);
      a.addEventListener('focus', mostrar);
      a.addEventListener('mouseleave', () => B7.UI.esconderDica());
      a.addEventListener('blur', () => B7.UI.esconderDica());
    });
  }

  /* =========================================== CELULAR: BARRA INFERIOR */
  function montarInferior() {
    let barra = document.getElementById('nav-inferior');
    const r = resolver();
    if (!r || document.body.dataset.shell !== 'interno') { if (barra) barra.remove(); return; }
    if (!barra) {
      barra = document.createElement('nav');
      barra.id = 'nav-inferior';
      barra.className = 'nav-inferior';
      barra.setAttribute('aria-label', 'Navegação principal');
      document.body.appendChild(barra);
    }
    barra.innerHTML = '<span class="ni-luz" aria-hidden="true"></span><ul>' + r.inferior.map(id =>
      '<li><a href="' + ITENS[id].rota + '" data-inf="' + id + '" aria-label="' + esc(rotuloDe(id)) + '">' +
        '<span class="ni-ic" aria-hidden="true">' + IC[id] + '</span><span class="ni-tx">' + esc(curtoDe(id)) + '</span></a></li>').join('') +
      '<li><button type="button" data-inf="mais" aria-haspopup="dialog" aria-label="Mais destinos">' +
        '<span class="ni-ic" aria-hidden="true">' + IC.mais + '</span><span class="ni-tx">Mais</span></button></li></ul>';
    barra.querySelector('[data-inf="mais"]').onclick = abrirMais;
    marcarAtivo();
    ligarDeslizeAbas();
    if (B7.Vidro) B7.Vidro.aplicar(barra);
  }

  /* zzz303: arrastar a tela para o lado vai para a aba vizinha da barra de
     baixo (Painel ↔ Vídeo ↔ Design…), como num app. Não briga com o que já
     arrasta de lado: carrosséis e faixas que rolam, o Calendário, as
     Publicações e o Kanban (que têm o próprio gesto), campos de texto,
     folhas abertas e o "voltar" da borda da tela. */
  const celular = () => window.matchMedia('(max-width: 760px)').matches;
  function ligarDeslizeAbas() {
    const p = document.getElementById('painel-dashboard');
    if (!p || p._deslize || !B7.Movimento || !B7.Movimento.deslizar) return;
    const abas = () => { const r = resolver(); return r ? r.inferior : []; };
    B7.Movimento.deslizar(p, () => p.querySelector(':scope > .conteudo') || p.firstElementChild, dir => {
      const l = abas(), i = l.indexOf(itemDaRota()), j = i + dir;
      if (i < 0 || j < 0 || j >= l.length || !ITENS[l[j]] || !ITENS[l[j]].rota) return false;
      /* data-vindo: a aba nova entra do lado certo, sem o morph com desfoque
         da troca de módulo (js/app.js) e sem as contagens de "estreia" */
      document.documentElement.dataset.vindo = dir > 0 ? 'dir' : 'esq';
      clearTimeout(ligarDeslizeAbas._t);
      ligarDeslizeAbas._t = setTimeout(() => { delete document.documentElement.dataset.vindo; }, 1200);
      location.hash = ITENS[l[j]].rota;
      return true;
    }, {
      semBorda: true, livre: true,
      ignorar: t => {
        if (!celular() || document.body.dataset.shell !== 'interno') return true;
        if (document.querySelector('.fundo-modal, .ni-folha.aberta')) return true;
        if (abas().indexOf(itemDaRota()) < 0) return true;
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) return true;
        /* um módulo com o próprio arrastar de lado entre o dedo e a tela */
        for (let n = t; n && n !== p; n = n.parentElement) if (n._deslize || (n.dataset && 'semDeslize' in n.dataset)) return true;
        return !!(t.closest && t.closest('.kb-quadro, .kanban, [draggable="true"], .ed-linha-tempo, canvas, video'));
      }
    });
  }

  /* ------------------------------------------------ folha "Mais"
     zzz243 — quarta versão (Kevin: "faltou a identidade da B7"; a lista
     do iOS com ícones de arco-íris saiu). Topo no degradê da marca com o
     símbolo, saudação e o "Meu dia"; busca; "Usados por você" (os que a
     pessoa mais abre por aqui); grupos com título visível e ícones que
     percorrem o degradê da B7 de cima para baixo. */
  let folhaMais = null;
  const USO_MAIS = 'b7-mais-uso';
  const IC_EXTRA = {
    ajuda: "<svg class=\"phi phi-r\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/></svg><svg class=\"phi phi-f\" viewBox=\"0 0 256 256\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,125.38,154.24,139.93,136,143.28Z\"/></svg>"
  };
  function lerUso() { try { return JSON.parse(localStorage.getItem(USO_MAIS) || '{}') || {}; } catch (e) { return {}; } }
  function contarUso(id) {
    try { const u = lerUso(); u[id] = (u[id] || 0) + 1; localStorage.setItem(USO_MAIS, JSON.stringify(u)); } catch (e) {}
  }
  const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function abrirMais() {
    const r = resolver(); if (!r) return;
    const ativo = itemDaRota();
    const fora = id => !r.inferior.includes(id);
    const ehCli = !!(B7.Auth && B7.Auth.ehCliente && B7.Auth.ehCliente());
    /* destinos extras que não moram na lateral */
    const EXTRA = {
      ajuda: { rota: '#/ajuda', rotulo: 'Ajuda', ic: IC_EXTRA.ajuda },
      prefs: { rota: '#/config', rotulo: 'Configurações', ic: IC.config }
    };
    const dados = id => ITENS[id] ? { rota: ITENS[id].rota, rotulo: rotuloDe(id), ic: IC[id], acao: ITENS[id].acao } : EXTRA[id];
    const naRota = id => { const d = dados(id); return d && d.rota && (location.hash || '#/').split('?')[0] === d.rota; };
    const item = (id, extra) => {
      const d = dados(id), on = ativo === id || (EXTRA[id] && naRota(id));
      return '<a class="nm-item' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') +
        (d.rota ? ' href="' + d.rota + '"' : ' href="#" role="button"') + ' data-mais="' + id + '"' + (extra || '') +
        ' data-busca="' + esc(semAcento(d.rotulo)) + '">' +
        '<span class="nm-ic" aria-hidden="true">' + d.ic + '</span><span class="nm-tx">' + esc(d.rotulo) + '</span>' +
        (on ? '<span class="nm-aqui">Você está aqui</span>' : '') + '</a>';
    };
    const secao = (titulo, ids, extraHtml) => (ids.length || extraHtml) ? '<section class="nm-secao"><h4>' + titulo + '</h4><div class="nm-grade">' +
      ids.map(id => item(id)).join('') + (extraHtml || '') + '</div></section>' : '';
    const gestao = r.ferramentas.filter(id => ['usuarios', 'config'].includes(id));
    const ferr = r.ferramentas.filter(id => !gestao.includes(id) && id !== 'atalhos');
    const podeVerComo = ehAdmin() && B7.PreviaUsuario && B7.PreviaUsuario.abrirSeletor &&
      !(B7.Auth && B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro());
    /* quem não é administrador também chega às Configurações por aqui */
    const extrasFerr = (!gestao.includes('config') && !ehCli ? ['prefs'] : []).concat(B7.Ajuda ? ['ajuda'] : []);
    const html =
      /* Principal e Meu trabalho num grupo só: quase tudo deles já está na barra */
      secao('Para você', r.principal.concat(r.trabalho.filter(id => !r.principal.includes(id))).filter(fora)) +
      secao(r.trabalho.length ? 'Operação' : 'Produção', r.operacao.filter(fora)) +
      secao('Gestão', gestao) +
      secao('Ferramentas', ferr.concat(extrasFerr),
        podeVerComo ? '<a class="nm-item" href="#" role="button" data-vercomo data-busca="visualizar como outra pessoa"><span class="nm-ic" aria-hidden="true">' + IC.vercomo + '</span><span class="nm-tx">Visualizar como…</span></a>' : '');
    /* usados por você: até 4, só quem não está na barra de baixo */
    const todos = [].concat(r.principal, r.trabalho, r.operacao, r.ferramentas).filter(fora);
    const uso = lerUso();
    const usados = Object.keys(uso).filter(id => todos.includes(id) && uso[id] >= 2 && id !== 'atalhos')
      .sort((a, b) => uso[b] - uso[a]).slice(0, 4);
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const primeiro = String((u && (u.nome || u.username)) || '').trim().split(/\s+/)[0];
    const h = new Date().getHours();
    const sauda = (h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (primeiro ? ', ' + esc(primeiro) : '');
    let dataTx = '';
    try { dataTx = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); dataTx = dataTx.charAt(0).toUpperCase() + dataTx.slice(1); } catch (e) {}
    const temHoje = B7.Hoje && !ehCli;
    const bt = document.querySelector('#nav-inferior [data-inf="mais"]');
    if (bt) bt.setAttribute('aria-expanded', 'true');
    folhaMais = B7.UI.modal(
      '<header class="nm-topo">' +
        '<span class="nm-topo-marca" aria-hidden="true"></span>' +
        '<div class="nm-topo-tx"><small>' + esc(dataTx) + '</small><h3>' + sauda + '</h3></div>' +
        '<button type="button" class="nm-fechar" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        (temHoje ? '<button type="button" class="nm-hoje" data-hoje><span class="nm-hoje-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
          '<span><b>Meu dia em 30 segundos</b><small>O que entra no ar, gravações e atrasos</small></span></button>' : '') +
      '</header>' +
      '<label class="nm-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>' +
        '<input type="search" placeholder="Procurar uma tela" autocomplete="off" enterkeyhint="go" aria-label="Procurar uma tela"></label>' +
      '<nav class="nm-corpo" aria-label="Mais destinos">' +
        (usados.length ? '<section class="nm-usados"><h4>Usados por você</h4><div class="nm-usados-fila">' +
          usados.map(id => '<a class="nm-chip" href="' + ITENS[id].rota + '" data-mais="' + id + '"><span class="nm-ic" aria-hidden="true">' + IC[id] + '</span>' + esc(curtoDe(id)) + '</a>').join('') +
          '</div></section>' : '') +
        (html || '<p class="nm-vazio">Nada além da barra.</p>') +
        '<p class="nm-vazio nm-sem" hidden>Nenhuma tela com esse nome.</p>' +
      '</nav>',
      { classe: 'tp-folha nm-folha', aoFechar: () => { folhaMais = null; if (bt) bt.setAttribute('aria-expanded', 'false'); } });
    /* posição no degradê da marca (0 = violeta, 1 = magenta) e a cascata */
    const linhas = [...folhaMais.querySelectorAll('.nm-secao .nm-item')];
    linhas.forEach((a, i) => {
      a.style.setProperty('--i', Math.min(i, 16));
      a.style.setProperty('--k', linhas.length > 1 ? (i / (linhas.length - 1)).toFixed(3) : '0');
    });
    folhaMais.querySelectorAll('[data-mais]').forEach(a => a.onclick = e => {
      const id = a.dataset.mais, d = dados(id);
      e.preventDefault();
      if (ITENS[id]) contarUso(id);
      const m = folhaMais; if (m) m.fechar();
      if (d.acao === 'atalhos') return B7.UI.atalhos();
      if (d.acao === 'aovivo') return B7.AoVivo && B7.AoVivo.abrir();
      location.hash = d.rota;
    });
    const hj = folhaMais.querySelector('[data-hoje]');
    if (hj) hj.onclick = () => { const m = folhaMais; if (m) m.fechar(); setTimeout(() => B7.Hoje.abrir(), 120); };
    const vc = folhaMais.querySelector('[data-vercomo]');
    if (vc) vc.onclick = e => { e.preventDefault(); const m = folhaMais; if (m) m.fechar(); B7.PreviaUsuario.abrirSeletor(); };
    /* busca: filtra as linhas, some com grupos vazios; Enter abre a primeira */
    const caixa = folhaMais.querySelector('.modal');
    const q = folhaMais.querySelector('.nm-busca input'), corpo = folhaMais.querySelector('.nm-corpo');
    if (q) {
      q.oninput = () => {
        const t = semAcento(q.value).trim();
        /* a folha não encolhe enquanto filtra (nada pula embaixo do dedo) */
        if (caixa && !caixa.style.height) caixa.style.height = caixa.offsetHeight + 'px';
        corpo.classList.toggle('nm-procurando', !!t);
        let algum = false;
        corpo.querySelectorAll('.nm-secao').forEach(sec => {
          let n = 0;
          sec.querySelectorAll('.nm-item').forEach(a => { const ok = !t || a.dataset.busca.includes(t); a.hidden = !ok; if (ok) n++; });
          sec.hidden = !n; if (n) algum = true;
        });
        const sem = corpo.querySelector('.nm-sem'); if (sem) sem.hidden = algum || !t;
      };
      q.onkeydown = e => {
        if (e.key !== 'Enter') return;
        const prim = corpo.querySelector('.nm-secao:not([hidden]) .nm-item:not([hidden])');
        if (prim) { e.preventDefault(); prim.click(); }
      };
    }
    /* foco no próprio diálogo (leitor de tela anuncia; Tab entra na
       grade) — sem anel de foco pintado num item ao tocar e sem abrir o
       teclado sozinho */
    if (caixa) { caixa.tabIndex = -1; caixa.setAttribute('aria-label', 'Mais destinos'); caixa.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------ estado ativo
     Lateral: o módulo marca pelo próprio marcarNav (rota exata); aqui só
     cobrimos o que ninguém marcou. Barra inferior: pelo prefixo da rota —
     detalhe de demanda de vídeo deixa "Vídeo" aceso; rota que só existe
     no "Mais" acende o "Mais". */
  function marcarAtivo() {
    const barra = document.getElementById('nav-inferior');
    if (!barra) return;
    const id = itemDaRota();
    const naBarra = !!barra.querySelector('[data-inf="' + id + '"]');
    barra.querySelectorAll('[data-inf]').forEach(el => {
      const on = naBarra ? el.dataset.inf === id : (el.dataset.inf === 'mais' && !!id);
      el.classList.toggle('on', on);
      if (on && el.tagName === 'A') el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    /* v3.1.1: mede no próximo quadro (sem forçar o recálculo da página) */
    cancelAnimationFrame(luzPedido);
    /* no computador a barra de baixo nem aparece: não mede nada */
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    luzPedido = requestAnimationFrame(() => moverLuz(barra));
  }
  let luzPedido = 0;
  /* A luz do item ativo é UMA pílula que desliza de um item para o outro
     (só transform). Primeira vez, sem transição: nasce no lugar. */
  let luzPosta = false;
  let luzX = null;      /* última posição da luz (para saber o sentido da viagem) */
  function moverLuz(barra) {
    const luz = barra.querySelector('.ni-luz'), on = barra.querySelector('[data-inf].on .ni-ic');
    if (!luz) return;
    if (!on) { barra.classList.remove('com-luz'); return; }
    /* mede pelo item (sem transform) e pela posição de layout do ícone:
       o ícone ativo sobe 1px e cresce, e isso não pode mexer na luz */
    const li = on.closest('li');
    const rb = barra.getBoundingClientRect(), rl = li ? li.getBoundingClientRect() : on.getBoundingClientRect();
    if (!rb.width || !rl.width) return;
    if (!luzPosta) barra.classList.add('sem-trans');
    /* zzz102: a luz cobre o item inteiro (ícone + nome), como a cápsula
       da barra de abas do iOS — largura do item, centrada na altura dele */
    const w = Math.round(rl.width);
    luz.style.width = w + 'px';
    const h = luz.offsetHeight || 54;
    const x = rl.left - rb.left - barra.clientLeft;
    const y = rl.top - rb.top - barra.clientTop + (rl.height - h) / 2;
    /* zzj: viajando entre itens, a luz estica no sentido do movimento e
       deixa um rastro; o ícone que recebe dá um pulinho */
    const xAnt = luzX;
    luzX = Math.round(x);
    if (luzPosta && xAnt != null && Math.abs(luzX - xAnt) > 4 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      luz.dataset.dir = luzX > xAnt ? '1' : '-1';
      luz.classList.remove('viaja'); void luz.offsetWidth; luz.classList.add('viaja');
      clearTimeout(luz._viaja); luz._viaja = setTimeout(() => luz.classList.remove('viaja'), 600);
      const svg = on.querySelector('svg');
      if (svg) { svg.classList.remove('pula'); void svg.offsetWidth; svg.classList.add('pula'); setTimeout(() => svg.classList.remove('pula'), 650); }
    }
    luz.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
    barra.classList.add('com-luz');
    if (!luzPosta) { luz.offsetWidth; requestAnimationFrame(() => barra.classList.remove('sem-trans')); luzPosta = true; }
  }
  window.addEventListener('resize', () => { const b = document.getElementById('nav-inferior'); if (b) { luzPosta = false; moverLuz(b); } }, { passive: true });
  window.addEventListener('hashchange', () => { marcarAtivo(); if (folhaMais) folhaMais.fechar(); });

  /* Topo do celular: com conteúdo passando por baixo, o vidro fica mais
     denso e ganha um filete. Um ouvinte passivo, uma classe, um rAF. */
  (function () {
    let pedido = 0;
    document.addEventListener('scroll', e => {
      const p = e.target;
      if (!p || p.id !== 'painel-dashboard' || pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        document.body.classList.toggle('painel-rolou', p.scrollTop > 6);
      });
    }, { capture: true, passive: true });
    window.addEventListener('hashchange', () => document.body.classList.remove('painel-rolou'));
  })();

  /* -------------------------------------------- teclado virtual
     Com o teclado aberto a barra inferior sai de cena: não cobre o
     campo ativo nem briga com a folha/diálogo. */
  (function () {
    const vv = window.visualViewport;
    const checar = () => {
      const aberto = !!vv && (window.innerHeight - vv.height) > 150;
      document.body.classList.toggle('teclado-aberto', aberto);
    };
    if (vv) vv.addEventListener('resize', checar);
    document.addEventListener('focusin', checar);
    document.addEventListener('focusout', () => setTimeout(checar, 60));
  })();

  /* --------------------------------------- tablet: barra em trilho
     Entre 761 e 1080px a barra lateral fica fixa só com ícones (em vez
     de gaveta): a preferência de recolher do desktop não é alterada. */
  function aplicarLargura() {
    if (document.body.dataset.shell !== 'interno') return;
    let tablet = false;
    try { tablet = window.matchMedia('(min-width:761px) and (max-width:1080px)').matches; } catch (e) {}
    const pref = !!(B7.pref && B7.pref.ler('sidebar_recolhida', false));
    document.body.classList.toggle('trilho-tablet', tablet);
    fecharFlyout(true);
    document.body.classList.toggle('recolhida', tablet || pref);
    if (B7.moverTrilha) setTimeout(() => B7.moverTrilha(), 0);
  }
  try { window.matchMedia('(min-width:761px) and (max-width:1080px)').addEventListener('change', aplicarLargura); } catch (e) {}

  function montar() {
    const ok = montarLateral();
    montarInferior();
    aplicarLargura();
    return ok;
  }

  return { sincronizar, fecharFlyout, montar, montarLateral, montarInferior, aplicarLargura, marcarAtivo, resolver, itemDaRota, abrirMais, rotuloDe, ITENS };
})();
