/* ==========================================================
   REINOS DE ETHERIAL V2
   MOTOR PRINCIPAL DEL JUEGO
========================================================== */

(() => {

"use strict";

/* ==========================================================
   CANVAS
========================================================== */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const SAVE_KEY = "reinos_etherial_v2_save";


/* ==========================================================
   ESTADO DEL TECLADO
========================================================== */

const keys = {};

let lastTime = performance.now();
let attackCooldown = 0;
let autoSaveTimer = 0;


/* ==========================================================
   JUGADOR
========================================================== */

const player = {

    x: 300,
    y: 280,

    width: 22,
    height: 28,

    hp: 100,
    maxHp: 100,

    mana: 50,
    maxMana: 50,

    level: 1,

    xp: 0,
    nextXp: 100,

    gold: 50,

    damage: 18,

    speed: 190,

    kills: 0
};


/* ==========================================================
   INVENTARIO
========================================================== */

const inventory = {

    potion: 3,

    wood: 0,

    iron: 0,

    crystal: 0,

    wolfFang: 0
};


/* ==========================================================
   MISIÓN PRINCIPAL
========================================================== */

const quest = {

    name: "Primeros pasos",

    target: 5,

    progress: 0,

    rewardGold: 100,

    rewardXp: 80,

    completed: false
};


/* ==========================================================
   CREAR ENEMIGOS
========================================================== */

function createEnemy(
    x,
    y,
    name,
    hp,
    damage,
    xp,
    gold
) {

    return {

        x,
        y,

        name,

        hp,
        maxHp: hp,

        damage,

        xp,

        gold,

        alive: true,

        respawnTimer: 0,

        attackTimer: 0
    };
}


/* ==========================================================
   ENEMIGOS DEL MAPA
========================================================== */

const enemies = [

    createEnemy(
        600,
        180,
        "Slime Verde",
        45,
        5,
        30,
        8
    ),

    createEnemy(
        720,
        350,
        "Lobo Sombrío",
        60,
        8,
        45,
        12
    ),

    createEnemy(
        520,
        410,
        "Goblin",
        35,
        7,
        35,
        10
    ),

    createEnemy(
        820,
        300,
        "Goblin",
        35,
        7,
        35,
        10
    ),

    createEnemy(
        650,
        450,
        "Slime Verde",
        45,
        5,
        30,
        8
    )
];


/* ==========================================================
   REGISTRO DE EVENTOS
========================================================== */

const gameLogs = [];


function addLog(message) {

    gameLogs.unshift(message);

    if (gameLogs.length > 8) {

        gameLogs.pop();

    }

    renderGameLog();
}


function renderGameLog() {

    const gameLog =
        document.getElementById("gameLog");

    gameLog.innerHTML = "";

    gameLogs.forEach(message => {

        const p =
            document.createElement("p");

        p.textContent = message;

        gameLog.appendChild(p);

    });
}


/* ==========================================================
   GUARDAR PARTIDA
========================================================== */

function saveGame(showMessage = true) {

    try {

        const saveData = {

            player: player,

            inventory: inventory,

            quest: quest
        };

        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(saveData)
        );

        if (showMessage) {

            addLog(
                "💾 Progreso guardado."
            );

        }

    }

    catch (error) {

        if (showMessage) {

            addLog(
                "⚠ No se pudo guardar la partida."
            );

        }

    }
}


/* ==========================================================
   CARGAR PARTIDA
========================================================== */

function loadGame() {

    try {

        const saved =
            localStorage.getItem(
                SAVE_KEY
            );

        if (!saved) {

            return false;

        }

        const data =
            JSON.parse(saved);


        if (data.player) {

            Object.assign(
                player,
                data.player
            );

        }


        if (data.inventory) {

            Object.assign(
                inventory,
                data.inventory
            );

        }


        if (data.quest) {

            Object.assign(
                quest,
                data.quest
            );

        }


        return true;

    }

    catch (error) {

        return false;

    }
}


/* ==========================================================
   REINICIAR PARTIDA
========================================================== */

function resetGame() {

    const confirmation =
        confirm(
            "¿Seguro que quieres borrar todo el progreso?"
        );

    if (!confirmation) {

        return;

    }


    localStorage.removeItem(
        SAVE_KEY
    );


    location.reload();
}


/* ==========================================================
   TECLADO
========================================================== */

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

        keys[key] = true;


        if (
            key === " " ||
            key === "arrowup" ||
            key === "arrowdown" ||
            key === "arrowleft" ||
            key === "arrowright"
        ) {

            event.preventDefault();

        }


        if (event.repeat) {

            return;

        }


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


/* ==========================================================
   BOTONES
========================================================== */

document
    .getElementById(
        "attackButton"
    )
    .addEventListener(
        "click",
        attack
    );


document
    .getElementById(
        "potionButton"
    )
    .addEventListener(
        "click",
        usePotion
    );


document
    .getElementById(
        "resetButton"
    )
    .addEventListener(
        "click",
        resetGame
    );


/* ==========================================================
   CONTROLES MÓVILES
========================================================== */

document
    .querySelectorAll(
        ".moveButton"
    )
    .forEach(button => {

        const key =
            button.dataset.key;


        const startMove =
            event => {

                event.preventDefault();

                keys[key] = true;

            };


        const stopMove =
            event => {

                event.preventDefault();

                keys[key] = false;

            };


        button.addEventListener(
            "pointerdown",
            startMove
        );


        button.addEventListener(
            "pointerup",
            stopMove
        );


        button.addEventListener(
            "pointercancel",
            stopMove
        );


        button.addEventListener(
            "pointerleave",
            stopMove
        );

    });


/* ==========================================================
   DISTANCIA
========================================================== */

function distance(
    objectA,
    objectB
) {

    return Math.hypot(

        objectA.x -
        objectB.x,

        objectA.y -
        objectB.y

    );
}


/* ==========================================================
   NÚMERO ALEATORIO
========================================================== */

function randomInt(
    min,
    max
) {

    return Math.floor(

        Math.random() *
        (max - min + 1)

    ) + min;
}


/* ==========================================================
   LIMITAR VALOR
========================================================== */

function clamp(
    value,
    min,
    max
) {

    return Math.max(

        min,

        Math.min(
            max,
            value
        )

    );
}


/* ==========================================================
   ATAQUE DEL JUGADOR
========================================================== */

function attack() {

    if (
        attackCooldown > 0
    ) {

        return;

    }


    attackCooldown =
        0.45;


    let target = null;

    let closestDistance =
        Infinity;


    enemies.forEach(enemy => {

        if (!enemy.alive) {

            return;

        }


        const enemyDistance =
            distance(
                player,
                enemy
            );


        if (
            enemyDistance < 72 &&
            enemyDistance <
            closestDistance
        ) {

            target = enemy;

            closestDistance =
                enemyDistance;

        }

    });


    if (!target) {

        addLog(
            "⚔ No hay enemigo al alcance."
        );

        return;

    }


    const attackDamage =

        Math.max(

            1,

            player.damage +
            randomInt(
                -3,
                4
            )

        );


    target.hp -=
        attackDamage;


    addLog(

        "⚔ Golpeas a " +
        target.name +
        " por " +
        attackDamage +
        " de daño."

    );


    if (
        target.hp <= 0
    ) {

        defeatEnemy(
            target
        );

    }


    updateInterface();
}


/* ==========================================================
   ENEMIGO DERROTADO
========================================================== */

function defeatEnemy(enemy) {

    enemy.alive =
        false;


    enemy.respawnTimer =

        5 +
        Math.random() *
        4;


    const goldReward =

        enemy.gold +
        randomInt(
            0,
            7
        );


    player.gold +=
        goldReward;


    player.xp +=
        enemy.xp;


    player.kills++;


    quest.progress =

        Math.min(

            quest.target,

            quest.progress + 1

        );


    /* LOOT */

    if (
        enemy.name ===
        "Goblin"
    ) {

        if (
            Math.random() <
            0.55
        ) {

            inventory.iron++;

            addLog(
                "🎒 Encontraste Hierro."
            );

        }

    }


    if (
        enemy.name ===
        "Slime Verde"
    ) {

        if (
            Math.random() <
            0.55
        ) {

            inventory.wood++;

            addLog(
                "🎒 Encontraste Madera."
            );

        }

    }


    if (
        enemy.name ===
        "Lobo Sombrío"
    ) {

        if (
            Math.random() <
            0.65
        ) {

            inventory.wolfFang++;

            addLog(
                "🎒 Encontraste Colmillo de Lobo."
            );

        }

    }


    addLog(

        "☠ " +
        enemy.name +
        " derrotado. +" +
        goldReward +
        " oro · +" +
        enemy.xp +
        " EXP."

    );


    checkLevelUp();


    /* COMPLETAR MISIÓN */

    if (
        !quest.completed &&
        quest.progress >=
        quest.target
    ) {

        completeQuest();

    }


    saveGame(false);

}


/* ==========================================================
   COMPLETAR MISIÓN
========================================================== */

function completeQuest() {

    quest.completed =
        true;


    player.gold +=
        quest.rewardGold;


    player.xp +=
        quest.rewardXp;


    addLog(

        "🏆 ¡Misión completada! +" +
        quest.rewardGold +
        " oro · +" +
        quest.rewardXp +
        " EXP."

    );


    checkLevelUp();

}


/* ==========================================================
   SUBIR NIVEL
========================================================== */

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
                1.42

            );


        player.maxHp +=
            22;


        player.maxMana +=
            8;


        player.damage +=
            5;


        player.speed +=
            3;


        player.hp =
            player.maxHp;


        player.mana =
            player.maxMana;


        addLog(

            "✨ ¡NIVEL " +
            player.level +
            "! Tus atributos aumentaron."

        );

    }

}


