import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const { Pool } = pg;

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

const GAME_ORIGIN =
    process.env.GAME_ORIGIN ||
    "https://carlventor786-glitch.github.io";


// =========================================================
// POSTGRESQL / NEON
// =========================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
    cors({
        origin: GAME_ORIGIN,
        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

app.use(
    express.json({
        limit: "100kb"
    })
);


// =========================================================
// BASE DE DATOS
// =========================================================

async function initializeDatabase() {

    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(30) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);


        await pool.query(`
            CREATE TABLE IF NOT EXISTS characters (

                id SERIAL PRIMARY KEY,

                user_id INTEGER UNIQUE NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                level INTEGER NOT NULL DEFAULT 1,
                xp INTEGER NOT NULL DEFAULT 0,
                gold INTEGER NOT NULL DEFAULT 50,

                hp INTEGER NOT NULL DEFAULT 100,
                mana INTEGER NOT NULL DEFAULT 50,

                x DOUBLE PRECISION NOT NULL DEFAULT 520,
                y DOUBLE PRECISION NOT NULL DEFAULT 520,

                zone VARCHAR(50) NOT NULL DEFAULT 'lumen',

                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);


        // =================================================
        // V4.2 - PROGRESO DE MISIONES
        // =================================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS character_quests (

                id SERIAL PRIMARY KEY,

                user_id INTEGER NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                quest_id VARCHAR(50) NOT NULL,

                progress INTEGER NOT NULL DEFAULT 0,

                completed BOOLEAN NOT NULL DEFAULT FALSE,

                rewarded BOOLEAN NOT NULL DEFAULT FALSE,

                created_at TIMESTAMPTZ DEFAULT NOW(),

                updated_at TIMESTAMPTZ DEFAULT NOW(),

                completed_at TIMESTAMPTZ,

                UNIQUE(user_id, quest_id)
            );
        `);



        // =================================================
        // V4.3 - INVENTARIO Y EQUIPAMIENTO
        // =================================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS character_inventory (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,
                item_id VARCHAR(80) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0
                    CHECK (quantity >= 0),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, item_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS character_equipment (
                user_id INTEGER PRIMARY KEY
                    REFERENCES users(id)
                    ON DELETE CASCADE,
                weapon VARCHAR(80),
                armor VARCHAR(80),
                helmet VARCHAR(80),
                boots VARCHAR(80),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await pool.query(`
            INSERT INTO character_equipment (user_id)
            SELECT id FROM users
            ON CONFLICT (user_id) DO NOTHING;
        `);


        console.log(
            "✅ Base de datos inicializada."
        );

        console.log(
            "✅ Tabla users lista."
        );

        console.log(
            "✅ Tabla characters lista."
        );

        console.log(
            "✅ Tabla character_quests lista."
        );

        console.log(
            "✅ Tabla character_inventory lista."
        );

        console.log(
            "✅ Tabla character_equipment lista."
        );


    } catch (error) {

        console.error(
            "❌ Error inicializando base de datos:",
            error.message
        );

        throw error;
    }
}


// =========================================================
// RUTA PRINCIPAL
// =========================================================

app.get(
    "/",
    (req, res) => {

        res.json({
            game: "Reinos de Etherial",
            server: "Etherial Backend",
            version: "5.0.0",
            status: "online"
        });

    }
);


// =========================================================
// HEALTH
// =========================================================

app.get(
    "/health",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS database_time"
                );


            res.status(200).json({

                success: true,

                game:
                    "Reinos de Etherial",

                version:
                    "5.0.0",

                server:
                    "online",

                database:
                    "connected",

                databaseTime:
                    result.rows[0].database_time

            });


        } catch (error) {

            console.error(
                "[DATABASE ERROR]",
                error.message
            );


            res.status(500).json({

                success: false,

                game:
                    "Reinos de Etherial",

                server:
                    "online",

                database:
                    "disconnected"

            });

        }

    }
);


// =========================================================
// REGISTRO
// =========================================================

app.post(
    "/auth/register",
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            let {
                username,
                password
            } = req.body;


            if (
                typeof username !== "string" ||
                typeof password !== "string"
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Usuario y contraseña son obligatorios."
                    });

            }


            username =
                username
                    .trim()
                    .toLowerCase();


            if (
                !/^[a-z0-9_]{3,20}$/.test(
                    username
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "El usuario debe tener entre 3 y 20 caracteres y solo usar letras, números o _."
                    });

            }


            if (
                password.length < 8 ||
                password.length > 72
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "La contraseña debe tener entre 8 y 72 caracteres."
                    });

            }


            await client.query(
                "BEGIN"
            );


            const existingUser =
                await client.query(
                    `
                        SELECT id
                        FROM users
                        WHERE username = $1
                    `,
                    [
                        username
                    ]
                );


            if (
                existingUser.rows.length > 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Ese nombre de usuario ya existe."
                    });

            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            const userResult =
                await client.query(
                    `
                        INSERT INTO users
                        (
                            username,
                            password_hash
                        )

                        VALUES ($1, $2)

                        RETURNING
                            id,
                            username,
                            created_at
                    `,
                    [
                        username,
                        passwordHash
                    ]
                );


            const user =
                userResult.rows[0];


            const characterResult =
                await client.query(
                    `
                        INSERT INTO characters
                        (
                            user_id
                        )

                        VALUES ($1)

                        RETURNING *
                    `,
                    [
                        user.id
                    ]
                );


            const character =
                characterResult.rows[0];


            await client.query(
                "COMMIT"
            );


            const token =
                jwt.sign(
                    {
                        userId:
                            user.id,

                        username:
                            user.username
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "2h"
                    }
                );


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Cuenta creada correctamente.",

                    token,

                    user: {
                        id:
                            user.id,

                        username:
                            user.username
                    },

                    character

                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "[ROLLBACK ERROR]",
                    rollbackError.message
                );

            }


            console.error(
                "[REGISTER ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo crear la cuenta."
                });


        } finally {

            client.release();

        }

    }
);


