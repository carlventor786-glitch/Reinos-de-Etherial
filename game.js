/* =========================================================
   REINOS DE ETHERIAL V5.5.2 
   GAME.JS
========================================================= */

"use strict";

/* =========================================================
   CANVAS
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;

const SAVE_KEY = "reinos_etherial_v4_3_1_save";


/* =========================================================
   UTILIDADES
========================================================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomInt(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}


/* =========================================================
   ESTADO
========================================================= */

const keys = {};

let lastTime = performance.now();

let attackCooldown = 0;
let autoSaveTimer = 0;

let currentTarget = null;

let multiplayerSocket = null;
let multiplayerSendTimer = 0;
const remotePlayers = new Map();

function getMultiplayerUrl() {
    const baseUrl =
        GAME_CONFIG?.api?.baseUrl || "";

    if (!baseUrl) return null;

    return baseUrl
        .replace(/^https:/, "wss:")
        .replace(/^http:/, "ws:")
        .replace(/\/+$/, "") +
        "/multiplayer";
}

function connectMultiplayer() {
    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.getToken !== "function"
    ) {
        return;
    }

    const token = EtherialAPI.getToken();
    const baseUrl = getMultiplayerUrl();

    if (!token || !baseUrl) return;

    if (
        multiplayerSocket &&
        (
            multiplayerSocket.readyState === WebSocket.OPEN ||
            multiplayerSocket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    multiplayerSocket =
        new WebSocket(
            baseUrl +
            "?token=" +
            encodeURIComponent(token)
        );

    multiplayerSocket.onopen = () => {
        addLog("🌐 Multijugador V5 conectado.");
    };

    multiplayerSocket.onmessage = event => {
        try {
            const message = JSON.parse(event.data);

            if (
                message.type === "presence" &&
                Array.isArray(message.players)
            ) {
                remotePlayers.clear();

                const ownUserId =
                    EtherialAPI.getState()?.user?.id;

                message.players.forEach(remote => {
                    if (
                        remote &&
                        remote.userId !== ownUserId
                    ) {
                        remotePlayers.set(
                            remote.userId,
                            remote
                        );
                    }
                });
            }

            if (
                message.type === "player-move" &&
                message.player
            ) {
                const ownUserId =
                    EtherialAPI.getState()?.user?.id;

                if (
                    message.player.userId !== ownUserId
                ) {
                    remotePlayers.set(
                        message.player.userId,
                        message.player
                    );
                }
            }
        } catch (error) {
            console.error(
                "[V5 MULTIPLAYER MESSAGE]",
                error
            );
        }
    };

    multiplayerSocket.onclose = () => {
        remotePlayers.clear();
        multiplayerSocket = null;
    };
}

function sendMultiplayerPosition() {
    if (
        !multiplayerSocket ||
        multiplayerSocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    multiplayerSocket.send(
        JSON.stringify({
            type: "move",
            x: player.x,
            y: player.y,
            zone: player.zone
        })
    );
}


/* =========================================================
   JUGADOR
========================================================= */

const player = {

    x: WORLD_DATA.startX,
    y: WORLD_DATA.startY,

    width: 24,
    height: 30,

    level: 1,

    xp: 0,
    nextXp: LEVEL_CONFIG.startingXp,

    hp: 100,
    maxHp: 100,

    mana: 50,
    maxMana: 50,

    baseAttack: 12,
    baseDefense: 3,

    gold: 50,

    speed: 190,

    kills: 0,

    zone: WORLD_DATA.startingZone
};
// ==========================================
// V4 - CARGAR PERSONAJE DESDE EL SERVIDOR
// ==========================================

function getServerNumber(value, fallback) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function calculateNextXpForLevel(level) {

    let requiredXp =
        LEVEL_CONFIG.startingXp;

    for (
        let currentLevel = 1;
        currentLevel < level;
        currentLevel++
    ) {

        requiredXp = Math.floor(
            requiredXp *
            LEVEL_CONFIG.xpMultiplier
        );
    }

    return requiredXp;
}


function applyServerCharacter(character) {

    if (!character) {

        console.warn(
            "[V4] No se recibió personaje del servidor."
        );

        return;
    }


    const level = Math.max(
        1,
        Math.floor(
            getServerNumber(
                character.level,
                1
            )
        )
    );


    // --------------------------------------
    // NIVEL Y EXPERIENCIA
    // --------------------------------------

    player.level = level;

    player.xp = Math.max(
        0,
        getServerNumber(
            character.xp,
            0
        )
    );

    player.nextXp =
        calculateNextXpForLevel(level);


    // --------------------------------------
    // STATS DERIVADOS DEL NIVEL
    // --------------------------------------

    player.maxHp =
        100 +
        (
            (level - 1) *
            LEVEL_CONFIG.hpPerLevel
        );

    player.maxMana =
        50 +
        (
            (level - 1) *
            LEVEL_CONFIG.manaPerLevel
        );

    player.baseAttack =
        12 +
        (
            (level - 1) *
            LEVEL_CONFIG.attackPerLevel
        );

    player.baseDefense =
        3 +
        (
            (level - 1) *
            LEVEL_CONFIG.defensePerLevel
        );


    // --------------------------------------
    // VIDA Y MANA
    // --------------------------------------

    player.hp = Math.max(
        0,
        Math.min(
            player.maxHp,
            getServerNumber(
                character.hp,
                player.maxHp
            )
        )
    );

    player.mana = Math.max(
        0,
        Math.min(
            player.maxMana,
            getServerNumber(
                character.mana,
                player.maxMana
            )
        )
    );


    // --------------------------------------
    // ORO
    // --------------------------------------

    player.gold = Math.max(
        0,
        Math.floor(
            getServerNumber(
                character.gold,
                0
            )
        )
    );


    // --------------------------------------
    // POSICIÓN
    // --------------------------------------

    player.x =
        getServerNumber(
            character.x,
            WORLD_DATA.startX
        );

    player.y =
        getServerNumber(
            character.y,
            WORLD_DATA.startY
        );


    // --------------------------------------
    // ZONA
    // --------------------------------------

    if (
        typeof character.zone === "string" &&
        character.zone.length > 0
    ) {

        player.zone =
            character.zone;

    } else {

        player.zone =
            WORLD_DATA.startingZone;
    }


    // --------------------------------------
    // ACTUALIZAR JUEGO
    // --------------------------------------

    updateCamera();

    updateZone();

    updateUI();


    console.log(
        "☁ Personaje V4 aplicado:",
        {
            level: player.level,
            xp: player.xp,
            gold: player.gold,
            hp: player.hp,
            mana: player.mana,
            x: player.x,
            y: player.y,
            zone: player.zone
        }
    );


    addLog(
        "☁ Personaje cargado desde el servidor."
    );
}


// ==========================================
// ESCUCHAR AUTH.JS
// ==========================================

window.addEventListener(
    "etherial:character-ready",
    event => {

        const character =
            event.detail?.character;

        applyServerCharacter(
            character
        );

        loadQuestsFromServer();
        loadInventoryAndEquipmentFromServer();
        connectMultiplayer();
    }
);


// Permitir acceso futuro desde auth.js
window.EtherialGame = {
    applyServerCharacter
};

/* =========================================================
   INVENTARIO
========================================================= */

let inventory = {};


/* =========================================================
   EQUIPAMIENTO
========================================================= */

let equipment = {
    weapon: null,
    armor: null,
    helmet: null,
    boots: null
};


/* =========================================================
   V4.3 - INVENTARIO Y EQUIPAMIENTO DESDE POSTGRESQL
========================================================= */

function inventoryRowsToObject(rows) {
    const nextInventory = {};

    if (!Array.isArray(rows)) {
        return nextInventory;
    }

    rows.forEach(row => {
        const itemId = row.item_id;
        const quantity = Math.max(
            0,
            Math.floor(Number(row.quantity) || 0)
        );

        if (
            typeof itemId === "string" &&
            ITEMS[itemId] &&
            quantity > 0
        ) {
            nextInventory[itemId] = quantity;
        }
    });

    return nextInventory;
}

function applyServerInventory(rows) {
    inventory = inventoryRowsToObject(rows);
    renderInventory();
}

function applyServerEquipment(serverEquipment) {
    const source = serverEquipment || {};

    equipment = {
        weapon: source.weapon || null,
        armor: source.armor || null,
        helmet: source.helmet || null,
        boots: source.boots || null
    };

    renderEquipment();
    updateUI();
}

async function loadInventoryAndEquipmentFromServer() {
    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.getInventory !== "function" ||
        typeof EtherialAPI.getEquipment !== "function"
    ) {
        return false;
    }

    try {
        const [inventoryResult, equipmentResult] =
            await Promise.all([
                EtherialAPI.getInventory(),
                EtherialAPI.getEquipment()
            ]);

        if (inventoryResult?.success === true) {
            applyServerInventory(
                inventoryResult.inventory || []
            );
        }

        if (equipmentResult?.success === true) {
            applyServerEquipment(
                equipmentResult.equipment || {}
            );
        }

        console.log(
            "🎒 Inventario/equipo V4.3 cargados desde PostgreSQL."
        );

        return true;
    } catch (error) {
        console.error(
            "[V4.3.1 INVENTORY LOAD]",
            error
        );

        addLog(
            "⚠ No se pudo cargar inventario/equipo del servidor."
        );

        return false;
    }
}

async function refreshInventoryFromServer() {
    try {
        const result =
            await EtherialAPI.getInventory();

        if (result?.success === true) {
            applyServerInventory(
                result.inventory || []
            );
            return true;
        }
    } catch (error) {
        console.error(
            "[V4.3.1 INVENTORY REFRESH]",
            error
        );
    }

    return false;
}


/* =========================================================
   MISIÓN
========================================================= */

let questState = {

    current: "introduction",

    progress: 0,

    completed: false
};


let serverQuestRows = [];


function getQuestOrder() {

    return Object.keys(QUESTS);

}


function syncQuestStateFromRows(rows) {

    serverQuestRows =
        Array.isArray(rows)
            ? rows
            : [];


    const byId =
        new Map(
            serverQuestRows.map(
                row => [
                    row.quest_id,
                    row
                ]
            )
        );


    const order =
        getQuestOrder();


    let currentId =
        null;


    for (const questId of order) {

        const row =
            byId.get(questId);


        if (!row) {

            currentId =
                questId;

            break;
        }


        if (
            row.rewarded !== true
        ) {

            currentId =
                questId;

            break;
        }

    }


    if (!currentId) {

        questState = {

            current: null,

            progress: 0,

            completed: true

        };


        renderQuest();

        return;

    }


    const row =
        byId.get(currentId);


    questState = {

        current:
            currentId,

        progress:
            row
                ? Math.max(
                    0,
                    Number(row.progress) || 0
                )
                : 0,

        completed:
            row
                ? Boolean(row.completed)
                : false

    };


    renderQuest();

}


async function loadQuestsFromServer() {

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.getQuests !== "function"
    ) {

        return;

    }


    try {

        const result =
            await EtherialAPI.getQuests();


        if (
            result &&
            result.success === true
        ) {

            syncQuestStateFromRows(
                result.quests || []
            );


            console.log(
                "📜 Misiones V4.3 cargadas desde PostgreSQL:",
                result.quests || []
            );

        }

    }

    catch (error) {

        console.error(
            "[V4.3 QUEST LOAD]",
            error
        );

    }

}


