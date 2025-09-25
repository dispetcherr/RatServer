// proxy_server.js - простой прокси на Glitch.com или Heroku
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TARGET_SERVER = "https://ratserver-6wo3.onrender.com";

app.use(express.json());
app.use(require('cors')());

// Прокси всех запросов
app.all('*', async (req, res) => {
    try {
        const url = TARGET_SERVER + req.url;
        console.log('Proxying:', req.method, url);
        
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...req.headers
            },
            body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
        });
        
        const data = await response.text();
        res.status(response.status).send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Proxy server running on port 3000'));
