/* =========================================================
   REINOS DE ETHERIAL V5.0 
   API.JS

   Capa de comunicación:
   CLIENTE <-> SERVIDOR
========================================================= */

"use strict";


const EtherialAPI = (() => {


    /* =====================================================
       CONFIGURACIÓN
    ===================================================== */

    const config =
        GAME_CONFIG.api;


    let authToken =
        null;


    let currentUser =
        null;


    let online =
        false;



    /* =====================================================
       UTILIDADES
    ===================================================== */

    function log(...args) {

        if (
            GAME_CONFIG.debug
        ) {

            console.log(
                "[EtherialAPI]",
                ...args
            );

        }

    }



    function getHeaders() {

        const headers = {

            "Content-Type":
                "application/json"

        };


        if (authToken) {

            headers.Authorization =
                "Bearer " +
                authToken;

        }


        return headers;

    }



    /* =====================================================
       REQUEST AL SERVIDOR
    ===================================================== */

    async function request(
        endpoint,
        options = {}
    ) {

        if (
            !config.enabled ||
            GAME_CONFIG.mode !==
                "server"
        ) {

            throw new Error(
                "API_SERVER_DISABLED"
            );

        }


        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () =>
                    controller.abort(),

                config.timeout
            );


        try {

            const response =
                await fetch(

                    config.baseUrl +
                    endpoint,

                    {

                        ...options,

                        headers: {

                            ...getHeaders(),

                            ...(
                                options.headers ||
                                {}
                            )

                        },

                        signal:
                            controller.signal

                    }

                );


            clearTimeout(
                timeout
            );


            let data =
                null;


            try {

                data =
                    await response.json();

            }

            catch {

                data =
                    null;

            }


            if (
                !response.ok
            ) {

                const message =

                    data?.message ||

                    "SERVER_ERROR";


                throw new Error(
                    message
                );

            }


            online =
                true;


            return data;

        }

        catch (error) {

            clearTimeout(
                timeout
            );


            online =
                false;


            throw error;

        }

    }



    /* =====================================================
       ESTADO DEL SERVIDOR
    ===================================================== */

    async function healthCheck() {

        if (
            !config.enabled ||
            GAME_CONFIG.mode !==
                "server"
        ) {

            return {

                online:
                    false,

                mode:
                    "local",

                message:
                    "Servidor desactivado."

            };

        }


        try {

            const result =
                await request(
                    "/health",
                    {
                        method:
                            "GET"
                    }
                );


            online =
                true;


            return {

                online:
                    true,

                mode:
                    "server",

                data:
                    result

            };

        }

        catch (error) {

            online =
                false;


            return {

                online:
                    false,

                mode:
                    "server",

                error:
                    error.message

            };

        }

    }



    /* =====================================================
       REGISTRO
    ===================================================== */

    async function register(
        username,
        password
    ) {

        const result =
            await request(

                "/auth/register",

                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            username,

                            password

                        })

                }

            );


        if (
            result.token
        ) {

            authToken =
                result.token;

        }


        if (
            result.user
        ) {

            currentUser =
                result.user;

        }


        return result;

    }



    /* =====================================================
       LOGIN
    ===================================================== */

    async function login(
        username,
        password
    ) {

        const result =
            await request(

                "/auth/login",

                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            username,

                            password

                        })

                }

            );


        if (
            result.token
        ) {

            authToken =
                result.token;

        }


        if (
            result.user
        ) {

            currentUser =
                result.user;

        }


        return result;

    }



    /* =====================================================
       LOGOUT
    ===================================================== */

    function logout() {

        authToken =
            null;


        currentUser =
            null;


        online =
            false;


        log(
            "Sesión cerrada."
        );

    }



    /* =====================================================
       OBTENER PERSONAJE
    ===================================================== */

    async function getCharacter() {

        return await request(

            "/character",

            {

                method:
                    "GET"

            }

        );

    }



    /* =====================================================
       GUARDAR PERSONAJE
    ===================================================== */

    async function saveCharacter(
        characterData
    ) {

        return await request(

            "/character",

            {

                method:
                    "PUT",

                body:
                    JSON.stringify(
                        characterData
                    )

            }

        );

    }



    /* =====================================================
       V4.2
       RECOMPENSA SEGURA POR ENEMIGO
    ===================================================== */

    async function enemyKilled(
        enemyType
    ) {

        if (
            typeof enemyType !==
                "string" ||

            enemyType.length ===
                0
        ) {

            throw new Error(
                "INVALID_ENEMY_TYPE"
            );

        }


        return await request(

            "/game/enemy-killed",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        enemyType

                    })

            }

        );

    }



    /* =====================================================
       V4.2
       OBTENER MISIONES DEL SERVIDOR
    ===================================================== */

    async function getQuests() {

        return await request(

            "/game/quests",

            {

                method:
                    "GET"

            }

        );

    }



    /* =====================================================
       V4.2
       HABLAR CON NPC
    ===================================================== */

    async function npcTalked(
        npcId
    ) {

        if (
            typeof npcId !==
                "string" ||

            npcId.length ===
                0
        ) {

            throw new Error(
                "INVALID_NPC_ID"
            );

        }


        return await request(

            "/game/npc-talked",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        npcId

                    })

            }

        );

    }



    /* =====================================================
       V4.2
       COBRAR RECOMPENSA DE MISIÓN
    ===================================================== */

    async function completeQuest(
        questId
    ) {

        if (
            typeof questId !==
                "string" ||

            questId.length ===
                0
        ) {

            throw new Error(
                "INVALID_QUEST_ID"
            );

        }


        return await request(

            "/game/quest-completed",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        questId

                    })

            }

        );

    }



    /* =====================================================
       V4.3
       INVENTARIO EN POSTGRESQL
    ===================================================== */

    async function getInventory() {

        return await request(

            "/game/inventory",

            {

                method:
                    "GET"

            }

        );

    }



    /* =====================================================
       V4.3
       EQUIPAMIENTO EN POSTGRESQL
    ===================================================== */

    async function getEquipment() {

        return await request(

            "/game/equipment",

            {

                method:
                    "GET"

            }

        );

    }



    /* =====================================================
       V4.3
       EQUIPAR OBJETO
    ===================================================== */

    async function equipItem(
        itemId
    ) {

        if (
            typeof itemId !==
                "string" ||

            itemId.length ===
                0
        ) {

            throw new Error(
                "INVALID_ITEM_ID"
            );

        }


        return await request(

            "/game/equip-item",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        itemId

                    })

            }

        );

    }



    /* =====================================================
       V4.3
       QUITAR OBJETO EQUIPADO
    ===================================================== */

    async function unequipItem(
        slot
    ) {

        const allowedSlots = [
            "weapon",
            "armor",
            "helmet",
            "boots"
        ];


        if (
            typeof slot !==
                "string" ||

            !allowedSlots.includes(
                slot
            )
        ) {

            throw new Error(
                "INVALID_EQUIPMENT_SLOT"
            );

        }


        return await request(

            "/game/unequip-item",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        slot

                    })

            }

        );

    }



    /* =====================================================
       V4.4
       TIENDA SEGURA DEL SERVIDOR
    ===================================================== */

    async function getShop() {

        return await request(

            "/game/shop",

            {

                method:
                    "GET"

            }

        );

    }



    async function buyItem(
        itemId
    ) {

        if (
            typeof itemId !==
                "string" ||

            itemId.length ===
                0
        ) {

            throw new Error(
                "INVALID_ITEM_ID"
            );

        }


        return await request(

            "/game/shop/buy",

            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        itemId

                    })

            }

        );

    }



    /* =====================================================
       V5.0
       CONSUMIBLES Y MUERTE EN SERVIDOR
    ===================================================== */

    async function useItem(itemId) {

        if (
            typeof itemId !== "string" ||
            itemId.length === 0
        ) {
            throw new Error("INVALID_ITEM_ID");
        }

        return await request(
            "/game/use-item",
            {
                method: "POST",
                body: JSON.stringify({ itemId })
            }
        );
    }


    async function playerDied() {

        return await request(
            "/game/player-died",
            {
                method: "POST",
                body: JSON.stringify({})
            }
        );
    }



    /* =====================================================
       PERFIL
    ===================================================== */

    async function getProfile() {

        return await request(

            "/profile",

            {

                method:
                    "GET"

            }

        );

    }



    /* =====================================================
       ESTADO INTERNO
    ===================================================== */

    function getState() {

        return {

            mode:
                GAME_CONFIG.mode,

            apiEnabled:
                config.enabled,

            online,

            authenticated:
                Boolean(
                    authToken
                ),

            user:
                currentUser

        };

    }



    /* =====================================================
       TOKEN
    ===================================================== */

    function setToken(
        token
    ) {

        authToken =
            token ||
            null;

    }



    function getToken() {

        return authToken;

    }



    /* =====================================================
       API PÚBLICA
    ===================================================== */

    return {

        healthCheck,

        register,

        login,

        logout,

        getCharacter,

        saveCharacter,

        enemyKilled,

        getQuests,

        npcTalked,

        completeQuest,

        getInventory,

        getEquipment,

        equipItem,

        unequipItem,

        getShop,

        buyItem,

        useItem,

        playerDied,

        getProfile,

        getState,

        setToken,

        getToken

    };


})();



/* =========================================================
   INFORMACIÓN DE INICIO
========================================================= */

if (
    GAME_CONFIG.debug
) {

    console.log(
        "[EtherialAPI] cargado."
    );


    console.log(
        "[EtherialAPI] modo:",
        GAME_CONFIG.mode
    );

}
