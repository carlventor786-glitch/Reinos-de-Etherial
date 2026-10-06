/* =========================================================
   REINOS DE ETHERIAL V3
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

const SAVE_KEY = "reinos_etherial_v3_save";


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
    }
);


// Permitir acceso futuro desde auth.js
window.EtherialGame = {
    applyServerCharacter
};

/* =========================================================
   INVENTARIO
========================================================= */

let inventory = {
    ...STARTING_INVENTORY
};


/* =========================================================
   EQUIPAMIENTO
========================================================= */

let equipment = {
    ...STARTING_EQUIPMENT
};


/* =========================================================
   MISIÓN
========================================================= */

let questState = {

    current: "introduction",

    progress: 0,

    completed: false
};


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

function useInventoryItem(itemId) {

    const item =
        ITEMS[itemId];

    if (!item) return;


    if (item.type === "consumable") {

        if (item.heal) {

            if (player.hp >= player.maxHp) {

                addLog(
                    "❤️ Ya tienes la vida completa."
                );

                return;
            }

            const amount =
                Math.min(
                    item.heal,
                    player.maxHp - player.hp
                );

            player.hp += amount;

            removeItem(itemId, 1);

            addLog(
                "🧪 Recuperas " +
                amount +
                " HP."
            );

        }


        else if (item.mana) {

            if (player.mana >= player.maxMana) {

                addLog(
                    "🔷 Ya tienes el mana completo."
                );

                return;
            }

            const amount =
                Math.min(
                    item.mana,
                    player.maxMana - player.mana
                );

            player.mana += amount;

            removeItem(itemId, 1);

            addLog(
                "🔷 Recuperas " +
                amount +
                " de mana."
            );

        }

        saveGame(false);
        updateUI();

        return;
    }


    const validEquipment = [
        "weapon",
        "armor",
        "helmet",
        "boots"
    ];


    if (
        validEquipment.includes(
            item.type
        )
    ) {

        equipItem(itemId);
    }

}


/* =========================================================
   EQUIPAR
========================================================= */