// =========================================================
// LOGIN
// =========================================================

app.post(
    "/auth/login",
    async (req, res) => {

        try {

            let {
                username,
                password
            } = req.body;


            if (
                typeof username !== "string" ||
                typeof password !== "string"
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Usuario y contraseña son obligatorios."
                    });

            }


            username =
                username
                    .trim()
                    .toLowerCase();


            const result =
                await pool.query(
                    `
                        SELECT
                            id,
                            username,
                            password_hash

                        FROM users

                        WHERE username = $1
                    `,
                    [
                        username
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Usuario o contraseña incorrectos."
                    });

            }


            const user =
                result.rows[0];


            const passwordCorrect =
                await bcrypt.compare(
                    password,
                    user.password_hash
                );


            if (!passwordCorrect) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Usuario o contraseña incorrectos."
                    });

            }


            const token =
                jwt.sign(
                    {
                        userId:
                            user.id,

                        username:
                            user.username
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "2h"
                    }
                );


            const characterResult =
                await pool.query(
                    `
                        SELECT *
                        FROM characters
                        WHERE user_id = $1
                    `,
                    [
                        user.id
                    ]
                );


            return res
                .status(200)
                .json({

                    success: true,

                    message:
                        "Sesión iniciada correctamente.",

                    token,

                    user: {
                        id:
                            user.id,

                        username:
                            user.username
                    },

                    character:
                        characterResult.rows[0] ||
                        null

                });


        } catch (error) {

            console.error(
                "[LOGIN ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo iniciar sesión."
                });

        }

    }
);


// =========================================================
// JWT
// =========================================================

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    if (
        !authHeader ||
        !authHeader.startsWith(
            "Bearer "
        )
    ) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Debes iniciar sesión."
            });

    }


    const token =
        authHeader.substring(7);


    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.user =
            decoded;


        next();


    } catch (error) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Sesión inválida o expirada."
            });

    }

}


// =========================================================
// OBTENER PERSONAJE
// =========================================================

