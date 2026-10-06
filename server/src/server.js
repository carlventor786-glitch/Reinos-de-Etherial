import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

const GAME_ORIGIN =
    process.env.GAME_ORIGIN ||
    "https://carlventor786-glitch.github.io";

// ================================
// BASE DE DATOS POSTGRESQL / NEON
// ================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ================================
// MIDDLEWARE
// ================================

app.use(cors({
    origin: GAME_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100kb" }));

// ================================
// RUTA PRINCIPAL
// ================================

app.get("/", (req, res) => {
    res.json({
        game: "Reinos de Etherial",
        server: "Etherial Backend",
        version: "4.0.0",
        status: "online"
    });
});

// ================================
// HEALTH CHECK + DATABASE
// ================================

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
            databaseTime: result.rows[0].database_time
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

// ================================
// 404
// ================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Ruta no encontrada."
    });
});

// ================================
// ERROR GENERAL
// ================================

app.use((error, req, res, next) => {
    console.error(
        "[ETHERIAL ERROR]",
        error
    );

    res.status(500).json({
        success: false,
        message: "Error interno del servidor."
    });
});

// ================================
// INICIAR SERVIDOR
// ================================

app.listen(PORT, () => {

    console.log("=================================");
    console.log("⚔ REINOS DE ETHERIAL SERVER");
    console.log("Versión: 4.0.0");
    console.log("Puerto:", PORT);
    console.log("Frontend permitido:", GAME_ORIGIN);
    console.log("Estado: ONLINE");
    console.log("=================================");

});