/* ==========================================================
   POCIÓN
========================================================== */

function usePotion() {

    if (
        inventory.potion <= 0
    ) {

        addLog(
            "🧪 No tienes pociones."
        );

        return;

    }


    if (
        player.hp >=
        player.maxHp
    ) {

        addLog(
            "❤️ Ya tienes la vida completa."
        );

        return;

    }


    inventory.potion--;


    const heal =

        Math.min(

            45,

            player.maxHp -
            player.hp

        );


    player.hp +=
        heal;


    addLog(

        "🧪 Recuperas " +
        heal +
        " HP."

    );


    saveGame(false);

    updateInterface();

}


/* ==========================================================
   INTERACTUAR
========================================================== */

function interact() {

    /* CURANDERA */

    const healer = {

        x: 180,
        y: 250

    };


    if (
        distance(
            player,
            healer
        ) < 70
    ) {

        inventory.potion++;


        addLog(
            "🧙‍♀️ La curandera te entrega una poción."
        );


        saveGame(false);

        updateInterface();

        return;

    }


    /* CRISTAL */

    const crystal = {

        x: 400,
        y: 120

    };


    if (
        distance(
            player,
            crystal
        ) < 70
    ) {

        inventory.crystal++;


        addLog(
            "💎 Obtienes un Cristal de Etherial."
        );


        saveGame(false);

        updateInterface();

        return;

    }


    addLog(
        "No hay nada con qué interactuar."
    );

}


