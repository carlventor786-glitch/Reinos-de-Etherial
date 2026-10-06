/* =========================================================
   REINOS DE ETHERIAL V4
   CONFIG.JS
========================================================= */

"use strict";

const GAME_CONFIG = {

    version: "4.0.0",

    /* ==========================================
       MODO DEL JUEGO
       
       local  = usa guardado del navegador
       server = usará nuestro backend
    ========================================== */

    mode: "local",


    /* ==========================================
       SERVIDOR

       Todavía NO tenemos backend conectado.
       Lo configuraremos en los siguientes pasos.
    ========================================== */

    api: {

        enabled: false,

        baseUrl: "",

        timeout: 10000

    },


    /* ==========================================
       MULTIPLAYER

       Lo activaremos en V5.
    ========================================== */

    multiplayer: {

        enabled: false,

        websocketUrl: ""

    },


    /* ==========================================
       TELEGRAM

       Lo activaremos cuando transformemos
       el juego en Telegram Mini App.
    ========================================== */

    telegram: {

        enabled: false

    },


    /* ==========================================
       ECONOMÍA
       
       IMPORTANTE:
       realMoney debe permanecer FALSE
       mientras los balances no estén
       controlados por servidor.
    ========================================== */

    economy: {

        realMoney: false,

        trading: false,

        withdrawals: false

    },


    /* ==========================================
       DESARROLLO
    ========================================== */

    debug: true

};


/* =========================================================
   PROTECCIÓN BÁSICA

   Esto NO es seguridad real.

   La seguridad real estará en el servidor.
========================================================= */

Object.freeze(
    GAME_CONFIG.economy
);

Object.freeze(
    GAME_CONFIG.api
);

Object.freeze(
    GAME_CONFIG.multiplayer
);

Object.freeze(
    GAME_CONFIG.telegram
);

Object.freeze(
    GAME_CONFIG
);


/* =========================================================
   INFORMACIÓN DE DESARROLLO
========================================================= */

if (GAME_CONFIG.debug) {

    console.log(
        "%cREINOS DE ETHERIAL",
        "color:#f5c451;font-size:18px;font-weight:bold;"
    );

    console.log(
        "Versión:",
        GAME_CONFIG.version
    );

    console.log(
        "Modo:",
        GAME_CONFIG.mode
    );

    console.log(
        "API:",
        GAME_CONFIG.api.enabled
            ? "ACTIVA"
            : "DESACTIVADA"
    );

    console.log(
        "Economía real:",
        GAME_CONFIG.economy.realMoney
            ? "ACTIVA"
            : "DESACTIVADA"
    );

}
