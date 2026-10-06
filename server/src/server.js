/* =========================================================
   REINOS DE ETHERIAL V4
   BACKEND PRINCIPAL
========================================================= */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";


/* =========================================================
   VARIABLES DE ENTORNO
========================================================= */

dotenv.config();


/* =========================================================
   APP
========================================================= */

const app = express();


const PORT =
    process.env.PORT || 3000;


/* =========================================================
   ORIGEN DEL JUEGO
========================================================= */

const GAME_ORIGIN =
    process.env.GAME_ORIGIN ||
    "https://carlventor786-glitch.github.io";


/* =========================================================
   MIDDLEWARE
========================================================= */

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


/* =========================================================
   INFORMACIÓN BÁSICA
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            game:
                "Reinos de Etherial",

            server:
                "Etherial Backend",

            version:
                "4.0.0",

            status:
                "online"

        });

    }
);


/* =========================================================
   HEALTH CHECK

   api.js utilizará esta ruta para comprobar
   si nuestro servidor está disponible.
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            success: true,

            game:
                "Reinos de Etherial",

            version:
                "4.0.0",

            status:
                "online",

            timestamp:
                new Date()
                    .toISOString()

        });

    }
);


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Ruta no encontrada."

        });

    }
);


/* =========================================================
   MANEJO DE ERRORES
========================================================= */

app.use(
    (error, req, res, next) => {

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


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

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