/* ==========================================================
   MUERTE
========================================================== */

function playerDeath() {

    player.x = 300;

    player.y = 280;


    player.hp =
        player.maxHp;


    player.mana =
        player.maxMana;


    const goldLost =

        Math.min(
            25,
            player.gold
        );


    player.gold -=
        goldLost;


    addLog(

        "💀 Has caído. Regresas a Lumen y pierdes " +
        goldLost +
        " oro."

    );


    saveGame(false);

}


/* ==========================================================
   ACTUALIZAR JUEGO
========================================================== */

function update(deltaTime) {

    attackCooldown =

        Math.max(

            0,

            attackCooldown -
            deltaTime

        );


    autoSaveTimer +=
        deltaTime;


    /* MOVIMIENTO */

    let moveX = 0;

    let moveY = 0;


    if (
        keys["d"] ||
        keys["arrowright"]
    ) {

        moveX++;

    }


    if (
        keys["a"] ||
        keys["arrowleft"]
    ) {

        moveX--;

    }


    if (
        keys["s"] ||
        keys["arrowdown"]
    ) {

        moveY++;

    }


    if (
        keys["w"] ||
        keys["arrowup"]
    ) {

        moveY--;

    }


    if (
        moveX !== 0 ||
        moveY !== 0
    ) {

        const length =

            Math.hypot(
                moveX,
                moveY
            );


        player.x +=

            moveX /
            length *
            player.speed *
            deltaTime;


        player.y +=

            moveY /
            length *
            player.speed *
            deltaTime;

    }


    /* LÍMITES DEL MAPA */

    player.x =

        clamp(
            player.x,
            25,
            GAME_WIDTH - 25
        );


    player.y =

        clamp(
            player.y,
            55,
            GAME_HEIGHT - 25
        );


    /* IA DE ENEMIGOS */

    enemies.forEach(enemy => {

        if (!enemy.alive) {

            enemy.respawnTimer -=
                deltaTime;


            if (
                enemy.respawnTimer <=
                0
            ) {

                respawnEnemy(
                    enemy
                );

            }


            return;

        }


        const enemyDistance =

            distance(
                player,
                enemy
            );


        /* PERSEGUIR */

        if (
            enemyDistance <
            150
        ) {

            const angle =

                Math.atan2(

                    player.y -
                    enemy.y,

                    player.x -
                    enemy.x

                );


            if (
                enemyDistance >
                34
            ) {

                enemy.x +=

                    Math.cos(
                        angle
                    ) *
                    28 *
                    deltaTime;


                enemy.y +=

                    Math.sin(
                        angle
                    ) *
                    28 *
                    deltaTime;

            }

        }


        /* ATAQUE ENEMIGO */

        enemy.attackTimer -=
            deltaTime;


        if (
            enemyDistance <
            34 &&
            enemy.attackTimer <=
            0
        ) {

            enemy.attackTimer =
                1.25;


            player.hp =

                Math.max(

                    0,

                    player.hp -
                    enemy.damage

                );


            addLog(

                "💥 " +
                enemy.name +
                " te golpea por " +
                enemy.damage +
                "."

            );


            if (
                player.hp <=
                0
            ) {

                playerDeath();

            }

        }

    });


    /* AUTOGUARDADO */

    if (
        autoSaveTimer >=
        12
    ) {

        autoSaveTimer = 0;

        saveGame(false);

    }

}


