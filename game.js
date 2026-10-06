/* =========================================================
   REINOS DE ETHERIAL V5.0
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

function drawWorld() {

    drawRect(
        0,
        0,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        "#17351f"
    );


    /* CUADRÍCULA */

    ctx.strokeStyle =
        "#214a2c";


    const gridSize = 64;


    const startX =
        -(
            camera.x %
            gridSize
        );


    const startY =
        -(
            camera.y %
            gridSize
        );


    for (
        let x = startX;
        x < VIEW_WIDTH;
        x += gridSize
    ) {

        for (
            let y = startY;
            y < VIEW_HEIGHT;
            y += gridSize
        ) {

            ctx.strokeRect(
                x,
                y,
                gridSize,
                gridSize
            );

        }

    }


    /* ZONAS */

    Object.values(ZONES)
        .forEach(zone => {

            const x =
                screenX(zone.x);

            const y =
                screenY(zone.y);


            let color =
                "#24462d";


            if (
                zone.id ===
                "lumen"
            ) {
                color = "#31543a";
            }


            if (
                zone.id ===
                "goblinCamp"
            ) {
                color = "#4a3925";
            }


            if (
                zone.id ===
                "darkForest"
            ) {
                color = "#192b28";
            }


            if (
                zone.id ===
                "ruins"
            ) {
                color = "#45434b";
            }


            ctx.fillStyle = color;

            ctx.globalAlpha = 0.45;


            ctx.fillRect(
                x,
                y,
                zone.width,
                zone.height
            );


            ctx.globalAlpha = 1;


            drawText(
                zone.icon +
                " " +
                zone.name,

                x + 20,
                y + 30,

                "#ffffffaa",

                14
            );

        });


    drawVillage();

}


/* =========================================================
   ALDEA
========================================================= */

function drawVillage() {

    const houses = [

        [330, 340],
        [470, 330],
        [610, 350],
        [330, 620],
        [620, 620]

    ];


    houses.forEach(
        ([x, y]) => {

            const sx =
                screenX(x);

            const sy =
                screenY(y);


            drawRect(
                sx,
                sy,
                90,
                65,
                "#754a32"
            );


            drawRect(
                sx - 8,
                sy - 18,
                106,
                22,
                "#4b2f24"
            );


            drawRect(
                sx + 36,
                sy + 35,
                20,
                30,
                "#31251f"
            );

        }
    );


    /* FUENTE */

    const fountainX =
        screenX(520);

    const fountainY =
        screenY(560);


    drawRect(
        fountainX - 25,
        fountainY - 12,
        50,
        24,
        "#64748b"
    );


    drawRect(
        fountainX - 18,
        fountainY - 8,
        36,
        16,
        "#38bdf8"
    );

}


/* =========================================================
   PERSONAJE
========================================================= */

function drawCharacter(
    worldX,
    worldY,
    bodyColor
) {

    const x =
        screenX(worldX);

    const y =
        screenY(worldY);


    drawRect(
        x - 11,
        y - 15,
        22,
        28,
        bodyColor
    );


    drawRect(
        x - 9,
        y - 25,
        18,
        12,
        "#f1c27d"
    );


    drawRect(
        x - 8,
        y - 29,
        16,
        6,
        "#3f2b1f"
    );


    drawRect(
        x - 7,
        y + 13,
        5,
        7,
        "#111827"
    );


    drawRect(
        x + 2,
        y + 13,
        5,
        7,
        "#111827"
    );

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
                npc.color
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
                "#a855f7"
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
        "#3b82f6"
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
