"use strict";

// ==========================================
// REINOS DE ETHERIAL V4
// SISTEMA DE AUTENTICACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------
    // ELEMENTOS
    // --------------------------------------

    const authScreen =
        document.getElementById("authScreen");

    const loginPanel =
        document.getElementById("loginPanel");

    const registerPanel =
        document.getElementById("registerPanel");

    const loginUsername =
        document.getElementById("loginUsername");

    const loginPassword =
        document.getElementById("loginPassword");

    const registerUsername =
        document.getElementById("registerUsername");

    const registerPassword =
        document.getElementById("registerPassword");

    const registerPasswordConfirm =
        document.getElementById("registerPasswordConfirm");

    const loginButton =
        document.getElementById("loginButton");

    const registerButton =
        document.getElementById("registerButton");

    const showRegisterButton =
        document.getElementById("showRegisterButton");

    const showLoginButton =
        document.getElementById("showLoginButton");

    const loginMessage =
        document.getElementById("loginMessage");

    const registerMessage =
        document.getElementById("registerMessage");

    const serverStatusDot =
        document.getElementById("serverStatusDot");

    const serverStatusText =
        document.getElementById("serverStatusText");


    // --------------------------------------
    // MENSAJES
    // --------------------------------------

    function setMessage(
        element,
        message,
        type = ""
    ) {

        element.textContent = message;

        element.classList.remove(
            "error",
            "success"
        );

        if (type) {
            element.classList.add(type);
        }
    }


    // --------------------------------------
    // CAMBIAR ENTRE LOGIN / REGISTRO
    // --------------------------------------

    function showLogin() {

        registerPanel.classList.add("hidden");

        loginPanel.classList.remove("hidden");

        setMessage(registerMessage, "");

        loginUsername.focus();
    }


    function showRegister() {

        loginPanel.classList.add("hidden");

        registerPanel.classList.remove("hidden");

        setMessage(loginMessage, "");

        registerUsername.focus();
    }


    showRegisterButton.addEventListener(
        "click",
        showRegister
    );


    showLoginButton.addEventListener(
        "click",
        showLogin
    );


    // --------------------------------------
    // COMPROBAR SERVIDOR
    // --------------------------------------

    async function checkServer() {

        serverStatusText.textContent =
            "Comprobando servidor...";

        serverStatusDot.classList.remove(
            "online",
            "offline"
        );

        try {

            const result =
                await EtherialAPI.healthCheck();

            if (
    result &&
    result.online === true &&
    result.data &&
    result.data.success === true &&
    result.data.database === "connected"
) {

    serverStatusDot.classList.add(
        "online"
    );

    serverStatusText.textContent =
        "Servidor Online";

    return;
}

            throw new Error(
                "Servidor no disponible"
            );

        } catch (error) {

            console.error(
                "[AUTH HEALTH]",
                error
            );

            serverStatusDot.classList.add(
                "offline"
            );

            serverStatusText.textContent =
                "Servidor Offline";
        }
    }


    // --------------------------------------
    // REGISTRO
    // --------------------------------------

    async function register() {

        const username =
            registerUsername.value.trim();

        const password =
            registerPassword.value;

        const confirmPassword =
            registerPasswordConfirm.value;


        setMessage(registerMessage, "");


        if (
            username.length < 3 ||
            username.length > 20
        ) {

            setMessage(
                registerMessage,
                "El usuario debe tener entre 3 y 20 caracteres.",
                "error"
            );

            return;
        }


        if (password.length < 8) {

            setMessage(
                registerMessage,
                "La contraseña debe tener mínimo 8 caracteres.",
                "error"
            );

            return;
        }


        if (
            password !== confirmPassword
        ) {

            setMessage(
                registerMessage,
                "Las contraseñas no coinciden.",
                "error"
            );

            return;
        }


        registerButton.disabled = true;

        registerButton.textContent =
            "CREANDO CUENTA...";


        try {

            const result =
                await EtherialAPI.register(
                    username,
                    password
                );


            if (
                !result ||
                !result.token
            ) {

                throw new Error(
                    "El servidor no devolvió una sesión válida."
                );
            }


            EtherialAPI.setToken(
                result.token
            );


            sessionStorage.setItem(
                "etherial_token",
                result.token
            );


            sessionStorage.setItem(
                "etherial_username",
                result.user.username
            );


            setMessage(
                registerMessage,
                "¡Cuenta creada! Entrando al mundo...",
                "success"
            );


            setTimeout(() => {

                enterGame(
                    result.user,
                    result.character
                );

            }, 700);


        } catch (error) {

            console.error(
                "[REGISTER]",
                error
            );


            setMessage(
                registerMessage,
                error.message ||
                "No se pudo crear la cuenta.",
                "error"
            );

        } finally {

            registerButton.disabled = false;

            registerButton.textContent =
                "🛡 CREAR AVENTURERO";
        }
    }


    // --------------------------------------
    // LOGIN
    // --------------------------------------

    async function login() {

        const username =
            loginUsername.value.trim();

        const password =
            loginPassword.value;


        setMessage(loginMessage, "");


        if (!username || !password) {

            setMessage(
                loginMessage,
                "Escribe tu usuario y contraseña.",
                "error"
            );

            return;
        }


        loginButton.disabled = true;

        loginButton.textContent =
            "ENTRANDO...";


        try {

            const result =
                await EtherialAPI.login(
                    username,
                    password
                );


            if (
                !result ||
                !result.token
            ) {

                throw new Error(
                    "El servidor no devolvió una sesión válida."
                );
            }


            EtherialAPI.setToken(
                result.token
            );


            sessionStorage.setItem(
                "etherial_token",
                result.token
            );


            sessionStorage.setItem(
                "etherial_username",
                result.user.username
            );


            setMessage(
                loginMessage,
                "Sesión iniciada. Entrando...",
                "success"
            );


            setTimeout(() => {

                enterGame(
                    result.user,
                    result.character
                );

            }, 500);


        } catch (error) {

            console.error(
                "[LOGIN]",
                error
            );


            setMessage(
                loginMessage,
                error.message ||
                "No se pudo iniciar sesión.",
                "error"
            );

        } finally {

            loginButton.disabled = false;

            loginButton.textContent =
                "⚔ ENTRAR AL MUNDO";
        }
    }


    // --------------------------------------
    // ENTRAR AL JUEGO
    // --------------------------------------

    function enterGame(
    user,
    character
) {

    console.log(
        "⚔ Usuario conectado:",
        user
    );

    console.log(
        "🧙 Personaje:",
        character
    );

    window.ETHERIAL_SESSION = {
        user,
        character
    };

    // Avisar a game.js que el personaje
    // del servidor ya está disponible.
    window.dispatchEvent(
        new CustomEvent(
            "etherial:character-ready",
            {
                detail: {
                    user,
                    character
                }
            }
        )
    );

    authScreen.classList.add(
        "hidden"
    );

    document.body.classList.add(
        "gameAuthenticated"
    );
}


    // --------------------------------------
    // BOTONES
    // --------------------------------------

    loginButton.addEventListener(
        "click",
        login
    );


    registerButton.addEventListener(
        "click",
        register
    );


    // ENTER EN LOGIN

    loginPassword.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                login();

            }
        }
    );


    // ENTER EN REGISTRO

    registerPasswordConfirm.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                register();

            }
        }
    );


    // --------------------------------------
    // RECUPERAR TOKEN DE LA PESTAÑA
    // --------------------------------------

    const savedToken =
        sessionStorage.getItem(
            "etherial_token"
        );


    if (savedToken) {

        EtherialAPI.setToken(
            savedToken
        );

    }


    // --------------------------------------
    // INICIO
    // --------------------------------------

    checkServer();

});