/* ==========================================================
   RESPAWN ENEMIGO
========================================================== */

function respawnEnemy(enemy) {

    enemy.alive =
        true;


    enemy.hp =
        enemy.maxHp;


    enemy.attackTimer =
        0;


    enemy.x =

        480 +
        Math.random() *
        390;


    enemy.y =

        100 +
        Math.random() *
        350;


    addLog(

        "👹 " +
        enemy.name +
        " ha reaparecido."

    );

}


/* ==========================================================
   DIBUJAR RECTÁNGULO
========================================================== */

function drawRectangle(
    x,
    y,
    width,
    height,
    color
) {

    ctx.fillStyle =
        color;


    ctx.fillRect(

        Math.round(x),

        Math.round(y),

        Math.round(width),

        Math.round(height)

    );

}


/* ==========================================================
   TEXTO
========================================================== */

function drawText(
    text,
    x,
    y,
    color = "#ffffff",
    size = 12
) {

    ctx.fillStyle =
        color;


    ctx.font =
        size +
        "px monospace";


    ctx.fillText(

        text,

        Math.round(x),

        Math.round(y)

    );

}


/* ==========================================================
   BARRA PEQUEÑA
========================================================== */

function drawBar(
    x,
    y,
    width,
    percentage,
    color
) {

    drawRectangle(

        x,
        y,
        width,
        5,
        "#111111"

    );


    drawRectangle(

        x,
        y,
        width *
        Math.max(
            0,
            Math.min(
                1,
                percentage
            )
        ),
        5,
        color

    );

}