app.get(
    "/character",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                        SELECT
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            created_at,
                            updated_at

                        FROM characters

                        WHERE user_id = $1
                    `,
                    [
                        req.user.userId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            return res
                .status(200)
                .json({
                    success: true,
                    character:
                        result.rows[0]
                });


        } catch (error) {

            console.error(
                "[GET CHARACTER ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo cargar el personaje."
                });

        }

    }
);


// =========================================================
// GUARDAR ESTADO DEL PERSONAJE
// =========================================================

app.put(
    "/character",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                hp,
                mana,
                x,
                y,
                zone
            } = req.body;


            const safeHp =
                Number(hp);

            const safeMana =
                Number(mana);

            const safeX =
                Number(x);

            const safeY =
                Number(y);


            if (
                !Number.isFinite(safeHp) ||
                !Number.isFinite(safeMana) ||
                !Number.isFinite(safeX) ||
                !Number.isFinite(safeY)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Estado del personaje inválido."
                    });

            }


            const allowedZones = [
                "lumen",
                "forest",
                "goblinCamp",
                "darkForest",
                "ruins"
            ];


            if (
                typeof zone !== "string" ||
                !allowedZones.includes(zone)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Zona inválida."
                    });

            }


            const safePositionX =
                Math.max(
                    0,
                    Math.min(
                        2400,
                        safeX
                    )
                );


            const safePositionY =
                Math.max(
                    0,
                    Math.min(
                        1600,
                        safeY
                    )
                );


            const characterResult =
                await pool.query(
                    `
                        SELECT level
                        FROM characters
                        WHERE user_id = $1
                    `,
                    [
                        req.user.userId
                    ]
                );


            if (
                characterResult.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            const level =
                Math.max(
                    1,
                    Number(
                        characterResult
                            .rows[0]
                            .level
                    ) || 1
                );


            const maxHp =
                100 +
                (
                    (level - 1) *
                    10
                );


            const maxMana =
                50 +
                (
                    (level - 1) *
                    5
                );


            const safeHealth =
                Math.max(
                    0,
                    Math.min(
                        maxHp,
                        Math.floor(
                            safeHp
                        )
                    )
                );


            const safeMagic =
                Math.max(
                    0,
                    Math.min(
                        maxMana,
                        Math.floor(
                            safeMana
                        )
                    )
                );


            const result =
                await pool.query(
                    `
                        UPDATE characters

                        SET
                            hp = $1,
                            mana = $2,
                            x = $3,
                            y = $4,
                            zone = $5,
                            updated_at = NOW()

                        WHERE user_id = $6

                        RETURNING
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            updated_at
                    `,
                    [
                        safeHealth,
                        safeMagic,
                        safePositionX,
                        safePositionY,
                        zone,
                        req.user.userId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            return res
                .status(200)
                .json({

                    success: true,

                    message:
                        "Personaje guardado.",

                    character:
                        result.rows[0]

                });


        } catch (error) {

            console.error(
                "[SAVE CHARACTER ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo guardar el personaje."
                });

        }

    }
);


// =========================================================
// V4.3 - INVENTARIO / EQUIPAMIENTO
// =========================================================

const EQUIPMENT_SLOTS = [
    "weapon",
    "armor",
    "helmet",
    "boots"
];

const EQUIPPABLE_ITEMS = {
    ironSword: "weapon",
    etherialSword: "weapon",
    leatherHelmet: "helmet",
    hunterBoots: "boots"
};

async function addInventoryItems(
    client,
    userId,
    items = {}
) {
    for (const [itemId, rawAmount] of Object.entries(items)) {
        const amount = Math.floor(Number(rawAmount));

        if (
            typeof itemId !== "string" ||
            itemId.length === 0 ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {
            continue;
        }

        await client.query(
            `
                INSERT INTO character_inventory
                    (user_id, item_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, item_id)
                DO UPDATE SET
                    quantity =
                        character_inventory.quantity +
                        EXCLUDED.quantity,
                    updated_at = NOW()
            `,
            [userId, itemId, amount]
        );
    }
}

async function getInventoryRows(client, userId) {
    const result = await client.query(
        `
            SELECT item_id, quantity
            FROM character_inventory
            WHERE user_id = $1
              AND quantity > 0
            ORDER BY item_id ASC
        `,
        [userId]
    );

    return result.rows;
}

async function getEquipmentRow(client, userId) {
    const result = await client.query(
        `
            INSERT INTO character_equipment (user_id)
            VALUES ($1)
            ON CONFLICT (user_id)
            DO UPDATE SET user_id = EXCLUDED.user_id
            RETURNING
                weapon,
                armor,
                helmet,
                boots,
                updated_at
        `,
        [userId]
    );

    return result.rows[0];
}

app.get(
    "/game/inventory",
    authenticateToken,
    async (req, res) => {
        try {
            const inventory =
                await getInventoryRows(
                    pool,
                    req.user.userId
                );

            return res.status(200).json({
                success: true,
                inventory
            });
        } catch (error) {
            console.error(
                "[GET INVENTORY ERROR]",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "No se pudo cargar el inventario."
            });
        }
    }
);

app.get(
    "/game/equipment",
    authenticateToken,
    async (req, res) => {
        try {
            const equipment =
                await getEquipmentRow(
                    pool,
                    req.user.userId
                );

            return res.status(200).json({
                success: true,
                equipment
            });
        } catch (error) {
            console.error(
                "[GET EQUIPMENT ERROR]",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "No se pudo cargar el equipamiento."
            });
        }
    }
);

app.post(
    "/game/equip-item",
    authenticateToken,
    async (req, res) => {
        const client = await pool.connect();

        try {
            const { itemId } = req.body;
            const slot = EQUIPPABLE_ITEMS[itemId];

            if (!slot) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Ese objeto no se puede equipar."
                });
            }

            await client.query("BEGIN");

            const inventoryResult =
                await client.query(
                    `
                        SELECT quantity
                        FROM character_inventory
                        WHERE user_id = $1
                          AND item_id = $2
                        FOR UPDATE
                    `,
                    [
                        req.user.userId,
                        itemId
                    ]
                );

            if (
                inventoryResult.rows.length === 0 ||
                Number(
                    inventoryResult.rows[0].quantity
                ) < 1
            ) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    message:
                        "No tienes ese objeto."
                });
            }

            await getEquipmentRow(
                client,
                req.user.userId
            );

            await client.query(
                `
                    UPDATE character_equipment
                    SET ${slot} = $1,
                        updated_at = NOW()
                    WHERE user_id = $2
                `,
                [
                    itemId,
                    req.user.userId
                ]
            );

            const equipment =
                await getEquipmentRow(
                    client,
                    req.user.userId
                );

            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                itemId,
                slot,
                equipment
            });
        } catch (error) {
            try {
                await client.query("ROLLBACK");
            } catch {}

            console.error(
                "[EQUIP ITEM ERROR]",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "No se pudo equipar el objeto."
            });
        } finally {
            client.release();
        }
    }
);

app.post(
    "/game/unequip-item",
    authenticateToken,
    async (req, res) => {
        try {
            const { slot } = req.body;

            if (!EQUIPMENT_SLOTS.includes(slot)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Ranura de equipo inválida."
                });
            }

            await getEquipmentRow(
                pool,
                req.user.userId
            );

            await pool.query(
                `
                    UPDATE character_equipment
                    SET ${slot} = NULL,
                        updated_at = NOW()
                    WHERE user_id = $1
                `,
                [req.user.userId]
            );

            const equipment =
                await getEquipmentRow(
                    pool,
                    req.user.userId
                );

            return res.status(200).json({
                success: true,
                slot,
                equipment
            });
        } catch (error) {
            console.error(
                "[UNEQUIP ITEM ERROR]",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "No se pudo quitar el objeto."
            });
        }
    }
);


// =========================================================
// V5.0 - CONSUMIBLES Y MUERTE AUTORITATIVOS
// =========================================================

const SERVER_CONSUMABLES = {
    potion: { heal: 35, mana: 0 },
    greaterPotion: { heal: 80, mana: 15 }
};

function getMaxHpForLevel(level) {
    return 100 + ((Math.max(1, Number(level) || 1) - 1) * 10);
}

function getMaxManaForLevel(level) {
    return 50 + ((Math.max(1, Number(level) || 1) - 1) * 5);
}

app.post(
    "/game/use-item",
    authenticateToken,
    async (req, res) => {
        const client = await pool.connect();

        try {
            const { itemId } = req.body;
            const consumable = SERVER_CONSUMABLES[itemId];

            if (!consumable) {
                return res.status(400).json({
                    success: false,
                    message: "Ese objeto no es un consumible válido."
                });
            }

            await client.query("BEGIN");

            const characterResult = await client.query(
                `SELECT * FROM characters
                 WHERE user_id = $1
                 FOR UPDATE`,
                [req.user.userId]
            );

            if (characterResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    success: false,
                    message: "Personaje no encontrado."
                });
            }

            const inventoryResult = await client.query(
                `SELECT quantity
                 FROM character_inventory
                 WHERE user_id = $1 AND item_id = $2
                 FOR UPDATE`,
                [req.user.userId, itemId]
            );

            if (
                inventoryResult.rows.length === 0 ||
                Number(inventoryResult.rows[0].quantity) < 1
            ) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    success: false,
                    message: "No tienes ese consumible."
                });
            }

            const character = characterResult.rows[0];
            const maxHp = getMaxHpForLevel(character.level);
            const maxMana = getMaxManaForLevel(character.level);

            const newHp = Math.min(
                maxHp,
                Math.max(0, Number(character.hp) || 0) + consumable.heal
            );

            const newMana = Math.min(
                maxMana,
                Math.max(0, Number(character.mana) || 0) + consumable.mana
            );

            await client.query(
                `UPDATE character_inventory
                 SET quantity = quantity - 1,
                     updated_at = NOW()
                 WHERE user_id = $1 AND item_id = $2`,
                [req.user.userId, itemId]
            );

            const updateResult = await client.query(
                `UPDATE characters
                 SET hp = $1,
                     mana = $2,
                     updated_at = NOW()
                 WHERE user_id = $3
                 RETURNING *`,
                [newHp, newMana, req.user.userId]
            );

            const inventory = await getInventoryRows(
                client,
                req.user.userId
            );

            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                itemId,
                effect: {
                    heal: Math.max(0, newHp - Number(character.hp)),
                    mana: Math.max(0, newMana - Number(character.mana))
                },
                character: updateResult.rows[0],
                inventory
            });

        } catch (error) {
            try { await client.query("ROLLBACK"); } catch {}

            console.error("[USE ITEM ERROR]", error.message);

            return res.status(500).json({
                success: false,
                message: "No se pudo usar el consumible."
            });
        } finally {
            client.release();
        }
    }
);

app.post(
    "/game/player-died",
    authenticateToken,
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const characterResult = await client.query(
                `SELECT * FROM characters
                 WHERE user_id = $1
                 FOR UPDATE`,
                [req.user.userId]
            );

            if (characterResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    success: false,
                    message: "Personaje no encontrado."
                });
            }

            const character = characterResult.rows[0];
            const currentGold = Math.max(
                0,
                Math.floor(Number(character.gold) || 0)
            );

            const lostGold = Math.min(
                currentGold,
                Math.floor(currentGold * 0.10) + 10
            );

            const maxHp = getMaxHpForLevel(character.level);
            const maxMana = getMaxManaForLevel(character.level);

            const updateResult = await client.query(
                `UPDATE characters
                 SET gold = $1,
                     hp = $2,
                     mana = $3,
                     x = 520,
                     y = 520,
                     zone = 'lumen',
                     updated_at = NOW()
                 WHERE user_id = $4
                 RETURNING *`,
                [
                    currentGold - lostGold,
                    maxHp,
                    maxMana,
                    req.user.userId
                ]
            );

            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                lostGold,
                character: updateResult.rows[0]
            });

        } catch (error) {
            try { await client.query("ROLLBACK"); } catch {}

            console.error("[PLAYER DIED ERROR]", error.message);

            return res.status(500).json({
                success: false,
                message: "No se pudo procesar la muerte."
            });
        } finally {
            client.release();
        }
    }
);


// =========================================================
// V4.4 - TIENDA SEGURA DEL SERVIDOR
// =========================================================
//
// IMPORTANTE:
// El cliente SOLO envía itemId.
// El precio real vive aquí y nunca se acepta desde el navegador.
//

const SERVER_SHOP_ITEMS = {
    potion: {
        price: 20
    },

    greaterPotion: {
        price: 55
    },

    leatherHelmet: {
        price: 140
    },

    hunterBoots: {
        price: 220
    },

    ironSword: {
        price: 300
    }
};


app.get(
    "/game/shop",
    authenticateToken,
    async (req, res) => {

        try {

            const items =
                Object.entries(
                    SERVER_SHOP_ITEMS
                ).map(
                    ([itemId, data]) => ({
                        itemId,
                        price: data.price
                    })
                );


            return res
                .status(200)
                .json({
                    success: true,
                    items
                });


        } catch (error) {

            console.error(
                "[GET SHOP ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo cargar la tienda."
                });

        }

    }
);


app.post(
    "/game/shop/buy",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const {
                itemId
            } = req.body;


            if (
                typeof itemId !== "string" ||
                !SERVER_SHOP_ITEMS[itemId]
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Objeto de tienda inválido."
                    });

            }


            const shopItem =
                SERVER_SHOP_ITEMS[itemId];


            const price =
                Math.floor(
                    Number(shopItem.price)
                );


            if (
                !Number.isInteger(price) ||
                price <= 0
            ) {

                return res
                    .status(500)
                    .json({
                        success: false,
                        message:
                            "Precio de tienda inválido."
                    });

            }


            await client.query(
                "BEGIN"
            );


            // Bloqueamos el personaje para evitar
            // compras simultáneas gastando el mismo oro.
            const characterResult =
                await client.query(
                    `
                        SELECT
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            updated_at

                        FROM characters

                        WHERE user_id = $1

                        FOR UPDATE
                    `,
                    [
                        req.user.userId
                    ]
                );


            if (
                characterResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            const character =
                characterResult.rows[0];


            const currentGold =
                Math.max(
                    0,
                    Math.floor(
                        Number(character.gold) || 0
                    )
                );


            if (
                currentGold < price
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "No tienes suficiente oro.",
                        requiredGold:
                            price,
                        currentGold
                    });

            }


            const newGold =
                currentGold - price;


            const updateResult =
                await client.query(
                    `
                        UPDATE characters

                        SET
                            gold = $1,
                            updated_at = NOW()

                        WHERE user_id = $2

                        RETURNING
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            updated_at
                    `,
                    [
                        newGold,
                        req.user.userId
                    ]
                );


            // La entrega del objeto ocurre dentro de
            // la MISMA transacción que el descuento.
            await addInventoryItems(
                client,
                req.user.userId,
                {
                    [itemId]: 1
                }
            );


            const inventory =
                await getInventoryRows(
                    client,
                    req.user.userId
                );


            const equipment =
                await getEquipmentRow(
                    client,
                    req.user.userId
                );


            await client.query(
                "COMMIT"
            );


            return res
                .status(200)
                .json({
                    success: true,

                    purchase: {
                        itemId,
                        quantity: 1,
                        price
                    },

                    character:
                        updateResult.rows[0],

                    inventory,

                    equipment
                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[SHOP ROLLBACK ERROR]",
                    rollbackError.message
                );

            }


            console.error(
                "[SHOP BUY ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo completar la compra."
                });


        } finally {

            client.release();

        }

    }
);


// =========================================================
// ENEMIGOS OFICIALES DEL SERVIDOR
// =========================================================

const SERVER_ENEMIES = {

    slime: {
        xp: 12,
        goldMin: 2,
        goldMax: 5,
        loot: [
            { itemId: "potion", chance: 0.12, min: 1, max: 1 }
        ]
    },

    wolf: {
        xp: 20,
        goldMin: 4,
        goldMax: 8,
        loot: [
            { itemId: "potion", chance: 0.16, min: 1, max: 1 }
        ]
    },

    goblin: {
        xp: 28,
        goldMin: 6,
        goldMax: 12,
        loot: [
            { itemId: "potion", chance: 0.20, min: 1, max: 1 }
        ]
    },

    goblinWarrior: {
        xp: 36,
        goldMin: 8,
        goldMax: 15,
        loot: [
            { itemId: "greaterPotion", chance: 0.12, min: 1, max: 1 }
        ]
    },

    darkWolf: {
        xp: 34,
        goldMin: 7,
        goldMax: 14,
        loot: [
            { itemId: "greaterPotion", chance: 0.15, min: 1, max: 1 }
        ]
    },

    skeleton: {
        xp: 40,
        goldMin: 8,
        goldMax: 16,
        loot: [
            { itemId: "greaterPotion", chance: 0.18, min: 1, max: 1 },
            { itemId: "etherialCrystal", chance: 0.08, min: 1, max: 1 }
        ]
    }

};


// =========================================================
// MISIONES OFICIALES
// =========================================================

const SERVER_QUESTS = {

    introduction: {

        type: "talk",
        target: "aldric",
        amount: 1,

        xp: 40,
        gold: 40,

        items: {
            potion: 2
        },

        next:
            "slimeHunt"
    },


    slimeHunt: {

        type: "kill",
        target: "slime",
        amount: 3,

        xp: 100,
        gold: 75,

        items: {
            potion: 2
        },

        next:
            "wolfHunt"
    },


    wolfHunt: {

        type: "kill",
        target: "wolf",
        amount: 4,

        xp: 170,
        gold: 120,

        items: {
            leatherHelmet: 1
        },

        next:
            "goblinThreat"
    },


    goblinThreat: {

        type: "kill",
        target: "goblin",
        amount: 5,

        xp: 300,
        gold: 220,

        items: {
            ironSword: 1
        },

        next:
            "darkForest"
    },


    darkForest: {

        type: "kill",
        target: "darkWolf",
        amount: 4,

        xp: 500,
        gold: 350,

        items: {
            hunterBoots: 1
        },

        next:
            "ancientRuins"
    },


    ancientRuins: {

        type: "kill",
        target: "skeleton",
        amount: 5,

        xp: 800,
        gold: 600,

        items: {
            etherialSword: 1,
            etherialCrystal: 2
        },

        next:
            null
    }

};


// =========================================================
// XP NECESARIA PARA SUBIR DE NIVEL
// =========================================================

function getRequiredXpForLevel(level) {

    let requiredXp =
        100;


    for (
        let currentLevel = 1;
        currentLevel < level;
        currentLevel++
    ) {

        requiredXp =
            Math.floor(
                requiredXp *
                1.35
            );

    }


    return requiredXp;
}


// =========================================================
// OBTENER / CREAR MISIÓN DEL JUGADOR
// =========================================================

async function getOrCreateQuestState(
    client,
    userId,
    questId
) {

    const result =
        await client.query(
            `
                INSERT INTO character_quests
                (
                    user_id,
                    quest_id
                )

                VALUES ($1, $2)

                ON CONFLICT
                    (user_id, quest_id)

                DO UPDATE SET
                    quest_id =
                        EXCLUDED.quest_id

                RETURNING *
            `,
            [
                userId,
                questId
            ]
        );


    return result.rows[0];
}


// =========================================================
// COMPROBAR SI LA MISIÓN ANTERIOR FUE COBRADA
// =========================================================

async function previousQuestRewarded(
    client,
    userId,
    questId
) {

    const questIds =
        Object.keys(
            SERVER_QUESTS
        );


    const index =
        questIds.indexOf(
            questId
        );


    if (index <= 0) {

        return true;

    }


    const previousQuestId =
        questIds[
            index - 1
        ];


    const result =
        await client.query(
            `
                SELECT rewarded

                FROM character_quests

                WHERE
                    user_id = $1
                    AND quest_id = $2
            `,
            [
                userId,
                previousQuestId
            ]
        );


    return (
        result.rows.length > 0 &&
        result.rows[0].rewarded === true
    );
}


// =========================================================
// ACTUALIZAR PROGRESO DE MISIÓN POR KILL
// =========================================================

async function processServerQuestKill(
    client,
    userId,
    enemyType
) {

    const questIds =
        Object.keys(
            SERVER_QUESTS
        );


    // V4.3.1:
    // Primero encontramos la ÚNICA misión activa de la cadena.
    // Una misión recompensada jamás vuelve a ser la misión activa.
    let activeQuestId = null;
    let activeState = null;


    for (const questId of questIds) {

        const previousComplete =
            await previousQuestRewarded(
                client,
                userId,
                questId
            );


        if (!previousComplete) {
            break;
        }


        const state =
            await getOrCreateQuestState(
                client,
                userId,
                questId
            );


        if (state.rewarded === true) {
            continue;
        }


        activeQuestId =
            questId;

        activeState =
            state;

        break;
    }


    if (!activeQuestId || !activeState) {
        return null;
    }


    const quest =
        SERVER_QUESTS[
            activeQuestId
        ];


    // Si la misión activa no es de matar,
    // o el enemigo no corresponde, no se modifica
    // ni se devuelve una misión anterior.
    if (
        quest.type !== "kill" ||
        quest.target !== enemyType
    ) {
        return null;
    }


    // Si ya está completada pero aún no cobrada,
    // devolvemos solamente ESTA misión activa.
    if (activeState.completed === true) {

        return {
            questId:
                activeQuestId,

            progress:
                Number(
                    activeState.progress
                ),

            amount:
                quest.amount,

            completed:
                true,

            rewarded:
                false
        };
    }


    const newProgress =
        Math.min(
            Number(
                activeState.progress
            ) + 1,
            quest.amount
        );


    const completed =
        newProgress >=
        quest.amount;


    const updateResult =
        await client.query(
            `
                UPDATE character_quests

                SET
                    progress = $1,
                    completed = $2,

                    completed_at =
                        CASE
                            WHEN $2 = TRUE
                            THEN COALESCE(
                                completed_at,
                                NOW()
                            )
                            ELSE completed_at
                        END,

                    updated_at = NOW()

                WHERE
                    user_id = $3
                    AND quest_id = $4

                RETURNING *
            `,
            [
                newProgress,
                completed,
                userId,
                activeQuestId
            ]
        );


    const state =
        updateResult.rows[0];


    return {
        questId:
            activeQuestId,

        progress:
            Number(
                state.progress
            ),

        amount:
            quest.amount,

        completed:
            Boolean(
                state.completed
            ),

        rewarded:
            Boolean(
                state.rewarded
            )
    };
}


// =========================================================
// ENEMIGO DERROTADO
// =========================================================

app.post(
    "/game/enemy-killed",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const {
                enemyType
            } = req.body;


            if (
                typeof enemyType !== "string" ||
                !SERVER_ENEMIES[
                    enemyType
                ]
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Enemigo inválido."
                    });

            }


            const enemy =
                SERVER_ENEMIES[
                    enemyType
                ];


            await client.query(
                "BEGIN"
            );


            const result =
                await client.query(
                    `
                        SELECT
                            id,
                            level,
                            xp,
                            gold

                        FROM characters

                        WHERE user_id = $1

                        FOR UPDATE
                    `,
                    [
                        req.user.userId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            const character =
                result.rows[0];


            const goldEarned =
                Math.floor(
                    Math.random() *
                    (
                        enemy.goldMax -
                        enemy.goldMin +
                        1
                    )
                ) +
                enemy.goldMin;


            let newLevel =
                Number(
                    character.level
                );


            let newXp =
                Number(
                    character.xp
                ) +
                enemy.xp;


            const newGold =
                Number(
                    character.gold
                ) +
                goldEarned;


            let levelsGained =
                0;


            let requiredXp =
                getRequiredXpForLevel(
                    newLevel
                );


            while (
                newXp >=
                requiredXp
            ) {

                newXp -=
                    requiredXp;

                newLevel++;

                levelsGained++;


                requiredXp =
                    getRequiredXpForLevel(
                        newLevel
                    );

            }


            const updateResult =
                await client.query(
                    `
                        UPDATE characters

                        SET
                            level = $1,
                            xp = $2,
                            gold = $3,
                            updated_at = NOW()

                        WHERE user_id = $4

                        RETURNING
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            updated_at
                    `,
                    [
                        newLevel,
                        newXp,
                        newGold,
                        req.user.userId
                    ]
                );


            // V5.0: loot calculado y entregado por el servidor.
            const loot = [];

            for (const drop of (enemy.loot || [])) {
                if (Math.random() <= drop.chance) {
                    const quantity =
                        Math.floor(
                            Math.random() *
                            (drop.max - drop.min + 1)
                        ) + drop.min;

                    await addInventoryItems(
                        client,
                        req.user.userId,
                        { [drop.itemId]: quantity }
                    );

                    loot.push({
                        itemId: drop.itemId,
                        quantity
                    });
                }
            }


            // Actualizar misión correspondiente.
            const questProgress =
                await processServerQuestKill(
                    client,
                    req.user.userId,
                    enemyType
                );


            await client.query(
                "COMMIT"
            );


            return res
                .status(200)
                .json({

                    success: true,

                    reward: {

                        xp:
                            enemy.xp,

                        gold:
                            goldEarned,

                        levelsGained

                    },

                    character:
                        updateResult.rows[0],

                    quest:
                        questProgress,

                    loot,

                    inventory:
                        await getInventoryRows(
                            client,
                            req.user.userId
                        )

                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[ENEMY ROLLBACK ERROR]",
                    rollbackError.message
                );

            }


            console.error(
                "[ENEMY KILL ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo procesar la recompensa."
                });


        } finally {

            client.release();

        }

    }
);


// =========================================================
// HABLAR CON NPC
// =========================================================

app.post(
    "/game/npc-talked",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const {
                npcId
            } = req.body;


            if (
                typeof npcId !== "string"
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "NPC inválido."
                    });

            }


            // Por ahora la única misión TALK
            // es introduction -> Aldric.

            if (
                npcId !==
                SERVER_QUESTS
                    .introduction
                    .target
            ) {

                return res
                    .status(200)
                    .json({
                        success: true,
                        quest: null
                    });

            }


            await client.query(
                "BEGIN"
            );


            let state =
                await getOrCreateQuestState(
                    client,
                    req.user.userId,
                    "introduction"
                );


            if (
                !state.completed
            ) {

                const updateResult =
                    await client.query(
                        `
                            UPDATE character_quests

                            SET
                                progress = 1,

                                completed = TRUE,

                                completed_at =
                                    COALESCE(
                                        completed_at,
                                        NOW()
                                    ),

                                updated_at =
                                    NOW()

                            WHERE
                                user_id = $1
                                AND quest_id =
                                    'introduction'

                            RETURNING *
                        `,
                        [
                            req.user.userId
                        ]
                    );


                state =
                    updateResult.rows[0];

            }


            await client.query(
                "COMMIT"
            );


            return res
                .status(200)
                .json({

                    success: true,

                    quest: {

                        questId:
                            "introduction",

                        progress:
                            Number(
                                state.progress
                            ),

                        amount:
                            1,

                        completed:
                            Boolean(
                                state.completed
                            ),

                        rewarded:
                            Boolean(
                                state.rewarded
                            )

                    }

                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[NPC ROLLBACK ERROR]",
                    rollbackError.message
                );

            }


            console.error(
                "[NPC TALK ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo registrar la conversación."
                });


        } finally {

            client.release();

        }

    }
);


// =========================================================
// OBTENER MISIONES DEL JUGADOR
// =========================================================

app.get(
    "/game/quests",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                        SELECT
                            quest_id,
                            progress,
                            completed,
                            rewarded,
                            completed_at,
                            updated_at

                        FROM character_quests

                        WHERE user_id = $1

                        ORDER BY id ASC
                    `,
                    [
                        req.user.userId
                    ]
                );


            return res
                .status(200)
                .json({

                    success: true,

                    quests:
                        result.rows

                });


        } catch (error) {

            console.error(
                "[GET QUESTS ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudieron cargar las misiones."
                });

        }

    }
);


