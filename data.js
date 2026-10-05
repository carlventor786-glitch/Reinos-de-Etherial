/* =========================================================
   REINOS DE ETHERIAL V3
   DATA.JS
   Datos del mundo, objetos, enemigos, NPC y misiones
========================================================= */

"use strict";


/* =========================================================
   CONFIGURACIÓN DEL MUNDO

   El canvas muestra solamente una parte del mundo.
   El mapa real mide 2400 x 1600.
========================================================= */

const WORLD_DATA = {

    width: 2400,
    height: 1600,

    startX: 520,
    startY: 520,

    startingZone: "lumen"

};


/* =========================================================
   ZONAS DEL MUNDO
========================================================= */

const ZONES = {

    lumen: {

        id: "lumen",

        name: "Aldea de Lumen",

        icon: "🏘️",

        x: 200,
        y: 250,

        width: 700,
        height: 600,

        safe: true

    },


    forest: {

        id: "forest",

        name: "Bosques de Lumen",

        icon: "🌲",

        x: 900,
        y: 100,

        width: 750,
        height: 850,

        safe: false

    },


    goblinCamp: {

        id: "goblinCamp",

        name: "Campamento Goblin",

        icon: "👺",

        x: 1550,
        y: 200,

        width: 650,
        height: 600,

        safe: false

    },


    darkForest: {

        id: "darkForest",

        name: "Bosque Sombrío",

        icon: "🌑",

        x: 950,
        y: 950,

        width: 800,
        height: 550,

        safe: false

    },


    ruins: {

        id: "ruins",

        name: "Ruinas de Etherial",

        icon: "🏛️",

        x: 1750,
        y: 900,

        width: 550,
        height: 600,

        safe: false

    }

};


/* =========================================================
   OBJETOS

   type:
   weapon
   armor
   helmet
   boots
   consumable
   material
========================================================= */