/* ==========================================================
   DIBUJAR PERSONAJE
========================================================== */

function drawCharacter(
    x,
    y,
    armorColor
) {

    /* CUERPO */

    drawRectangle(

        x - 11,
        y - 16,

        22,
        28,

        armorColor

    );


    /* CABEZA */

    drawRectangle(

        x - 9,
        y - 25,

        18,
        12,

        "#f1c27d"

    );


    /* CABELLO */

    drawRectangle(

        x - 8,
        y - 29,

        16,
        6,

        "#3f2b1f"

    );


    /* PIERNAS */

    drawRectangle(

        x - 7,
        y + 12,

        5,
        7,

        "#1e293b"

    );


    drawRectangle(

        x + 2,
        y + 12,

        5,
        7,

        "#1e293b"

    );

}


/* ==========================================================
   DIBUJAR MONSTRUO
========================================================== */

function drawMonster(enemy) {

    let bodyColor =
        "#86efac";

    let headColor =
        "#4ade80";


    if (
        enemy.name ===
        "Goblin"
    ) {

        bodyColor =
            "#a3e635";

        headColor =
            "#4d7c0f";

    }


    if (
        enemy.name ===
        "Lobo Sombrío"
    ) {

        bodyColor =
            "#8b5cf6";

        headColor =
            "#6d28d9";

    }


    drawRectangle(

        enemy.x - 13,
        enemy.y - 12,

        26,
        24,

        bodyColor

    );


    drawRectangle(

        enemy.x - 10,
        enemy.y - 18,

        20,
        8,

        headColor

    );


    /* OJOS */

    drawRectangle(

        enemy.x - 7,
        enemy.y - 7,

        4,
        4,

        "#111111"

    );


    drawRectangle(

        enemy.x + 3,
        enemy.y - 7,

        4,
        4,

        "#111111"

    );

}


/* ==========================================================
   DIBUJAR MAPA
========================================================== */

function drawMap() {

    /* PASTO */

    drawRectangle(

        0,
        0,

        GAME_WIDTH,
        GAME_HEIGHT,

        "#17351f"

    );


    /* CUADRÍCULA DE TERRENO */

    ctx.strokeStyle =
        "#214a2c";


    for (
        let x = 0;
        x < GAME_WIDTH;
        x += 32
    ) {

        for (
            let y = 40;
            y < GAME_HEIGHT;
            y += 32
        ) {

            ctx.strokeRect(

                x,
                y,
                32,
                32

            );

        }

    }


    /* CAMINO HORIZONTAL */

    drawRectangle(

        0,
        245,

        GAME_WIDTH,
        70,

        "#5b513c"

    );


    /* CAMINO VERTICAL */

    drawRectangle(

        350,
        40,

        80,
        GAME_HEIGHT - 40,

        "#5b513c"

    );


    /* LAGO */

    drawRectangle(

        760,
        50,

        160,
        120,

        "#214b68"

    );


    /* AGUA */

    for (
        let y = 70;
        y < 160;
        y += 18
    ) {

        drawRectangle(

            775,
            y,

            55,
            2,

            "#2c6688"

        );


        drawRectangle(

            845,
            y + 6,

            55,
            2,

            "#2c6688"

        );

    }


    /* ALDEA */

    drawRectangle(

        70,
        150,

        230,
        190,

        "#284b2f"

    );


    /* CASA 1 */

    drawRectangle(

        100,
        175,

        80,
        65,

        "#7a4935"

    );


    /* CASA 2 */

    drawRectangle(

        190,
        180,

        75,
        55,

        "#7a4935"

    );


    drawText(

        "ALDEA DE LUMEN",

        105,
        265,

        "#e5e7eb",

        14

    );


    /* CURANDERA */

    drawCharacter(

        180,
        250,

        "#e7c66a"

    );


    drawText(

        "Curandera",

        145,
        280,

        "#ffffff",

        12

    );


    /* CRISTAL */

    drawRectangle(

        390,
        105,

        20,
        28,

        "#8be9fd"

    );


    drawRectangle(

        396,
        95,

        8,
        12,

        "#c9f7ff"

    );


    drawText(

        "Cristal",

        378,
        150,

        "#d9faff",

        12

    );

}


