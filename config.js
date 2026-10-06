"use strict";

/* =========================================================
   REINOS DE ETHERIAL V4
   CONFIGURACIÓN GLOBAL
========================================================= */

const GAME_CONFIG = {

    version: "4.0.0",

    mode: "server",

    api: {
        enabled: true,
        baseUrl: "https://reinos-de-etherial.onrender.com",
        timeout: 10000
    },

    multiplayer: {
        enabled: false,
        websocketUrl: ""
    },

    telegram: {
        enabled: false
    },

    economy: {
        realMoney: false,
        trading: false,
        withdrawals: false
    },

    debug: true

};


/* =========================================================
   PROTEGER CONFIGURACIÓN
========================================================= */

Object.freeze(GAME_CONFIG.economy);
Object.freeze(GAME_CONFIG.api);
Object.freeze(GAME_CONFIG.multiplayer);
Object.freeze(GAME_CONFIG.telegram);
Object.freeze(GAME_CONFIG);