async function claimServerQuest(
    questId
) {

    const quest =
        QUESTS[questId];


    if (
        !quest ||
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.completeQuest !== "function"
    ) {

        return false;

    }


    try {

        const previousLevel =
            player.level;


        const result =
            await EtherialAPI.completeQuest(
                questId
            );


        if (
            !result ||
            result.success !== true ||
            !result.character
        ) {

            throw new Error(
                "Respuesta inválida del servidor."
            );

        }


        applyServerCharacter(
            result.character
        );


        const reward =
            result.reward || {};


        // V4.3: los objetos ya fueron guardados por el servidor.
        if (Array.isArray(result.inventory)) {
            applyServerInventory(result.inventory);
        } else {
            await refreshInventoryFromServer();
        }

        if (result.equipment) {
            applyServerEquipment(result.equipment);
        }


        addLog(
            "🏆 Misión completada: " +
            quest.name
        );


        addLog(
            "🎁 +" +
            (reward.xp || 0) +
            " EXP · +" +
            (reward.gold || 0) +
            " oro."
        );


        if (
            player.level >
            previousLevel
        ) {

            player.hp =
                player.maxHp;

            player.mana =
                player.maxMana;

            showLevelUp();

        }


        await loadQuestsFromServer();


        if (
            result.next &&
            QUESTS[result.next]
        ) {

            addLog(
                "📜 Nueva misión: " +
                QUESTS[result.next].name
            );

        }

        else if (
            result.next === null
        ) {

            addLog(
                "👑 ¡Has completado todas las misiones de V4.3!"
            );

        }


        saveGame(false);

        updateUI();

        renderQuest();


        return true;

    }

    catch (error) {

        console.error(
            "[V4.3 QUEST CLAIM]",
            error
        );


        addLog(
            "⚠ No se pudo cobrar la recompensa de misión."
        );


        return false;

    }

}


/* =========================================================
   CÁMARA
========================================================= */

const camera = {

    x: 0,
    y: 0

};


/* =========================================================
   LOG
========================================================= */

const gameLogs = [];


function addLog(text) {

    gameLogs.unshift(text);

    if (gameLogs.length > 9) {
        gameLogs.pop();
    }

    renderLog();
}


function renderLog() {

    const container =
        document.getElementById("gameLog");

    container.innerHTML = "";

    gameLogs.forEach(message => {

        const p =
            document.createElement("p");

        p.textContent = message;

        container.appendChild(p);

    });

}


/* =========================================================
   ENEMIGOS
========================================================= */

const enemies = ENEMY_SPAWNS.map(
    (spawn, index) => {

        const type =
            ENEMY_TYPES[spawn.type];

        return {

            id: "enemy_" + index,

            type: spawn.type,

            x: spawn.x,
            y: spawn.y,

            spawnX: spawn.x,
            spawnY: spawn.y,

            hp: type.maxHp,

            alive: true,

            respawnTimer: 0,

            attackTimer: 0

        };

    }
);


/* =========================================================
   STATS DEL JUGADOR
========================================================= */

function getAttack() {

    let value =
        player.baseAttack;

    Object.values(equipment)
        .forEach(itemId => {

            if (!itemId) return;

            const item =
                ITEMS[itemId];

            if (item && item.attack) {
                value += item.attack;
            }

        });

    return value;
}


function getDefense() {

    let value =
        player.baseDefense;

    Object.values(equipment)
        .forEach(itemId => {

            if (!itemId) return;

            const item =
                ITEMS[itemId];

            if (item && item.defense) {
                value += item.defense;
            }

        });

    return value;
}


function getSpeed() {

    let value =
        player.speed;

    const boots =
        equipment.boots
        ? ITEMS[equipment.boots]
        : null;

    if (boots && boots.speed) {
        value += boots.speed;
    }

    return value;
}


/* =========================================================
   INVENTARIO
========================================================= */

function addItem(itemId, amount = 1) {

    if (!ITEMS[itemId]) {
        return;
    }

    if (!inventory[itemId]) {
        inventory[itemId] = 0;
    }

    inventory[itemId] += amount;

    addLog(
        "🎒 +" +
        amount +
        " " +
        ITEMS[itemId].name
    );

    renderInventory();
}


function removeItem(itemId, amount = 1) {

    if (!inventory[itemId]) {
        return false;
    }

    if (inventory[itemId] < amount) {
        return false;
    }

    inventory[itemId] -= amount;

    if (inventory[itemId] <= 0) {
        delete inventory[itemId];
    }

    renderInventory();

    return true;
}


/* =========================================================
   USAR / EQUIPAR OBJETO
========================================================= */

async function useInventoryItem(itemId) {
    const item = ITEMS[itemId];

    if (!item) return;

    if (item.type === "consumable") {

        if (
            typeof EtherialAPI === "undefined" ||
            typeof EtherialAPI.useItem !== "function"
        ) {
            addLog(
                "⚠ Consumibles del servidor no disponibles."
            );
            return;
        }

        try {
            const result =
                await EtherialAPI.useItem(itemId);

            if (
                !result ||
                result.success !== true ||
                !result.character ||
                !Array.isArray(result.inventory)
            ) {
                throw new Error(
                    "Respuesta inválida del servidor."
                );
            }

            applyServerCharacter(
                result.character
            );

            applyServerInventory(
                result.inventory
            );

            const effect =
                result.effect || {};

            addLog(
                "🧪 Usaste " +
                item.name +
                ". +" +
                (effect.heal || 0) +
                " HP"
            );

            updateUI();
            return;

        } catch (error) {
            console.error(
                "[V5 USE ITEM]",
                error
            );

            addLog(
                "⚠ No se pudo usar " +
                item.name +
                "."
            );
            return;
        }
    }

    const validEquipment = [
        "weapon",
        "armor",
        "helmet",
        "boots"
    ];

    if (validEquipment.includes(item.type)) {
        equipItem(itemId);
    }
}


