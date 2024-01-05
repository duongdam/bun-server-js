// server.ts
require('dotenv').config();
import express from 'express';
import bodyParser from "express";
import cors from 'cors';
const app = express();
const PORT = process.env['PORT'] || 8080;

// Middleware configuration
app.use(cors({origin: true, credentials: true}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.json());

// console.log(process.env);
app.get('/', (_req, res) => {
    res.status(200).send(`Welcome to the API!`);
});

app.use('/v1', require('./routes'));

app.listen(PORT, function () {
    console.log('Server is running on Port:', PORT);
});
