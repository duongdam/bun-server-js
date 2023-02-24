// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')({origin: true});
const PORT = process.env.PORT || 8080;
const bodyParser = require("express");

// Middleware configuration
app.use(cors);
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.json());

globalThis.count = globalThis.count ?? 0;

// console.log(process.env);
app.get('/', (req, res, next) => {
    res.status(200).send(`Bun serve reloaded! ${globalThis.count++}`);
});

app.listen(PORT, function () {
    console.log('Server is running on Port:', PORT);
});