/* =========================================================
   EQUIPAR
========================================================= */

async function equipItem(itemId) {
    const item = ITEMS[itemId];

    if (!item) return;

    const validEquipment = [
        "weapon",
        "armor",
        "helmet",
        "boots"
    ];

    if (!validEquipment.includes(item.type)) {
        return;
    }

    if (!inventory[itemId] || inventory[itemId] <= 0) {
        addLog("🎒 No tienes ese objeto.");
        return;
    }

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.equipItem !== "function"
    ) {
        addLog(
            "⚠ Equipamiento del servidor no disponible."
        );
        return;
    }

    try {
        const result =
            await EtherialAPI.equipItem(itemId);

        if (
            !result ||
            result.success !== true ||
            !result.equipment
        ) {
            throw new Error(
                "Respuesta inválida del servidor."
            );
        }

        applyServerEquipment(
            result.equipment
        );

        // PostgreSQL es la fuente oficial.
        await refreshInventoryFromServer();

        addLog(
            "⚔ Equipaste " +
            item.name +
            "."
        );

        updateUI();

    } catch (error) {
        console.error(
            "[V4.3.1 EQUIP ITEM]",
            error
        );

        addLog(
            "⚠ No se pudo equipar " +
            item.name +
            "."
        );
    }
}


async function unequipItem(slot) {

    const validEquipment = [
        "weapon",
        "armor",
        "helmet",
        "boots"
    ];

    if (!validEquipment.includes(slot)) {
        return;
    }

    const itemId =
        equipment[slot];

    if (!itemId) {
        addLog("🎒 Esa ranura ya está vacía.");
        return;
    }

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.unequipItem !== "function"
    ) {
        addLog(
            "⚠ Desequipamiento del servidor no disponible."
        );
        return;
    }

    try {
        const result =
            await EtherialAPI.unequipItem(slot);

        if (
            !result ||
            result.success !== true ||
            !result.equipment
        ) {
            throw new Error(
                "Respuesta inválida del servidor."
            );
        }

        applyServerEquipment(
            result.equipment
        );

        await refreshInventoryFromServer();

        const item =
            ITEMS[itemId];

        addLog(
            "🛡 Desequipaste " +
            (item ? item.name : itemId) +
            "."
        );

        updateUI();

    } catch (error) {
        console.error(
            "[V4.3.1 UNEQUIP ITEM]",
            error
        );

        addLog(
            "⚠ No se pudo desequipar el objeto."
        );
    }
}


/* =========================================================
   POCIÓN RÁPIDA
========================================================= */

function usePotion() {

    if (
        inventory.potion &&
        inventory.potion > 0
    ) {

        useInventoryItem(
            "potion"
        );

        return;
    }


    if (
        inventory.greaterPotion &&
        inventory.greaterPotion > 0
    ) {

        useInventoryItem(
            "greaterPotion"
        );

        return;
    }


    addLog(
        "🧪 No tienes pociones."
    );
}


/* =========================================================
   COMBATE
========================================================= */

function attack() {

    if (attackCooldown > 0) {
        return;
    }

    attackCooldown = 0.45;


    let target = null;
    let bestDistance = Infinity;


    enemies.forEach(enemy => {

        if (!enemy.alive) return;

        const d =
            distance(player, enemy);

        if (
            d <= 78 &&
            d < bestDistance
        ) {

            bestDistance = d;
            target = enemy;

        }

    });


    currentTarget = target;


    if (!target) {

        addLog(
            "⚔ No hay enemigos al alcance."
        );

        return;
    }


    const enemyType =
        ENEMY_TYPES[target.type];


    const rawDamage =
        getAttack() +
        randomInt(-3, 5);


    const damage =
        Math.max(
            1,
            rawDamage -
            enemyType.defense
        );


    target.hp -= damage;


    addLog(
        "⚔ Golpeas a " +
        enemyType.name +
        " por " +
        damage +
        "."
    );


    if (target.hp <= 0) {

        killEnemy(target);

    }


    updateUI();
}


/* =========================================================
   MATAR ENEMIGO
========================================================= */

async function killEnemy(enemy) {

    const type =
        ENEMY_TYPES[enemy.type];


    // ==========================================
    // MARCAR ENEMIGO COMO DERROTADO LOCALMENTE
    // ==========================================

    enemy.alive = false;

    enemy.hp = 0;

    enemy.respawnTimer =
        randomInt(7, 12);

    currentTarget = null;


    // ==========================================
    // COMPROBAR CONEXIÓN CON API
    // ==========================================

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.enemyKilled !== "function"
    ) {

        console.error(
            "[V4.3] enemyKilled no está disponible."
        );

        addLog(
            "⚠ No se pudo registrar la recompensa."
        );

        return;
    }


    try {

        // ======================================
        // EL SERVIDOR PROCESA LA RECOMPENSA
        // ======================================

        const result =
            await EtherialAPI.enemyKilled(
                enemy.type
            );


        if (
            !result ||
            result.success !== true ||
            !result.character
        ) {

            throw new Error(
                "Respuesta inválida del servidor."
            );
        }


        const reward =
            result.reward || {};


        const previousLevel =
            player.level;


        // ======================================
        // APLICAR DATOS OFICIALES DEL SERVIDOR
        // ======================================

        player.level =
            Math.max(
                1,
                Number(
                    result.character.level
                ) || 1
            );


        player.xp =
            Math.max(
                0,
                Number(
                    result.character.xp
                ) || 0
            );


        player.gold =
            Math.max(
                0,
                Number(
                    result.character.gold
                ) || 0
            );


        player.nextXp =
            calculateNextXpForLevel(
                player.level
            );


        // ======================================
        // RECALCULAR STATS SEGÚN NIVEL
        // ======================================

        player.maxHp =
            100 +
            (
                (player.level - 1) *
                LEVEL_CONFIG.hpPerLevel
            );


        player.maxMana =
            50 +
            (
                (player.level - 1) *
                LEVEL_CONFIG.manaPerLevel
            );


        player.baseAttack =
            12 +
            (
                (player.level - 1) *
                LEVEL_CONFIG.attackPerLevel
            );


        player.baseDefense =
            3 +
            (
                (player.level - 1) *
                LEVEL_CONFIG.defensePerLevel
            );


        // ======================================
        // CONTADOR LOCAL DE MUERTES
        // ======================================

        player.kills++;


        // ======================================
        // MENSAJE DE RECOMPENSA
        // ======================================

        addLog(
            "☠ " +
            type.name +
            " derrotado. +" +
            (reward.xp || 0) +
            " EXP · +" +
            (reward.gold || 0) +
            " oro."
        );


        // ======================================
        // LEVEL UP
        // ======================================

        if (
            player.level >
            previousLevel
        ) {

            player.hp =
                player.maxHp;

            player.mana =
                player.maxMana;


            showLevelUp();


            addLog(
                "✨ Alcanzaste nivel " +
                player.level +
                "!"
            );

        }


        // ======================================
        // LOOT LOCAL
        // ======================================

        // V4.3: loot local desactivado temporalmente.
        // Evita crear objetos que no existan en PostgreSQL.
        // processLoot(type);


        // ======================================
        // MISIONES V4.3 - PROGRESO DEL SERVIDOR
        // ======================================

        if (result.quest) {

            questState.current =
                result.quest.questId;

            questState.progress =
                Number(
                    result.quest.progress
                ) || 0;

            questState.completed =
                Boolean(
                    result.quest.completed
                );


            const serverQuest =
                QUESTS[
                    result.quest.questId
                ];


            if (serverQuest) {

                addLog(
                    "📜 " +
                    serverQuest.name +
                    ": " +
                    questState.progress +
                    "/" +
                    serverQuest.amount
                );

            }


            renderQuest();


            if (
                result.quest.completed === true &&
                result.quest.rewarded !== true
            ) {

                await claimServerQuest(
                    result.quest.questId
                );

            }

        }


        // ======================================
        // V5.0 - LOOT OFICIAL DEL SERVIDOR
        // ======================================

        if (Array.isArray(result.inventory)) {
            applyServerInventory(
                result.inventory
            );
        }

        if (
            Array.isArray(result.loot) &&
            result.loot.length > 0
        ) {
            result.loot.forEach(drop => {
                const lootItem =
                    ITEMS[drop.itemId];

                addLog(
                    "🎁 Loot: +" +
                    drop.quantity +
                    " " +
                    (
                        lootItem
                            ? lootItem.name
                            : drop.itemId
                    )
                );
            });
        }


        // ======================================
        // ACTUALIZAR INTERFAZ
        // ======================================

        updateUI();


        console.log(
            "⚔ Recompensa V4.3 confirmada:",
            {
                enemy:
                    enemy.type,

                xp:
                    reward.xp,

                gold:
                    reward.gold,

                level:
                    player.level,

                totalXp:
                    player.xp,

                totalGold:
                    player.gold
            }
        );


        // ======================================
        // GUARDADO GENERAL
        // ======================================

        saveGame(false);


    } catch (error) {

        console.error(
            "[V4.3 ENEMY REWARD ERROR]",
            error
        );


        addLog(
            "⚠ El servidor no pudo entregar la recompensa."
        );

    }

}