function equipItem(itemId) {

    const item =
        ITEMS[itemId];

    if (!item) return;

    const slot =
        item.type;

    if (!inventory[itemId]) {
        return;
    }


    const previousItem =
        equipment[slot];


    removeItem(itemId, 1);


    if (previousItem) {

        if (!inventory[previousItem]) {
            inventory[previousItem] = 0;
        }

        inventory[previousItem]++;
    }


    equipment[slot] =
        itemId;


    addLog(
        "⚔ Equipaste " +
        item.name +
        "."
    );


    renderInventory();
    renderEquipment();

    saveGame(false);
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

function killEnemy(enemy) {

    const type =
        ENEMY_TYPES[enemy.type];


    enemy.alive = false;

    enemy.hp = 0;

    enemy.respawnTimer =
        randomInt(7, 12);


    const gold =
        randomInt(
            type.goldMin,
            type.goldMax
        );


    player.gold += gold;

    player.xp += type.xp;

    player.kills++;


    addLog(
        "☠ " +
        type.name +
        " derrotado. +" +
        type.xp +
        " EXP · +" +
        gold +
        " oro."
    );


    processLoot(type);

    processQuestKill(
        enemy.type
    );

    checkLevelUp();

    currentTarget = null;

    saveGame(false);
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


function processQuestKill(
    enemyType
) {

    const quest =
        getCurrentQuest();


    if (!quest) return;

    if (
        quest.type !== "kill"
    ) {
        return;
    }


    if (
        quest.target !==
        enemyType
    ) {
        return;
    }


    questState.progress++;


    if (
        questState.progress >=
        quest.amount
    ) {

        completeQuest();

    }

}


function processQuestTalk(
    npcId
) {

    const quest =
        getCurrentQuest();


    if (!quest) return;


    if (
        quest.type === "talk" &&
        quest.target === npcId
    ) {

        questState.progress = 1;

        completeQuest();

    }

}


/* =========================================================
   COMPLETAR MISIÓN
========================================================= */

function completeQuest() {

    const quest =
        getCurrentQuest();


    if (!quest) return;


    player.gold +=
        quest.reward.gold || 0;


    player.xp +=
        quest.reward.xp || 0;


    if (quest.reward.items) {

        Object.entries(
            quest.reward.items
        )
        .forEach(
            ([itemId, amount]) => {

                addItem(
                    itemId,
                    amount
                );

            }
        );

    }


    addLog(
        "🏆 Misión completada: " +
        quest.name
    );


    checkLevelUp();


    if (quest.next) {

        questState.current =
            quest.next;

        questState.progress =
            0;

        questState.completed =
            false;


        addLog(
            "📜 Nueva misión: " +
            QUESTS[quest.next].name
        );

    }

    else {

        questState.completed =
            true;

        addLog(
            "👑 ¡Has completado todas las misiones de V3!"
        );

    }


    saveGame(false);

    renderQuest();

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

function interact() {

    const npc =
        getNearestNPC();


    if (!npc) {

        addLog(
            "💬 No hay nadie cerca."
        );

        return;
    }


    openDialog(npc);

    processQuestTalk(
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

function openShop() {

    const container =
        document.getElementById(
            "shopItems"
        );


    container.innerHTML = "";


    SHOP_ITEMS.forEach(
        shopEntry => {

            const item =
                ITEMS[
                    shopEntry.item
                ];


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
                shopEntry.price +
                " oro</div>";


            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "shopButton";


            button.textContent =
                "Comprar";


            button.onclick = () => {

                buyItem(
                    shopEntry.item,
                    shopEntry.price
                );

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


    document
        .getElementById(
            "shopGold"
        )
        .textContent =
        player.gold;


    document
        .getElementById(
            "shopWindow"
        )
        .classList.remove(
            "hidden"
        );

}


function closeShop() {

    document
        .getElementById(
            "shopWindow"
        )
        .classList.add(
            "hidden"
        );

}


function buyItem(
    itemId,
    price
) {

    if (
        player.gold <
        price
    ) {

        addLog(
            "💰 No tienes suficiente oro."
        );

        return;
    }


    player.gold -= price;


    addItem(
        itemId,
        1
    );


    document
        .getElementById(
            "shopGold"
        )
        .textContent =
        player.gold;


    addLog(
        "🏪 Compraste " +
        ITEMS[itemId].name +
        "."
    );


    updateUI();

    saveGame(false);

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

function playerDeath() {

    const lostGold =
        Math.min(
            player.gold,
            Math.floor(
                player.gold * 0.10
            ) + 10
        );


    player.gold -=
        lostGold;


    player.x =
        WORLD_DATA.startX;

    player.y =
        WORLD_DATA.startY;


    player.hp =
        player.maxHp;


    player.mana =
        player.maxMana;


    addLog(
        "💀 Has caído. Regresas a Lumen y pierdes " +
        lostGold +
        " oro."
    );


    saveGame(false);

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


                document
                    .getElementById(
                        elementId
                    )
                    .textContent =

                    itemId
                    ? ITEMS[itemId].name
                    : "Vacío";

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
   GUARDAR
========================================================= */

function saveGame(
    showMessage = true
) {

    const save = {

        player,
        inventory,
        equipment,
        questState

    };


    try {

        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(save)
        );


        if (showMessage) {

            addLog(
                "💾 Partida guardada."
            );

        }

    }

    catch (error) {

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


        if (data.inventory) {

            inventory =
                data.inventory;

        }


        if (data.equipment) {

            equipment =
                data.equipment;

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
            "¿Quieres borrar todo el progreso de V3?"
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
        "💾 Partida V3 cargada."
    );

}

else {

    addLog(
        "🌟 Bienvenido a Reinos de Etherial V3."
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