const ITEMS = {


    /* =====================
       ARMAS
    ===================== */

    oldSword: {

        id: "oldSword",

        name: "Espada vieja",

        icon: "⚔️",

        type: "weapon",

        attack: 4,

        defense: 0,

        value: 10,

        description:
            "Una espada desgastada utilizada por aventureros novatos."

    },


    ironSword: {

        id: "ironSword",

        name: "Espada de hierro",

        icon: "🗡️",

        type: "weapon",

        attack: 10,

        defense: 0,

        value: 120,

        description:
            "Una espada resistente fabricada por el herrero de Lumen."

    },


    etherialSword: {

        id: "etherialSword",

        name: "Espada de Etherial",

        icon: "⚔️",

        type: "weapon",

        attack: 22,

        defense: 2,

        value: 550,

        description:
            "Una espada impregnada con energía de los cristales de Etherial."

    },


    goblinBlade: {

        id: "goblinBlade",

        name: "Hoja Goblin",

        icon: "🗡️",

        type: "weapon",

        attack: 14,

        defense: 0,

        value: 210,

        description:
            "Una hoja irregular utilizada por guerreros goblin."

    },


    /* =====================
       ARMADURAS
    ===================== */

    travelerArmor: {

        id: "travelerArmor",

        name: "Ropa de viajero",

        icon: "🥋",

        type: "armor",

        attack: 0,

        defense: 2,

        value: 8,

        description:
            "Ropa ligera para viajeros y aventureros principiantes."

    },


    leatherArmor: {

        id: "leatherArmor",

        name: "Armadura de cuero",

        icon: "🥋",

        type: "armor",

        attack: 0,

        defense: 6,

        value: 90,

        description:
            "Armadura ligera hecha con cuero endurecido."

    },


    ironArmor: {

        id: "ironArmor",

        name: "Armadura de hierro",

        icon: "🛡️",

        type: "armor",

        attack: 0,

        defense: 12,

        value: 300,

        description:
            "Una armadura pesada que ofrece buena protección."

    },


    /* =====================
       CASCOS
    ===================== */

    leatherHelmet: {

        id: "leatherHelmet",

        name: "Casco de cuero",

        icon: "⛑️",

        type: "helmet",

        attack: 0,

        defense: 3,

        value: 60,

        description:
            "Casco básico fabricado con cuero."

    },


    ironHelmet: {

        id: "ironHelmet",

        name: "Casco de hierro",

        icon: "⛑️",

        type: "helmet",

        attack: 0,

        defense: 6,

        value: 170,

        description:
            "Casco reforzado utilizado por soldados de Lumen."

    },


    /* =====================
       BOTAS
    ===================== */

    leatherBoots: {

        id: "leatherBoots",

        name: "Botas de cuero",

        icon: "🥾",

        type: "boots",

        attack: 0,

        defense: 2,

        speed: 5,

        value: 70,

        description:
            "Botas resistentes que permiten moverse con mayor facilidad."

    },


    hunterBoots: {

        id: "hunterBoots",

        name: "Botas del cazador",

        icon: "🥾",

        type: "boots",

        attack: 0,

        defense: 3,

        speed: 12,

        value: 190,

        description:
            "Botas utilizadas por los cazadores de los Bosques de Lumen."

    },


    /* =====================
       CONSUMIBLES
    ===================== */

    potion: {

        id: "potion",

        name: "Poción de vida",

        icon: "🧪",

        type: "consumable",

        heal: 50,

        value: 20,

        description:
            "Restaura 50 puntos de vida."

    },


    greaterPotion: {

        id: "greaterPotion",

        name: "Poción mayor",

        icon: "❤️",

        type: "consumable",

        heal: 120,

        value: 65,

        description:
            "Restaura 120 puntos de vida."

    },


    manaPotion: {

        id: "manaPotion",

        name: "Poción de mana",

        icon: "🔷",

        type: "consumable",

        mana: 50,

        value: 25,

        description:
            "Restaura 50 puntos de mana."

    },


    /* =====================
       MATERIALES
    ===================== */

    wood: {

        id: "wood",

        name: "Madera",

        icon: "🪵",

        type: "material",

        value: 5,

        description:
            "Madera recogida de los bosques."

    },


    iron: {

        id: "iron",

        name: "Mineral de hierro",

        icon: "🪨",

        type: "material",

        value: 12,

        description:
            "Mineral utilizado para fabricar armas y armaduras."

    },


    etherialCrystal: {

        id: "etherialCrystal",

        name: "Cristal de Etherial",

        icon: "💎",

        type: "material",

        value: 50,

        description:
            "Un extraño cristal cargado con energía mágica."

    },


    wolfFang: {

        id: "wolfFang",

        name: "Colmillo de lobo",

        icon: "🦷",

        type: "material",

        value: 15,

        description:
            "Colmillo obtenido de los lobos de Lumen."

    },


    goblinEar: {

        id: "goblinEar",

        name: "Oreja de Goblin",

        icon: "👂",

        type: "material",

        value: 18,

        description:
            "Prueba de haber derrotado a un Goblin."

    }

};


/* =========================================================
   TIPOS DE ENEMIGOS
========================================================= */