/* =========================================================
   LOOT
========================================================= */

function processLoot(enemyType) {

    if (!enemyType.loot) {
        return;
    }


    enemyType.loot.forEach(drop => {

        if (
            Math.random() <=
            drop.chance
        ) {

            const amount =
                randomInt(
                    drop.min,
                    drop.max
                );

            addItem(
                drop.item,
                amount
            );

        }

    });

}


/* =========================================================
   NIVEL
========================================================= */

function checkLevelUp() {

    while (
        player.xp >=
        player.nextXp
    ) {

        player.xp -=
            player.nextXp;


        player.level++;


        player.nextXp =
            Math.floor(
                player.nextXp *
                LEVEL_CONFIG.xpMultiplier
            );


        player.maxHp +=
            LEVEL_CONFIG.hpPerLevel;


        player.maxMana +=
            LEVEL_CONFIG.manaPerLevel;


        player.baseAttack +=
            LEVEL_CONFIG.attackPerLevel;


        player.baseDefense +=
            LEVEL_CONFIG.defensePerLevel;


        player.hp =
            player.maxHp;


        player.mana =
            player.maxMana;


        showLevelUp();


        addLog(
            "✨ Alcanzaste nivel " +
            player.level +
            "!"
        );

    }

}


/* =========================================================
   MENSAJE LEVEL UP
========================================================= */

function showLevelUp() {

    const message =
        document.getElementById(
            "levelUpMessage"
        );


    message.classList.remove(
        "hidden"
    );


    setTimeout(() => {

        message.classList.add(
            "hidden"
        );

    }, 1800);

}


/* =========================================================
   MISIONES
========================================================= */

function getCurrentQuest() {

    return QUESTS[
        questState.current
    ];

}


async function processQuestTalk(
    npcId
) {

    const quest =
        getCurrentQuest();


    if (!quest) return;


    if (
        quest.type !== "talk" ||
        quest.target !== npcId
    ) {

        return;

    }


    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.npcTalked !== "function"
    ) {

        addLog(
            "⚠ No se pudo registrar la conversación."
        );

        return;

    }


    try {

        const result =
            await EtherialAPI.npcTalked(
                npcId
            );


        if (
            !result ||
            result.success !== true ||
            !result.quest
        ) {

            return;

        }


        questState.current =
            result.quest.questId;

        questState.progress =
            Number(
                result.quest.progress
            ) || 0;

        questState.completed =
            Boolean(
                result.quest.completed
            );


        renderQuest();


        if (
            result.quest.completed === true &&
            result.quest.rewarded !== true
        ) {

            await claimServerQuest(
                result.quest.questId
            );

        }

    }

    catch (error) {

        console.error(
            "[V4.3 NPC QUEST]",
            error
        );


        addLog(
            "⚠ El servidor no pudo actualizar la misión."
        );

    }

}


/* =========================================================
   COMPLETAR MISIÓN V4.3

   Las recompensas oficiales se procesan en el servidor.
========================================================= */

async function completeQuest() {

    const questId =
        questState.current;


    if (!questId) {

        return false;

    }


    return await claimServerQuest(
        questId
    );

}


/* =========================================================
   NPC
========================================================= */

function getNearestNPC() {

    let nearest = null;

    let nearestDistance =
        Infinity;


    Object.values(NPCS)
        .forEach(npc => {

            const d =
                distance(
                    player,
                    npc
                );


            if (
                d < 90 &&
                d < nearestDistance
            ) {

                nearest = npc;

                nearestDistance = d;

            }

        });


    return nearest;
}


/* =========================================================
   INTERACTUAR
========================================================= */

async function interact() {

    const npc =
        getNearestNPC();


    if (!npc) {

        addLog(
            "💬 No hay nadie cerca."
        );

        return;
    }


    openDialog(npc);

    await processQuestTalk(
        npc.id
    );

}


/* =========================================================
   DIÁLOGO
========================================================= */

function openDialog(npc) {

    document
        .getElementById(
            "dialogName"
        )
        .textContent =
        npc.icon +
        " " +
        npc.name +
        " — " +
        npc.role;


    document
        .getElementById(
            "dialogText"
        )
        .textContent =
        npc.dialog;


    const actions =
        document.getElementById(
            "dialogActions"
        );


    actions.innerHTML = "";


    if (
        npc.id === "mira" ||
        npc.id === "borin"
    ) {

        const shopButton =
            document.createElement(
                "button"
            );


        shopButton.textContent =
            "🏪 Ver tienda";


        shopButton.onclick = () => {

            closeDialog();

            openShop();

        };


        actions.appendChild(
            shopButton
        );

    }


    if (npc.id === "elena") {

        const healButton =
            document.createElement(
                "button"
            );


        healButton.textContent =
            "❤️ Curarme";


        healButton.onclick = () => {

            player.hp =
                player.maxHp;

            player.mana =
                player.maxMana;


            addLog(
                "❤️ Elena restaura tu vida y mana."
            );


            updateUI();

            saveGame(false);

        };


        actions.appendChild(
            healButton
        );

    }


    document
        .getElementById(
            "dialogWindow"
        )
        .classList.remove(
            "hidden"
        );

}


function closeDialog() {

    document
        .getElementById(
            "dialogWindow"
        )
        .classList.add(
            "hidden"
        );

}


/* =========================================================
   TIENDA
========================================================= */

async function openShop() {

    const container =
        document.getElementById(
            "shopItems"
        );


    const goldElement =
        document.getElementById(
            "shopGold"
        );


    const shopWindow =
        document.getElementById(
            "shopWindow"
        );


    if (
        !container ||
        !goldElement ||
        !shopWindow
    ) {

        addLog(
            "⚠ No se pudo abrir la tienda."
        );

        return;
    }


    container.innerHTML =
        '<div class="shopItem">' +
        "⏳ Cargando tienda..." +
        "</div>";


    goldElement.textContent =
        player.gold;


    shopWindow.classList.remove(
        "hidden"
    );


    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.getShop !== "function"
    ) {

        container.innerHTML =
            '<div class="shopItem">' +
            "⚠ Tienda del servidor no disponible." +
            "</div>";

        return;
    }


    try {

        const result =
            await EtherialAPI.getShop();


        if (
            !result ||
            result.success !== true ||
            !Array.isArray(result.items)
        ) {

            throw new Error(
                "Respuesta inválida de la tienda."
            );

        }


        renderServerShop(
            result.items
        );


    } catch (error) {

        console.error(
            "[V4.4 SHOP LOAD]",
            error
        );


        container.innerHTML =
            '<div class="shopItem">' +
            "⚠ No se pudo cargar la tienda." +
            "</div>";


        addLog(
            "⚠ No se pudo cargar la tienda del servidor."
        );

    }

}


function renderServerShop(
    serverItems
) {

    const container =
        document.getElementById(
            "shopItems"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    serverItems.forEach(
        shopEntry => {

            const itemId =
                shopEntry.itemId;


            const price =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            shopEntry.price
                        ) || 0
                    )
                );


            const item =
                ITEMS[itemId];


            if (
                !item ||
                price <= 0
            ) {

                return;
            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "shopItem";


            const information =
                document.createElement(
                    "div"
                );


            information.innerHTML =

                '<div class="shopItemName">' +
                item.icon +
                " " +
                item.name +
                "</div>" +

                '<div class="shopItemDescription">' +
                item.description +
                "</div>" +

                '<div class="shopPrice">' +
                price +
                " oro</div>";


            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "shopButton";


            button.textContent =
                player.gold >= price
                    ? "Comprar"
                    : "Falta oro";


            button.disabled =
                player.gold < price;


            button.onclick =
                async () => {

                    button.disabled =
                        true;

                    button.textContent =
                        "Comprando...";


                    await buyItem(
                        itemId
                    );


                    // Volvemos a consultar la tienda para
                    // refrescar botones según el oro restante.
                    await openShop();

                };


            element.appendChild(
                information
            );


            element.appendChild(
                button
            );


            container.appendChild(
                element
            );

        }
    );


    if (
        container.children.length === 0
    ) {

        container.innerHTML =
            '<div class="shopItem">' +
            "No hay objetos disponibles." +
            "</div>";

    }


    const goldElement =
        document.getElementById(
            "shopGold"
        );


    if (goldElement) {

        goldElement.textContent =
            player.gold;

    }

}