// =========================================================
// COBRAR RECOMPENSA DE MISIÓN
// =========================================================

app.post(
    "/game/quest-completed",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const {
                questId
            } = req.body;


            if (
                typeof questId !== "string" ||
                !SERVER_QUESTS[
                    questId
                ]
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Misión inválida."
                    });

            }


            const quest =
                SERVER_QUESTS[
                    questId
                ];


            await client.query(
                "BEGIN"
            );


            const stateResult =
                await client.query(
                    `
                        SELECT *

                        FROM character_quests

                        WHERE
                            user_id = $1
                            AND quest_id = $2

                        FOR UPDATE
                    `,
                    [
                        req.user.userId,
                        questId
                    ]
                );


            if (
                stateResult.rows.length === 0 ||
                stateResult.rows[0]
                    .completed !== true
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "La misión todavía no está completada."
                    });

            }


            const questState =
                stateResult.rows[0];


            if (
                questState.rewarded ===
                true
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "La recompensa de esta misión ya fue cobrada."
                    });

            }


            // Bloquear personaje antes de
            // modificar XP y oro.

            const characterResult =
                await client.query(
                    `
                        SELECT
                            id,
                            level,
                            xp,
                            gold

                        FROM characters

                        WHERE user_id = $1

                        FOR UPDATE
                    `,
                    [
                        req.user.userId
                    ]
                );


            if (
                characterResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Personaje no encontrado."
                    });

            }


            const character =
                characterResult.rows[0];


            let newLevel =
                Number(
                    character.level
                );


            let newXp =
                Number(
                    character.xp
                ) +
                Number(
                    quest.xp
                );


            const newGold =
                Number(
                    character.gold
                ) +
                Number(
                    quest.gold
                );


            let levelsGained =
                0;


            let requiredXp =
                getRequiredXpForLevel(
                    newLevel
                );


            while (
                newXp >=
                requiredXp
            ) {

                newXp -=
                    requiredXp;

                newLevel++;

                levelsGained++;


                requiredXp =
                    getRequiredXpForLevel(
                        newLevel
                    );

            }


            const updateResult =
                await client.query(
                    `
                        UPDATE characters

                        SET
                            level = $1,
                            xp = $2,
                            gold = $3,
                            updated_at = NOW()

                        WHERE user_id = $4

                        RETURNING
                            id,
                            user_id,
                            level,
                            xp,
                            gold,
                            hp,
                            mana,
                            x,
                            y,
                            zone,
                            updated_at
                    `,
                    [
                        newLevel,
                        newXp,
                        newGold,
                        req.user.userId
                    ]
                );


            // V4.3: los objetos de misión se guardan
            // directamente en PostgreSQL dentro de la
            // misma transacción que XP/oro/rewarded.
            await addInventoryItems(
                client,
                req.user.userId,
                quest.items || {}
            );


            // Marcar recompensa como cobrada.
            // Esto evita cobrarla otra vez.

            await client.query(
                `
                    UPDATE character_quests

                    SET
                        rewarded = TRUE,
                        updated_at = NOW()

                    WHERE
                        user_id = $1
                        AND quest_id = $2
                `,
                [
                    req.user.userId,
                    questId
                ]
            );


            await client.query(
                "COMMIT"
            );


            return res
                .status(200)
                .json({

                    success: true,

                    questId,

                    next:
                        quest.next,

                    reward: {

                        xp:
                            quest.xp,

                        gold:
                            quest.gold,

                        items:
                            quest.items || {},

                        levelsGained

                    },

                    character:
                        updateResult.rows[0],

                    inventory:
                        await getInventoryRows(
                            client,
                            req.user.userId
                        ),

                    equipment:
                        await getEquipmentRow(
                            client,
                            req.user.userId
                        )

                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[QUEST ROLLBACK ERROR]",
                    rollbackError.message
                );

            }


            console.error(
                "[QUEST ERROR]",
                error.message
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "No se pudo completar la misión."
                });


        } finally {

            client.release();

        }

    }
);