const ENEMY_TYPES = {


    slime: {

        id: "slime",

        name: "Slime Verde",

        icon: "🟢",

        maxHp: 45,

        attack: 6,

        defense: 0,

        speed: 35,

        aggroRange: 150,

        attackRange: 35,

        attackCooldown: 1.4,

        xp: 25,

        goldMin: 4,

        goldMax: 10,

        color: "#4ade80",

        loot: [

            {
                item: "wood",
                chance: 0.30,
                min: 1,
                max: 1
            }

        ]

    },


    wolf: {

        id: "wolf",

        name: "Lobo Gris",

        icon: "🐺",

        maxHp: 70,

        attack: 10,

        defense: 2,

        speed: 70,

        aggroRange: 190,

        attackRange: 38,

        attackCooldown: 1.1,

        xp: 45,

        goldMin: 7,

        goldMax: 15,

        color: "#94a3b8",

        loot: [

            {
                item: "wolfFang",
                chance: 0.55,
                min: 1,
                max: 2
            }

        ]

    },


    goblin: {

        id: "goblin",

        name: "Goblin",

        icon: "👺",

        maxHp: 90,

        attack: 13,

        defense: 4,

        speed: 55,

        aggroRange: 175,

        attackRange: 38,

        attackCooldown: 1.2,

        xp: 65,

        goldMin: 10,

        goldMax: 22,

        color: "#84cc16",

        loot: [

            {
                item: "goblinEar",
                chance: 0.65,
                min: 1,
                max: 1
            },

            {
                item: "iron",
                chance: 0.25,
                min: 1,
                max: 2
            },

            {
                item: "goblinBlade",
                chance: 0.03,
                min: 1,
                max: 1
            }

        ]

    },


    goblinWarrior: {

        id: "goblinWarrior",

        name: "Guerrero Goblin",

        icon: "👹",

        maxHp: 150,

        attack: 19,

        defense: 7,

        speed: 50,

        aggroRange: 200,

        attackRange: 40,

        attackCooldown: 1.15,

        xp: 110,

        goldMin: 18,

        goldMax: 35,

        color: "#65a30d",

        loot: [

            {
                item: "goblinEar",
                chance: 0.90,
                min: 1,
                max: 2
            },

            {
                item: "iron",
                chance: 0.45,
                min: 1,
                max: 3
            },

            {
                item: "goblinBlade",
                chance: 0.08,
                min: 1,
                max: 1
            }

        ]

    },


    darkWolf: {

        id: "darkWolf",

        name: "Lobo Sombrío",

        icon: "🐺",

        maxHp: 135,

        attack: 18,

        defense: 5,

        speed: 80,

        aggroRange: 220,

        attackRange: 40,

        attackCooldown: 1,

        xp: 95,

        goldMin: 14,

        goldMax: 28,

        color: "#7c3aed",

        loot: [

            {
                item: "wolfFang",
                chance: 0.75,
                min: 1,
                max: 3
            },

            {
                item: "etherialCrystal",
                chance: 0.08,
                min: 1,
                max: 1
            }

        ]

    },


    skeleton: {

        id: "skeleton",

        name: "Esqueleto Antiguo",

        icon: "💀",

        maxHp: 180,

        attack: 23,

        defense: 8,

        speed: 45,

        aggroRange: 190,

        attackRange: 40,

        attackCooldown: 1.25,

        xp: 140,

        goldMin: 20,

        goldMax: 40,

        color: "#e5e7eb",

        loot: [

            {
                item: "iron",
                chance: 0.35,
                min: 1,
                max: 3
            },

            {
                item: "etherialCrystal",
                chance: 0.15,
                min: 1,
                max: 1
            }

        ]

    }

};


/* =========================================================
   SPAWNS DE MONSTRUOS

   El motor V3 utilizará estas coordenadas para crear
   los monstruos en el mundo.
========================================================= */

const ENEMY_SPAWNS = [

    /* BOSQUES DE LUMEN */

    {
        type: "slime",
        x: 1050,
        y: 350
    },

    {
        type: "slime",
        x: 1180,
        y: 520
    },

    {
        type: "slime",
        x: 1350,
        y: 300
    },

    {
        type: "wolf",
        x: 1200,
        y: 720
    },

    {
        type: "wolf",
        x: 1450,
        y: 650
    },


    /* CAMPAMENTO GOBLIN */

    {
        type: "goblin",
        x: 1680,
        y: 350
    },

    {
        type: "goblin",
        x: 1840,
        y: 430
    },

    {
        type: "goblin",
        x: 1980,
        y: 330
    },

    {
        type: "goblinWarrior",
        x: 1900,
        y: 620
    },


    /* BOSQUE SOMBRÍO */

    {
        type: "darkWolf",
        x: 1150,
        y: 1100
    },

    {
        type: "darkWolf",
        x: 1400,
        y: 1250
    },

    {
        type: "darkWolf",
        x: 1580,
        y: 1120
    },


    /* RUINAS */

    {
        type: "skeleton",
        x: 1900,
        y: 1050
    },

    {
        type: "skeleton",
        x: 2100,
        y: 1200
    },

    {
        type: "skeleton",
        x: 2000,
        y: 1400
    }

];


/* =========================================================
   NPC
========================================================= */

const NPCS = {


    aldric: {

        id: "aldric",

        name: "Aldric",

        role: "Maestro de Aventureros",

        icon: "🧙",

        x: 520,
        y: 470,

        color: "#f59e0b",

        dialog:
            "Bienvenido, aventurero. Los caminos fuera de Lumen se han vuelto peligrosos. Necesitamos guerreros capaces de defender nuestro reino."

    },


    elena: {

        id: "elena",

        name: "Elena",

        role: "Curandera",

        icon: "🧙‍♀️",

        x: 380,
        y: 520,

        color: "#ec4899",

        dialog:
            "Las criaturas del bosque pueden ser peligrosas. Lleva siempre pociones contigo."

    },


    borin: {

        id: "borin",

        name: "Borin",

        role: "Herrero",

        icon: "🔨",

        x: 650,
        y: 410,

        color: "#f97316",

        dialog:
            "Una buena espada puede decidir quién vuelve vivo de una aventura."

    },


    mira: {

        id: "mira",

        name: "Mira",

        role: "Mercader",

        icon: "👩",

        x: 720,
        y: 570,

        color: "#22c55e",

        dialog:
            "Tengo suministros para aventureros. Si tienes oro, seguramente tengo algo que necesitas."

    }

};


