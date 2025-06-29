const express = require('express');
require('dotenv').config();

const app = express();
const axios = require("axios");
const port = process.env.PORT || 3000;
const {getUserDAO} = require('./src/DAO/DAOFactory')
const {sendMail} = require('./src/utils/mailer')
const {jwtDecode} = require("jwt-decode");




const { AUTH_URL_BASE, CLIENT_ID, CLIENT_SECRET, API_KEY} = process.env;

app.get('/', async (req, res) => {
    if (!AUTH_URL_BASE || !CLIENT_ID || !CLIENT_SECRET ) {
        return res.status(500).send('Configuration OAuth manquante.');
    }
    const protocol = req.protocol;
    const host = req.get('host'); // inclut le port si nécessaire
    const redirectUri = `${protocol}://${host}/verify`;

    const authUrl = `${AUTH_URL_BASE}/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return res.redirect(authUrl);
});

app.get('/verify', async (req, res) => {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const { code } = req.query;
    const protocol = req.protocol;
    const host = req.get('host'); // inclut le port si nécessaire
    const redirectUri = `${protocol}://${host}/verify`;

    try {
        const response = await axios.post(
            `${AUTH_URL_BASE}/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri:redirectUri
            }),
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        let userDao = getUserDAO()
        let decodedToken = jwtDecode(response.data.access_token)
        if(!('user_name' in decodedToken)) return res.json({erreur: "aucun nom d'utilisateur détecté"})
        let username = decodedToken.user_name
        await userDao.saveRefreshToken(username, response.data.refresh_token)
        return res.json({message: "connecté"});
    } catch (e) {
       return res.json({ error: e });
    }
});

async function checkSolarPanel() {
    try {

        const users = await getUserDAO().getAllUsers();
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        for (const user of users) {
            const { username: email, refresh_token } = user;

            const tokenResponse = await axios.post(
                `${AUTH_URL_BASE}/oauth/token`,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refresh_token,
                }),
                {
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            // Récupération du token
            let token = tokenResponse.data.access_token

            // Sauvegarde des nouvelles infos

            let decodedToken = jwtDecode(token)
            if(decodedToken && 'user_name' in decodedToken) {
                let username = decodedToken.user_name
                await getUserDAO().saveRefreshToken(username, tokenResponse.data.refresh_token)
            }

            // Récupération des infos système

            const systemResponse = await axios.get(
                `${AUTH_URL_BASE}/api/v4/systems`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        key: API_KEY,
                    },
                }
            );

            const systems = systemResponse.data.systems
            for (const system of systems) {
                let system_id = system.system_id
                const deviceResponse = await axios.get(
                    `${AUTH_URL_BASE}/api/v4/systems/${system_id}/devices`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            key: API_KEY,
                        },
                    }
                );
                let panels = deviceResponse.data.devices.micros

                for (const panel of panels) {
                    let serial_no = panel.serial_number
                    const deviceResponse = await axios.get(
                        `${AUTH_URL_BASE}/api/v4/systems/${system_id}/devices/micros/${serial_no}/telemetry`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                key: API_KEY,
                            },
                        }
                    );
                    // TODO : Attendre que le check de consommation par panneau soit gratuit :(
                }
            }

            // TODO : Envoi d'un mail si un panneau est défectueux + Template à faire
            /*
            await sendMail(
                email,
                'Panneau solaire défecteux',
                'Votre panneau solaire ${id} produit x% de moins'
            );
            */

            // TODO: Remplacer par logger
            console.log(`Mail envoyé à ${email}`);
        }
    } catch (err) {
        console.error("Erreur lors du traitement des tokens :", err);
    }
}

function startTokenRefreshScheduler() {
    // 1er lancement
    checkSolarPanel();
    // Execution toutes les 12 heures
    const waitTime = 12 * 60 * 60 * 1000;
    setInterval(checkSolarPanel, waitTime);
}

startTokenRefreshScheduler()

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