// =========================================================
// 404
// =========================================================

app.use(
    (req, res) => {

        res
            .status(404)
            .json({
                success: false,
                message:
                    "Ruta no encontrada."
            });

    }
);


// =========================================================
// V5.0 - MULTIJUGADOR: PRESENCIA Y MOVIMIENTO EN TIEMPO REAL
// =========================================================

const wss = new WebSocketServer({
    server: httpServer,
    path: "/multiplayer"
});

const onlinePlayers = new Map();

function safeSend(socket, payload) {
    if (socket.readyState === 1) {
        socket.send(JSON.stringify(payload));
    }
}

function broadcastPresence() {
    const players = Array.from(onlinePlayers.values())
        .map(entry => entry.player);

    for (const entry of onlinePlayers.values()) {
        safeSend(entry.socket, {
            type: "presence",
            players
        });
    }
}

wss.on("connection", async (socket, request) => {
    try {
        const requestUrl = new URL(
            request.url,
            "http://localhost"
        );

        const token = requestUrl.searchParams.get("token");

        if (!token) {
            socket.close(4001, "AUTH_REQUIRED");
            return;
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const characterResult = await pool.query(
            `SELECT level, x, y, zone
             FROM characters
             WHERE user_id = $1`,
            [decoded.userId]
        );

        if (characterResult.rows.length === 0) {
            socket.close(4004, "CHARACTER_NOT_FOUND");
            return;
        }

        const character = characterResult.rows[0];

        const entry = {
            socket,
            lastMoveAt: 0,
            player: {
                userId: decoded.userId,
                username: decoded.username,
                level: Number(character.level) || 1,
                x: Number(character.x) || 520,
                y: Number(character.y) || 520,
                zone: character.zone || "lumen"
            }
        };

        onlinePlayers.set(socket, entry);
        broadcastPresence();

        socket.on("message", raw => {
            try {
                const message = JSON.parse(
                    raw.toString()
                );

                if (message.type !== "move") {
                    return;
                }

                const now = Date.now();

                if (now - entry.lastMoveAt < 80) {
                    return;
                }

                entry.lastMoveAt = now;

                const x = Number(message.x);
                const y = Number(message.y);
                const zone = message.zone;

                const allowedZones = [
                    "lumen",
                    "forest",
                    "goblinCamp",
                    "darkForest",
                    "ruins"
                ];

                if (
                    !Number.isFinite(x) ||
                    !Number.isFinite(y) ||
                    typeof zone !== "string" ||
                    !allowedZones.includes(zone)
                ) {
                    return;
                }

                entry.player.x = Math.max(
                    0,
                    Math.min(2400, x)
                );

                entry.player.y = Math.max(
                    0,
                    Math.min(1600, y)
                );

                entry.player.zone = zone;

                for (const other of onlinePlayers.values()) {
                    if (other.socket === socket) continue;

                    safeSend(other.socket, {
                        type: "player-move",
                        player: entry.player
                    });
                }

            } catch {}
        });

        socket.on("close", () => {
            onlinePlayers.delete(socket);
            broadcastPresence();
        });

    } catch (error) {
        console.error(
            "[MULTIPLAYER AUTH ERROR]",
            error.message
        );

        socket.close(4001, "INVALID_SESSION");
    }
});


// =========================================================
// ERROR GENERAL
// =========================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "[ETHERIAL ERROR]",
            error
        );


        res
            .status(500)
            .json({
                success: false,
                message:
                    "Error interno del servidor."
            });

    }
);


// =========================================================
// INICIAR SERVIDOR
// =========================================================

async function startServer() {

    try {

        await initializeDatabase();


        httpServer.listen(
            PORT,
            () => {

                console.log(
                    "================================="
                );

                console.log(
                    "⚔ REINOS DE ETHERIAL SERVER"
                );

                console.log(
                    "Versión: 5.0.0"
                );

                console.log(
                    "Puerto:",
                    PORT
                );

                console.log(
                    "Frontend permitido:",
                    GAME_ORIGIN
                );

                console.log(
                    "Estado: ONLINE"
                );

                console.log(
                    "================================="
                );

            }
        );


    } catch (error) {

        console.error(
            "[SERVER START ERROR]",
            error
        );

        process.exit(1);

    }

}


startServer();