function closeShop() {

    const shopWindow =
        document.getElementById(
            "shopWindow"
        );


    if (shopWindow) {

        shopWindow.classList.add(
            "hidden"
        );

    }

}


async function buyItem(
    itemId
) {

    const item =
        ITEMS[itemId];


    if (!item) {

        addLog(
            "⚠ Objeto de tienda inválido."
        );

        return false;
    }


    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.buyItem !== "function"
    ) {

        addLog(
            "⚠ Compra del servidor no disponible."
        );

        return false;
    }


    try {

        const result =
            await EtherialAPI.buyItem(
                itemId
            );


        if (
            !result ||
            result.success !== true ||
            !result.character ||
            !Array.isArray(
                result.inventory
            )
        ) {

            throw new Error(
                "Respuesta inválida del servidor."
            );

        }


        // El servidor es la única fuente oficial
        // del oro después de comprar.
        applyServerCharacter(
            result.character
        );


        // El objeto ya fue agregado en PostgreSQL.
        applyServerInventory(
            result.inventory
        );


        if (result.equipment) {

            applyServerEquipment(
                result.equipment
            );

        }


        const purchase =
            result.purchase || {};


        addLog(
            "🏪 Compraste " +
            item.name +
            " por " +
            (
                Number(
                    purchase.price
                ) || 0
            ) +
            " oro."
        );


        const goldElement =
            document.getElementById(
                "shopGold"
            );


        if (goldElement) {

            goldElement.textContent =
                player.gold;

        }


        updateUI();

        saveGame(false);


        return true;


    } catch (error) {

        console.error(
            "[V4.4 SHOP BUY]",
            error
        );


        addLog(
            "⚠ No se pudo comprar " +
            item.name +
            ": " +
            (
                error?.message ||
                "error del servidor"
            )
        );


        return false;

    }

}


/* =========================================================
   ZONA ACTUAL
========================================================= */

function updateZone() {

    let foundZone =
        null;


    Object.values(ZONES)
        .forEach(zone => {

            if (
                player.x >= zone.x &&
                player.x <=
                    zone.x + zone.width &&
                player.y >= zone.y &&
                player.y <=
                    zone.y + zone.height
            ) {

                foundZone = zone;

            }

        });


    if (!foundZone) {

        document
            .getElementById(
                "zoneDisplay"
            )
            .textContent =
            "🌎 Tierras Salvajes";

        return;
    }


    if (
        player.zone !==
        foundZone.id
    ) {

        player.zone =
            foundZone.id;


        addLog(
            foundZone.icon +
            " Entraste en " +
            foundZone.name +
            "."
        );

    }


    document
        .getElementById(
            "zoneDisplay"
        )
        .textContent =

        foundZone.icon +
        " " +
        foundZone.name;

}


/* =========================================================
   MUERTE
========================================================= */

async function playerDeath() {

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.playerDied !== "function"
    ) {
        addLog(
            "⚠ No se pudo procesar la muerte en el servidor."
        );
        return;
    }

    try {
        const result =
            await EtherialAPI.playerDied();

        if (
            !result ||
            result.success !== true ||
            !result.character
        ) {
            throw new Error(
                "Respuesta inválida del servidor."
            );
        }

        applyServerCharacter(
            result.character
        );

        addLog(
            "💀 Has caído. Regresas a Lumen y pierdes " +
            (result.lostGold || 0) +
            " oro."
        );

        updateUI();

    } catch (error) {
        console.error(
            "[V5 PLAYER DEATH]",
            error
        );

        addLog(
            "⚠ No se pudo registrar la muerte."
        );
    }
}


/* =========================================================
   IA ENEMIGA
========================================================= */

function updateEnemies(dt) {

    enemies.forEach(enemy => {

        const type =
            ENEMY_TYPES[
                enemy.type
            ];


        if (!enemy.alive) {

            enemy.respawnTimer -=
                dt;


            if (
                enemy.respawnTimer <=
                0
            ) {

                enemy.alive =
                    true;

                enemy.hp =
                    type.maxHp;

                enemy.x =
                    enemy.spawnX +
                    randomInt(-50, 50);

                enemy.y =
                    enemy.spawnY +
                    randomInt(-50, 50);

                enemy.attackTimer =
                    0;

            }


            return;
        }


        const d =
            distance(
                player,
                enemy
            );


        enemy.attackTimer -=
            dt;


        if (
            d <=
            type.aggroRange
        ) {

            if (
                d >
                type.attackRange
            ) {

                const angle =
                    Math.atan2(
                        player.y -
                        enemy.y,

                        player.x -
                        enemy.x
                    );


                enemy.x +=
                    Math.cos(angle) *
                    type.speed *
                    dt;


                enemy.y +=
                    Math.sin(angle) *
                    type.speed *
                    dt;

            }


            else if (
                enemy.attackTimer <=
                0
            ) {

                enemy.attackTimer =
                    type.attackCooldown;


                const damage =
                    Math.max(
                        1,
                        type.attack -
                        getDefense()
                    );


                player.hp -=
                    damage;


                addLog(
                    "💥 " +
                    type.name +
                    " te golpea por " +
                    damage +
                    "."
                );


                if (
                    player.hp <= 0
                ) {

                    playerDeath();

                }

            }

        }

    });

}


/* =========================================================
   MOVIMIENTO
========================================================= */

function updatePlayer(dt) {

    let dx = 0;
    let dy = 0;


    if (
        keys["d"] ||
        keys["arrowright"]
    ) dx++;


    if (
        keys["a"] ||
        keys["arrowleft"]
    ) dx--;


    if (
        keys["s"] ||
        keys["arrowdown"]
    ) dy++;


    if (
        keys["w"] ||
        keys["arrowup"]
    ) dy--;


    if (
        dx !== 0 ||
        dy !== 0
    ) {

        const length =
            Math.hypot(dx, dy);


        player.x +=
            dx /
            length *
            getSpeed() *
            dt;


        player.y +=
            dy /
            length *
            getSpeed() *
            dt;

    }


    player.x =
        clamp(
            player.x,
            25,
            WORLD_DATA.width - 25
        );


    player.y =
        clamp(
            player.y,
            25,
            WORLD_DATA.height - 25
        );

}


/* =========================================================
   CÁMARA
========================================================= */

function updateCamera() {

    camera.x =
        player.x -
        VIEW_WIDTH / 2;


    camera.y =
        player.y -
        VIEW_HEIGHT / 2;


    camera.x =
        clamp(
            camera.x,
            0,
            WORLD_DATA.width -
            VIEW_WIDTH
        );


    camera.y =
        clamp(
            camera.y,
            0,
            WORLD_DATA.height -
            VIEW_HEIGHT
        );

}


/* =========================================================
   UPDATE
========================================================= */

function update(dt) {

    attackCooldown =
        Math.max(
            0,
            attackCooldown - dt
        );


    autoSaveTimer += dt;


    updatePlayer(dt);

    updateEnemies(dt);

    updateCamera();

    updateZone();


    multiplayerSendTimer += dt;

    if (multiplayerSendTimer >= 0.12) {
        multiplayerSendTimer = 0;
        sendMultiplayerPosition();
    }


    if (
        autoSaveTimer >=
        15
    ) {

        autoSaveTimer = 0;

        saveGame(false);

    }

}


/* =========================================================
   CONVERSIÓN WORLD → SCREEN
========================================================= */

function screenX(worldX) {
    return worldX - camera.x;
}

function screenY(worldY) {
    return worldY - camera.y;
}


/* =========================================================
   RECTÁNGULO
========================================================= */

function drawRect(
    x,
    y,
    width,
    height,
    color
) {

    ctx.fillStyle = color;

    ctx.fillRect(
        Math.round(x),
        Math.round(y),
        width,
        height
    );

}