/* =========================================================
   TIENDA DE LUMEN
========================================================= */

const SHOP_ITEMS = [

    {
        item: "potion",
        price: 20
    },

    {
        item: "manaPotion",
        price: 25
    },

    {
        item: "greaterPotion",
        price: 65
    },

    {
        item: "ironSword",
        price: 120
    },

    {
        item: "leatherArmor",
        price: 90
    },

    {
        item: "leatherHelmet",
        price: 60
    },

    {
        item: "leatherBoots",
        price: 70
    },

    {
        item: "ironHelmet",
        price: 170
    },

    {
        item: "ironArmor",
        price: 300
    }

];


/* =========================================================
   MISIONES
========================================================= */

const QUESTS = {


    introduction: {

        id: "introduction",

        name:
            "Camino del aventurero",

        description:
            "Habla con Aldric en Aldea de Lumen.",

        type:
            "talk",

        target:
            "aldric",

        amount:
            1,

        reward: {

            gold: 40,

            xp: 40,

            items: {

                potion: 2

            }

        },

        next:
            "slimeHunt"

    },


    slimeHunt: {

        id: "slimeHunt",

        name:
            "Limpieza del bosque",

        description:
            "Derrota 3 Slimes Verdes en los Bosques de Lumen.",

        type:
            "kill",

        target:
            "slime",

        amount:
            3,

        reward: {

            gold: 75,

            xp: 100,

            items: {

                potion: 2

            }

        },

        next:
            "wolfHunt"

    },


    wolfHunt: {

        id: "wolfHunt",

        name:
            "Colmillos de Lumen",

        description:
            "Derrota 4 Lobos Grises.",

        type:
            "kill",

        target:
            "wolf",

        amount:
            4,

        reward: {

            gold: 120,

            xp: 170,

            items: {

                leatherHelmet: 1

            }

        },

        next:
            "goblinThreat"

    },


    goblinThreat: {

        id: "goblinThreat",

        name:
            "La amenaza Goblin",

        description:
            "Derrota 5 Goblins del campamento oriental.",

        type:
            "kill",

        target:
            "goblin",

        amount:
            5,

        reward: {

            gold: 220,

            xp: 300,

            items: {

                ironSword: 1

            }

        },

        next:
            "darkForest"

    },


    darkForest: {

        id: "darkForest",

        name:
            "Sombras entre los árboles",

        description:
            "Derrota 4 Lobos Sombríos.",

        type:
            "kill",

        target:
            "darkWolf",

        amount:
            4,

        reward: {

            gold: 350,

            xp: 500,

            items: {

                hunterBoots: 1

            }

        },

        next:
            "ancientRuins"

    },


    ancientRuins: {

        id: "ancientRuins",

        name:
            "Secretos de Etherial",

        description:
            "Derrota 5 Esqueletos Antiguos en las Ruinas de Etherial.",

        type:
            "kill",

        target:
            "skeleton",

        amount:
            5,

        reward: {

            gold: 600,

            xp: 800,

            items: {

                etherialSword: 1,

                etherialCrystal: 2

            }

        },

        next:
            null

    }

};


/* =========================================================
   OBJETOS INICIALES DEL PERSONAJE
========================================================= */

const STARTING_INVENTORY = {

    potion: 3

};


const STARTING_EQUIPMENT = {

    weapon:
        "oldSword",

    armor:
        "travelerArmor",

    helmet:
        null,

    boots:
        null

};


/* =========================================================
   CONFIGURACIÓN DE NIVEL
========================================================= */

const LEVEL_CONFIG = {

    startingXp:
        100,

    xpMultiplier:
        1.42,

    hpPerLevel:
        22,

    manaPerLevel:
        8,

    attackPerLevel:
        3,

    defensePerLevel:
        1

};


/* =========================================================
   FIN DATA.JS
========================================================= */
