import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

const GAME_ORIGIN =
    process.env.GAME_ORIGIN ||
    "https://carlventor786-glitch.github.io";

// ==========================================
// BASE DE DATOS POSTGRESQL / NEON
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors({
    origin: GAME_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({
    limit: "100kb"
}));

// ==========================================
// INICIALIZAR BASE DE DATOS
// ==========================================

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

        console.log("✅ Base de datos inicializada.");
        console.log("✅ Tabla users lista.");
        console.log("✅ Tabla characters lista.");

    } catch (error) {

        console.error(
            "❌ Error inicializando base de datos:",
            error.message
        );
    }
}

// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {

    res.json({
        game: "Reinos de Etherial",
        server: "Etherial Backend",
        version: "4.0.0",
        status: "online"
    });

});

// ==========================================
// HEALTH CHECK + DATABASE
// ==========================================

app.get("/health", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW() AS database_time"
        );

        res.status(200).json({
            success: true,
            game: "Reinos de Etherial",
            version: "4.0.0",
            server: "online",
            database: "connected",
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
            game: "Reinos de Etherial",
            server: "online",
            database: "disconnected"
        });
    }

});

// ==========================================
// REGISTRO DE USUARIO
// ==========================================

app.post("/auth/register", async (req, res) => {

    const client = await pool.connect();

    try {

        let {
            username,
            password
        } = req.body;

        // ----------------------------------
        // VALIDAR DATOS
        // ----------------------------------

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Usuario y contraseña son obligatorios."
            });
        }

        username =
            username
                .trim()
                .toLowerCase();

        // Usuario:
        // 3-20 caracteres
        // letras, números y _
        if (
            !/^[a-z0-9_]{3,20}$/.test(username)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "El usuario debe tener entre 3 y 20 caracteres y solo usar letras, números o _."
            });
        }

        // Contraseña:
        // mínimo 8
        // máximo 72
        if (
            password.length < 8 ||
            password.length > 72
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "La contraseña debe tener entre 8 y 72 caracteres."
            });
        }

        // ----------------------------------
        // TRANSACCIÓN
        // ----------------------------------

        await client.query("BEGIN");

        // Comprobar usuario existente
        const existingUser =
            await client.query(
                `
                SELECT id
                FROM users
                WHERE username = $1
                `,
                [username]
            );

        if (
            existingUser.rows.length > 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(409).json({
                success: false,
                message:
                    "Ese nombre de usuario ya existe."
            });
        }

        // ----------------------------------
        // CIFRAR CONTRASEÑA
        // ----------------------------------

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );

        // ----------------------------------
        // CREAR USUARIO
        // ----------------------------------

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

        // ----------------------------------
        // CREAR PERSONAJE
        // ----------------------------------

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

        // ----------------------------------
        // CONFIRMAR TRANSACCIÓN
        // ----------------------------------

        await client.query(
            "COMMIT"
        );

        // ----------------------------------
        // CREAR TOKEN JWT
        // ----------------------------------

        const token =
            jwt.sign(
                {
                    userId: user.id,
                    username:
                        user.username
                },

                process.env.JWT_SECRET,

                {
                    expiresIn: "2h"
                }
            );

        // ----------------------------------
        // RESPUESTA
        // ----------------------------------

        res.status(201).json({

            success: true,

            message:
                "Cuenta creada correctamente.",

            token,

            user: {
                id: user.id,
                username:
                    user.username
            },

            character
        });

    } catch (error) {

        // Si algo falla,
        // cancelar los cambios.

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

        res.status(500).json({
            success: false,
            message:
                "No se pudo crear la cuenta."
        });

    } finally {

        client.release();

    }

});
// ==========================================
// LOGIN DE USUARIO
// ==========================================

app.post("/auth/login", async (req, res) => {
    try {
        let { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Usuario y contraseña son obligatorios."
            });
        }

        username = username.trim().toLowerCase();

        const result = await pool.query(
            `
            SELECT
                id,
                username,
                password_hash
            FROM users
            WHERE username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Usuario o contraseña incorrectos."
            });
        }

        const user = result.rows[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Usuario o contraseña incorrectos."
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        const characterResult = await pool.query(
            `
            SELECT *
            FROM characters
            WHERE user_id = $1
            `,
            [user.id]
        );

        res.status(200).json({
            success: true,
            message: "Sesión iniciada correctamente.",

            token,

            user: {
                id: user.id,
                username: user.username
            },

            character:
                characterResult.rows[0] || null
        });

    } catch (error) {
        console.error(
            "[LOGIN ERROR]",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "No se pudo iniciar sesión."
        });
    }
});
// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ==========================================

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (
        !authHeader ||
        !authHeader.startsWith("Bearer ")
    ) {
        return res.status(401).json({
            success: false,
            message: "Debes iniciar sesión."
        });
    }

    const token = authHeader.substring(7);

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Sesión inválida o expirada."
        });

    }
}


// ==========================================
// OBTENER PERSONAJE
// ==========================================

app.get(
    "/character",
    authenticateToken,
    async (req, res) => {

        try {

            const result = await pool.query(
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
                [req.user.userId]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Personaje no encontrado."
                });

            }

            return res.status(200).json({
                success: true,
                character: result.rows[0]
            });

        } catch (error) {

            console.error(
                "[GET CHARACTER ERROR]",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "No se pudo cargar el personaje."
            });

        }

    }
);
// ==========================================
// RUTA NO ENCONTRADA - 404
// ==========================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message:
            "Ruta no encontrada."
    });

});

// ==========================================
// ERROR GENERAL
// ==========================================

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

        res.status(500).json({
            success: false,
            message:
                "Error interno del servidor."
        });

    }
);

// ==========================================
// INICIAR BASE DE DATOS
// ==========================================

initializeDatabase();

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "⚔ REINOS DE ETHERIAL SERVER"
        );

        console.log(
            "Versión: 4.0.0"
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