/* =========================================================
   TEXTO
========================================================= */

function drawText(
    text,
    x,
    y,
    color = "#fff",
    size = 12
) {

    ctx.fillStyle =
        color;

    ctx.font =
        size + "px monospace";

    ctx.fillText(
        text,
        Math.round(x),
        Math.round(y)
    );

}


/* =========================================================
   MAPA
========================================================= */


/* =========================================================
   V5.5.1 - MUNDO PIXEL MMORPG (REFERENCIA OFICIAL)
========================================================= */

function v55Hash(x, y, salt = 0) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
    return n - Math.floor(n);
}

function v55TileRect(wx, wy, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
        Math.round(screenX(wx)),
        Math.round(screenY(wy)),
        w,
        h
    );
}

function v55DrawGrass() {
    const tile = 32;
    const firstX = Math.floor(camera.x / tile) * tile - tile;
    const firstY = Math.floor(camera.y / tile) * tile - tile;
    const endX = camera.x + VIEW_WIDTH + tile;
    const endY = camera.y + VIEW_HEIGHT + tile;

    for (let wx = firstX; wx < endX; wx += tile) {
        for (let wy = firstY; wy < endY; wy += tile) {
            const r = v55Hash(wx / tile, wy / tile, 1);
            const c = r > .72 ? "#4f913d" : r > .38 ? "#43843a" : "#397735";
            v55TileRect(wx, wy, tile + 1, tile + 1, c);

            if (r > .83) {
                const sx = screenX(wx) + 7 + Math.floor(r * 11);
                const sy = screenY(wy) + 8 + Math.floor(r * 9);
                ctx.fillStyle = "#7fbd4c";
                ctx.fillRect(sx, sy, 3, 5);
                ctx.fillStyle = "#f0d65d";
                ctx.fillRect(sx + 2, sy - 1, 2, 2);
            }
        }
    }
}

function v55DrawStonePath(x, y, w, h) {
    ctx.fillStyle = "#9c927d";
    ctx.fillRect(screenX(x), screenY(y), w, h);

    const step = 24;
    for (let px = x; px < x + w; px += step) {
        for (let py = y; py < y + h; py += 16) {
            const sx = screenX(px) + ((Math.floor(py / 16) % 2) * 8);
            const sy = screenY(py);
            ctx.strokeStyle = "#746e61";
            ctx.strokeRect(sx, sy, 22, 14);
        }
    }
}

function v55DrawTree(wx, wy, autumn = false) {
    const x = screenX(wx), y = screenY(wy);
    ctx.fillStyle = "#5b3a22";
    ctx.fillRect(x - 5, y + 8, 10, 25);
    ctx.fillStyle = autumn ? "#b95b25" : "#1e5b32";
    ctx.fillRect(x - 22, y - 18, 44, 35);
    ctx.fillStyle = autumn ? "#df7a2b" : "#287743";
    ctx.fillRect(x - 16, y - 29, 32, 25);
    ctx.fillStyle = autumn ? "#ef9b38" : "#3c9650";
    ctx.fillRect(x - 9, y - 35, 18, 16);
    ctx.fillStyle = "#73b85a";
    ctx.fillRect(x - 16, y - 22, 5, 5);
}

function v55DrawRock(wx, wy) {
    const x = screenX(wx), y = screenY(wy);
    ctx.fillStyle = "#58656a";
    ctx.fillRect(x - 12, y - 7, 24, 15);
    ctx.fillStyle = "#748186";
    ctx.fillRect(x - 7, y - 12, 14, 7);
    ctx.fillStyle = "#929b98";
    ctx.fillRect(x - 5, y - 10, 6, 4);
}

function v55DrawFlowerPatch(wx, wy) {
    const colors = ["#f3d35a","#ef6f91","#f4f0e5","#b783df"];
    for (let i = 0; i < 9; i++) {
        const ox = (i * 13) % 30 - 15;
        const oy = (i * 19) % 24 - 12;
        ctx.fillStyle = "#275f31";
        ctx.fillRect(screenX(wx)+ox, screenY(wy)+oy, 2, 5);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(screenX(wx)+ox-1, screenY(wy)+oy-2, 4, 3);
    }
}

function v55DrawHouse(wx, wy, roof = "#315d9b", shop = false) {
    const x = screenX(wx), y = screenY(wy);

    ctx.fillStyle = "#d0b68b";
    ctx.fillRect(x, y + 24, 112, 74);

    ctx.fillStyle = "#6c4a31";
    ctx.fillRect(x + 7, y + 34, 8, 64);
    ctx.fillRect(x + 96, y + 34, 8, 64);

    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 30);
    ctx.lineTo(x + 56, y - 8);
    ctx.lineTo(x + 122, y + 30);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#223b63";
    for (let ry = 10; ry < 31; ry += 8) {
        for (let rx = 0; rx < 112; rx += 18) {
            ctx.fillRect(x + rx + (ry % 16), y + ry, 14, 5);
        }
    }

    ctx.fillStyle = "#5c351f";
    ctx.fillRect(x + 45, y + 62, 24, 36);
    ctx.fillStyle = "#f4b942";
    ctx.fillRect(x + 62, y + 78, 3, 3);

    ctx.fillStyle = "#6eb6d8";
    ctx.fillRect(x + 19, y + 51, 18, 17);
    ctx.fillRect(x + 77, y + 51, 18, 17);
    ctx.strokeStyle = "#efe4c5";
    ctx.strokeRect(x + 19, y + 51, 18, 17);
    ctx.strokeRect(x + 77, y + 51, 18, 17);

    if (shop) {
        ctx.fillStyle = "#f0e7d5";
        ctx.fillRect(x + 9, y + 34, 94, 10);
        ctx.fillStyle = "#b93434";
        for (let a = 9; a < 103; a += 20) {
            ctx.fillRect(x + a, y + 34, 10, 18);
        }
    }
}

function v55DrawLamp(wx, wy) {
    const x = screenX(wx), y = screenY(wy);
    ctx.fillStyle = "#25262b";
    ctx.fillRect(x - 2, y - 18, 4, 27);
    ctx.fillStyle = "#ffb43b";
    ctx.fillRect(x - 6, y - 25, 12, 10);
    ctx.fillStyle = "rgba(255,190,65,.18)";
    ctx.beginPath();
    ctx.arc(x, y - 20, 20, 0, Math.PI * 2);
    ctx.fill();
}