/* ==========================================================
   RENDERIZAR JUEGO
========================================================== */

function render() {

    ctx.clearRect(

        0,
        0,

        GAME_WIDTH,
        GAME_HEIGHT

    );


    drawMap();


    /* ENEMIGOS */

    enemies.forEach(enemy => {

        if (!enemy.alive) {

            return;

        }


        drawMonster(
            enemy
        );


        drawBar(

            enemy.x - 22,
            enemy.y - 35,

            44,

            enemy.hp /
            enemy.maxHp,

            "#ef4444"

        );


        drawText(

            enemy.name,

            enemy.x - 30,
            enemy.y + 27,

            "#d1d5db",

            9

        );

    });


    /* JUGADOR */

    drawCharacter(

        player.x,
        player.y,

        "#60a5fa"

    );


    drawText(

        "Héroe",

        player.x - 18,
        player.y - 34,

        "#ffffff",

        12

    );


    /* RANGO DE ATAQUE */

    if (
        attackCooldown > 0
    ) {

        ctx.beginPath();

        ctx.arc(

            player.x,
            player.y,

            72,

            0,

            Math.PI * 2

        );


        ctx.strokeStyle =
            "rgba(245,196,81,0.30)";


        ctx.stroke();

    }

}


/* ==========================================================
   ACTUALIZAR INTERFAZ
========================================================== */

function updateInterface() {

    document
        .getElementById(
            "levelValue"
        )
        .textContent =
        player.level;


    document
        .getElementById(
            "damageValue"
        )
        .textContent =
        player.damage;


    document
        .getElementById(
            "goldValue"
        )
        .textContent =
        player.gold;


    document
        .getElementById(
            "killsValue"
        )
        .textContent =
        player.kills;


    /* HP */

    document
        .getElementById(
            "hpText"
        )
        .textContent =

        player.hp +
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


    /* MANA */

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


    /* EXP */

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


    /* INVENTARIO */

    document
        .getElementById(
            "potionCount"
        )
        .textContent =
        inventory.potion;


    document
        .getElementById(
            "woodCount"
        )
        .textContent =
        inventory.wood;


    document
        .getElementById(
            "ironCount"
        )
        .textContent =
        inventory.iron;


    document
        .getElementById(
            "crystalCount"
        )
        .textContent =
        inventory.crystal;


    document
        .getElementById(
            "fangCount"
        )
        .textContent =
        inventory.wolfFang;


    /* MISIÓN */

    const questProgress =
        document.getElementById(
            "questProgress"
        );


    const questDescription =
        document.getElementById(
            "questDescription"
        );


    if (
        quest.completed
    ) {

        questDescription.innerHTML =
            "🏆 <strong>Misión completada</strong>";


    } else {

        questProgress.textContent =

            quest.progress +
            " / " +
            quest.target;

    }


    /* CABECERA */

    document
        .getElementById(
            "playerMini"
        )
        .textContent =

        "Nivel " +
        player.level +
        " · " +
        player.xp +
        "/" +
        player.nextXp +
        " EXP · " +
        player.hp +
        "/" +
        player.maxHp +
        " HP";

}


/* ==========================================================
   LOOP PRINCIPAL
========================================================== */

function gameLoop(
    currentTime
) {

    const deltaTime =

        Math.min(

            (
                currentTime -
                lastTime
            ) /
            1000,

            0.05

        );


    lastTime =
        currentTime;


    update(
        deltaTime
    );


    render();


    updateInterface();


    requestAnimationFrame(
        gameLoop
    );

}


/* ==========================================================
   INICIAR JUEGO
========================================================== */

const loaded =
    loadGame();


if (loaded) {

    addLog(
        "💾 Partida V2 cargada."
    );

}
else {

    addLog(
        "🌟 Bienvenido a Reinos de Etherial."
    );


    addLog(
        "🎯 Derrota 5 enemigos para completar tu primera misión."
    );

}


updateInterface();


requestAnimationFrame(
    gameLoop
);


})();