function v55DrawFountain(wx, wy) {
    const x = screenX(wx), y = screenY(wy);
    ctx.fillStyle = "#777d83";
    ctx.beginPath(); ctx.ellipse(x, y, 50, 27, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#35aee5";
    ctx.beginPath(); ctx.ellipse(x, y-2, 41, 20, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#8e9498";
    ctx.fillRect(x-7, y-44, 14, 42);
    ctx.fillStyle = "#b0b5b6";
    ctx.fillRect(x-13, y-48, 26, 8);
    ctx.fillStyle = "#61d1ff";
    ctx.fillRect(x-2, y-39, 4, 30);
}

function v55DrawLumenCity() {
    // Plaza and roads patterned after the approved V5.5 reference.
    v55DrawStonePath(250, 250, 600, 600);
    v55DrawStonePath(100, 500, 1000, 110);
    v55DrawStonePath(480, 100, 110, 1000);

    // City buildings.
    v55DrawHouse(300, 305, "#315d9b", false);
    v55DrawHouse(620, 305, "#315d9b", true);
    v55DrawHouse(300, 675, "#a94b32", false);
    v55DrawHouse(620, 675, "#8b5b35", true);

    // Central fountain.
    v55DrawFountain(535, 555);

    // Decorative trees/flowerbeds.
    const trees = [
        [275,280],[820,285],[270,820],[820,815],
        [405,275],[700,275],[405,825],[700,825]
    ];
    trees.forEach((p,i)=>v55DrawTree(p[0],p[1], i===6));

    [[375,500],[690,500],[375,625],[690,625]]
        .forEach(p=>v55DrawFlowerPatch(p[0],p[1]));

    [[455,455],[610,455],[455,660],[610,660]]
        .forEach(p=>v55DrawLamp(p[0],p[1]));
}

function v55DrawWilderness() {
    // Dense forest edge similar to the approved forest panel.
    const clusters = [
        [120,180],[190,220],[1000,170],[1080,240],
        [130,950],[220,1040],[1020,960],[1110,1040],
        [1450,300],[1530,390],[1750,210],[1880,360],
        [1500,1120],[1660,1210],[1880,1060]
    ];
    clusters.forEach((p,i)=>v55DrawTree(p[0],p[1], i % 7 === 0));

    const rocks = [
        [170,360],[920,210],[1180,420],[1380,260],
        [1520,780],[1800,930],[2060,650],[1300,1280]
    ];
    rocks.forEach(p=>v55DrawRock(p[0],p[1]));

    const flowers = [
        [80,520],[180,600],[920,410],[1040,880],
        [1220,760],[1450,600],[1710,540],[1900,1160]
    ];
    flowers.forEach(p=>v55DrawFlowerPatch(p[0],p[1]));
}

function drawWorld() {
    // Full tiled grass foundation.
    v55DrawGrass();

    // Zone tinting kept subtle so gameplay zones remain readable.
    Object.values(ZONES).forEach(zone => {
        const x = screenX(zone.x);
        const y = screenY(zone.y);

        let color = "rgba(35,85,45,.10)";
        if (zone.id === "goblinCamp") color = "rgba(108,75,38,.13)";
        if (zone.id === "darkForest") color = "rgba(16,38,31,.22)";
        if (zone.id === "ruins") color = "rgba(69,67,75,.18)";

        ctx.fillStyle = color;
        ctx.fillRect(x, y, zone.width, zone.height);
    });

    v55DrawWilderness();
    drawVillage();

    // Small zone titles, less intrusive than V5.
    Object.values(ZONES).forEach(zone => {
        drawText(
            zone.icon + " " + zone.name,
            screenX(zone.x) + 18,
            screenY(zone.y) + 25,
            "#fff7d6",
            12
        );
    });
}


/* =========================================================
   ALDEA / CIUDAD DE LUMEN V5.5.1
========================================================= */

function drawVillage() {
    v55DrawLumenCity();
}


/* =========================================================
   PERSONAJE
========================================================= */

function drawCharacter(
    worldX,
    worldY,
    bodyColor,
    spriteName = "hero"
) {
    if (
        drawPixelSprite(
            spriteName,
            worldX,
            worldY - 4,
            42,
            52
        )
    ) {
        return;
    }

    // Fallback seguro si el PNG todavía no cargó.
    const x = screenX(worldX);
    const y = screenY(worldY);

    drawRect(x - 11, y - 15, 22, 28, bodyColor);
    drawRect(x - 9, y - 25, 18, 12, "#f1c27d");
    drawRect(x - 8, y - 29, 16, 6, "#3f2b1f");
    drawRect(x - 7, y + 13, 5, 7, "#111827");
    drawRect(x + 2, y + 13, 5, 7, "#111827");
}


/* =========================================================
   NPC
========================================================= */

function drawNPCs() {

    Object.values(NPCS)
        .forEach(npc => {

            drawCharacter(
                npc.x,
                npc.y,
                npc.color,
                getNpcSpriteName(npc)
            );


            drawText(
                npc.name,

                screenX(npc.x) - 20,

                screenY(npc.y) - 37,

                "#fef3c7",

                10
            );


            drawText(
                npc.role,

                screenX(npc.x) - 35,

                screenY(npc.y) + 31,

                "#cbd5e1",

                8
            );

        });

}


/* =========================================================
   ENEMIGOS
========================================================= */

function drawEnemies() {

    enemies.forEach(enemy => {

        if (!enemy.alive) return;


        const type =
            ENEMY_TYPES[
                enemy.type
            ];


        const x =
            screenX(enemy.x);

        const y =
            screenY(enemy.y);


        if (
            x < -80 ||
            x > VIEW_WIDTH + 80 ||
            y < -80 ||
            y > VIEW_HEIGHT + 80
        ) {

            return;
        }


        const enemySprite =
            getEnemySpriteName(enemy.type);

        const spriteDrawn =
            drawPixelSprite(
                enemySprite,
                enemy.x,
                enemy.y - 3,
                enemySprite === "wolf" ? 54 : 44,
                48
            );

        if (!spriteDrawn) {
            drawRect(
                x - 13,
                y - 13,
                26,
                26,
                type.color
            );

            drawRect(
                x - 8,
                y - 5,
                4,
                4,
                "#111"
            );

            drawRect(
                x + 4,
                y - 5,
                4,
                4,
                "#111"
            );
        }


        drawRect(
            x - 22,
            y - 30,
            44,
            5,
            "#111"
        );


        drawRect(
            x - 22,
            y - 30,

            44 *
            (
                enemy.hp /
                type.maxHp
            ),

            5,

            "#ef4444"
        );


        drawText(
            type.name,

            x - 30,
            y + 29,

            "#e5e7eb",

            8
        );

    });

}


/* =========================================================
   RENDER
========================================================= */

function render() {

    ctx.clearRect(
        0,
        0,
        VIEW_WIDTH,
        VIEW_HEIGHT
    );


    drawWorld();

    drawNPCs();

    remotePlayers.forEach(remote => {
        if (
            remote.zone === player.zone &&
            Number.isFinite(Number(remote.x)) &&
            Number.isFinite(Number(remote.y))
        ) {
            drawCharacter(
                Number(remote.x),
                Number(remote.y),
                "#a855f7",
                "hero"
            );

            drawText(
                remote.username || "Jugador",
                screenX(Number(remote.x)) - 24,
                screenY(Number(remote.y)) - 38,
                "#e9d5ff",
                10
            );
        }
    });

    drawEnemies();


    drawCharacter(
        player.x,
        player.y,
        "#3b82f6",
        "hero"
    );


    drawText(
        "Héroe",

        screenX(player.x) - 18,

        screenY(player.y) - 38,

        "#ffffff",

        11
    );

}


/* =========================================================
   INVENTARIO UI
========================================================= */

function renderInventory() {

    const container =
        document.getElementById(
            "inventory"
        );


    container.innerHTML = "";


    let totalItems = 0;


    Object.entries(inventory)
        .forEach(
            ([itemId, quantity]) => {

                if (quantity <= 0) return;


                totalItems +=
                    quantity;


                const item =
                    ITEMS[itemId];


                if (!item) return;


                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "inventoryItem " +
                    item.type;


                element.innerHTML =

                    "<span>" +
                    item.icon +
                    " " +
                    item.name +
                    "</span>" +

                    '<span class="quantity">x' +
                    quantity +
                    "</span>";


                element.onclick =
                    () =>
                    useInventoryItem(
                        itemId
                    );


                container.appendChild(
                    element
                );

            }
        );


    document
        .getElementById(
            "inventorySpace"
        )
        .textContent =

        totalItems +
        " / 20";

}


/* =========================================================
   EQUIPMENT UI
========================================================= */

function renderEquipment() {

    const slots = {
        weapon:
            "weaponSlot",
        armor:
            "armorSlot",
        helmet:
            "helmetSlot",
        boots:
            "bootsSlot"
    };


    Object.entries(slots)
        .forEach(
            ([slot, elementId]) => {

                const itemId =
                    equipment[slot];

                const element =
                    document.getElementById(
                        elementId
                    );

                if (!element) {
                    return;
                }

                const item =
                    itemId
                        ? ITEMS[itemId]
                        : null;

                element.textContent =
                    item
                        ? item.name + " · clic para quitar"
                        : "Vacío";

                element.onclick =
                    itemId
                        ? () => unequipItem(slot)
                        : null;

                element.style.cursor =
                    itemId
                        ? "pointer"
                        : "default";

                element.title =
                    itemId
                        ? "Clic para desequipar"
                        : "";
            }
        );
}


/* =========================================================
   QUEST UI
========================================================= */

function renderQuest() {

    const quest =
        getCurrentQuest();


    if (!quest) {

        document
            .getElementById(
                "questName"
            )
            .textContent =
            "Sin misión";


        document
            .getElementById(
                "questDescription"
            )
            .textContent =
            "Has completado el contenido de V3.";


        document
            .getElementById(
                "questProgress"
            )
            .textContent =
            "✓";


        return;
    }


    document
        .getElementById(
            "questName"
        )
        .textContent =
        quest.name;


    document
        .getElementById(
            "questDescription"
        )
        .textContent =
        quest.description;


    document
        .getElementById(
            "questProgress"
        )
        .textContent =

        Math.min(
            questState.progress,
            quest.amount
        ) +
        " / " +
        quest.amount;

}


/* =========================================================
   TARGET UI
========================================================= */

function renderTarget() {

    const targetName =
        document.getElementById(
            "targetName"
        );


    const targetBar =
        document.getElementById(
            "targetHpBar"
        );


    if (
        !currentTarget ||
        !currentTarget.alive
    ) {

        targetName.textContent =
            "Ningún objetivo";

        targetBar.style.width =
            "0%";

        return;
    }


    const type =
        ENEMY_TYPES[
            currentTarget.type
        ];


    targetName.textContent =

        type.name +
        " · " +
        Math.max(
            0,
            Math.ceil(
                currentTarget.hp
            )
        ) +
        "/" +
        type.maxHp;


    targetBar.style.width =

        (
            currentTarget.hp /
            type.maxHp *
            100
        ) +
        "%";

}


/* =========================================================
   UI GENERAL
========================================================= */

function updateUI() {

    document
        .getElementById(
            "levelValue"
        )
        .textContent =
        player.level;


    document
        .getElementById(
            "attackValue"
        )
        .textContent =
        getAttack();


    document
        .getElementById(
            "defenseValue"
        )
        .textContent =
        getDefense();


    document
        .getElementById(
            "goldValue"
        )
        .textContent =
        player.gold;


    document
        .getElementById(
            "hpText"
        )
        .textContent =

        Math.ceil(
            player.hp
        ) +
        " / " +
        player.maxHp;


    document
        .getElementById(
            "hpBar"
        )
        .style.width =

        (
            player.hp /
            player.maxHp *
            100
        ) +
        "%";


    document
        .getElementById(
            "manaText"
        )
        .textContent =

        player.mana +
        " / " +
        player.maxMana;


    document
        .getElementById(
            "manaBar"
        )
        .style.width =

        (
            player.mana /
            player.maxMana *
            100
        ) +
        "%";


    document
        .getElementById(
            "xpText"
        )
        .textContent =

        player.xp +
        " / " +
        player.nextXp;


    document
        .getElementById(
            "xpBar"
        )
        .style.width =

        (
            player.xp /
            player.nextXp *
            100
        ) +
        "%";


    document
        .getElementById(
            "playerMini"
        )
        .textContent =

        "Nv. " +
        player.level +
        " · ❤️ " +
        Math.ceil(
            player.hp
        ) +
        "/" +
        player.maxHp +
        " · 💰 " +
        player.gold;


    renderTarget();

}


/* =========================================================
   GUARDAR V4
========================================================= */

let serverSaveInProgress = false;


/* =========================================================
   GUARDAR PERSONAJE EN POSTGRESQL
========================================================= */

async function saveCharacterToServer(
    showMessage = false
) {

    // ------------------------------------------
    // COMPROBAR SESIÓN
    // ------------------------------------------

    if (
        !window.ETHERIAL_SESSION ||
        !window.ETHERIAL_SESSION.character
    ) {

        return;

    }


    // ------------------------------------------
    // EVITAR GUARDADOS SIMULTÁNEOS
    // ------------------------------------------

    if (serverSaveInProgress) {

        return;

    }


    // ------------------------------------------
    // COMPROBAR API
    // ------------------------------------------

    if (
        typeof EtherialAPI === "undefined" ||
        typeof EtherialAPI.saveCharacter !== "function"
    ) {

        console.warn(
            "[V4] EtherialAPI no disponible."
        );

        return;

    }


    serverSaveInProgress = true;


    try {

        // --------------------------------------
        // SOLO DATOS PERMITIDOS POR EL SERVIDOR
        // --------------------------------------

        const characterState = {

            hp:
                Math.floor(
                    player.hp
                ),

            mana:
                Math.floor(
                    player.mana
                ),

            x:
                player.x,

            y:
                player.y,

            zone:
                player.zone

        };


        // --------------------------------------
        // ENVIAR A RENDER / POSTGRESQL
        // --------------------------------------

        const result =
            await EtherialAPI.saveCharacter(
                characterState
            );


        // --------------------------------------
        // GUARDADO CORRECTO
        // --------------------------------------

        if (
            result &&
            result.success === true
        ) {

            console.log(
                "💾 Personaje guardado en PostgreSQL:",
                result.character
            );


            if (showMessage) {

                addLog(
                    "☁ Progreso guardado en el servidor."
                );

            }

        }


    } catch (error) {

        console.error(
            "[V4 SERVER SAVE]",
            error
        );


        if (showMessage) {

            addLog(
                "⚠ No se pudo guardar en el servidor."
            );

        }


    } finally {

        serverSaveInProgress =
            false;

    }

}


/* =========================================================
   GUARDAR PARTIDA
========================================================= */

function saveGame(
    showMessage = true
) {

    // ------------------------------------------
    // GUARDADO LOCAL V3
    // ------------------------------------------

    const save = {

        inventory,

        equipment

    };


    try {

        // --------------------------------------
        // LOCALSTORAGE
        // --------------------------------------

        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(save)
        );


        // --------------------------------------
        // POSTGRESQL V4
        // --------------------------------------

        saveCharacterToServer(
            showMessage
        );


        // --------------------------------------
        // MENSAJE LOCAL
        // --------------------------------------

        if (showMessage) {

            addLog(
                "💾 Partida guardada."
            );

        }


    } catch (error) {

        console.error(
            "[LOCAL SAVE ERROR]",
            error
        );


        addLog(
            "⚠ Error guardando la partida."
        );

    }

}


/* =========================================================
   CARGAR
========================================================= */

function loadGame() {

    try {

        const raw =
            localStorage.getItem(
                SAVE_KEY
            );


        if (!raw) {

            return false;

        }


        const data =
            JSON.parse(raw);


        if (data.player) {

            Object.assign(
                player,
                data.player
            );

        }
if (data.questState) {

            questState =
                data.questState;

        }


        return true;

    }

    catch (error) {

        return false;

    }

}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

    const answer =
        confirm(
            "¿Quieres borrar los datos locales de V4.3?"
        );


    if (!answer) return;


    localStorage.removeItem(
        SAVE_KEY
    );


    location.reload();

}


/* =========================================================
   EVENTOS TECLADO
========================================================= */

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        keys[key] = true;


        if (
            [
                " ",
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright"
            ]
            .includes(key)
        ) {

            event.preventDefault();

        }


        if (event.repeat) return;


        if (key === " ") {

            attack();

        }


        if (key === "e") {

            interact();

        }


        if (key === "p") {

            usePotion();

        }


        if (key === "r") {

            saveGame();

        }

    }
);


window.addEventListener(
    "keyup",
    event => {

        keys[
            event.key.toLowerCase()
        ] = false;

    }
);


/* =========================================================
   BOTONES
========================================================= */

document
    .getElementById(
        "attackButton"
    )
    .onclick =
    attack;


document
    .getElementById(
        "interactButton"
    )
    .onclick =
    interact;


document
    .getElementById(
        "potionButton"
    )
    .onclick =
    usePotion;


document
    .getElementById(
        "saveButton"
    )
    .onclick =
    () =>
    saveGame(true);


document
    .getElementById(
        "resetButton"
    )
    .onclick =
    resetGame;


document
    .getElementById(
        "closeDialog"
    )
    .onclick =
    closeDialog;


document
    .getElementById(
        "closeShop"
    )
    .onclick =
    closeShop;


/* =========================================================
   CONTROLES MÓVILES
========================================================= */

document
    .querySelectorAll(
        ".moveButton"
    )
    .forEach(button => {

        const key =
            button.dataset.key;


        button.addEventListener(
            "pointerdown",
            event => {

                event.preventDefault();

                keys[key] =
                    true;

            }
        );


        const stop =
            event => {

                event.preventDefault();

                keys[key] =
                    false;

            };


        button.addEventListener(
            "pointerup",
            stop
        );


        button.addEventListener(
            "pointercancel",
            stop
        );


        button.addEventListener(
            "pointerleave",
            stop
        );

    });


/* =========================================================
   LOOP
========================================================= */

function gameLoop(time) {

    const dt =
        Math.min(
            (
                time -
                lastTime
            ) /
            1000,
            0.05
        );


    lastTime = time;


    update(dt);

    render();

    updateUI();


    requestAnimationFrame(
        gameLoop
    );

}


/* =========================================================
   INICIALIZAR
========================================================= */

const loaded =
    loadGame();


if (loaded) {

    addLog(
        "💾 Datos locales V4.3 cargados."
    );

}

else {

    addLog(
        "🌟 Bienvenido a Reinos de Etherial V4.3."
    );


    addLog(
        "📜 Busca a Aldric en Aldea de Lumen."
    );

}


renderInventory();

renderEquipment();

renderQuest();

updateCamera();

updateZone();

updateUI();


requestAnimationFrame(
    gameLoop
);
