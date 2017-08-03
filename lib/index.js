'use strict';

const path   = require('path');
const cflogs = require('cf-logs');

const loggerOptions = {
    filePath: path.join(__dirname, '../logs', 'logs.log'),
    console: process.env.LOG_TO_CONSOLE || false
};
cflogs.init(loggerOptions);

const Logger = require('./logger');

// process.env.storage is csv defining what storages to use, e.g.: 
// process.env.storage=mongo,firebase,cassandra

const logger = new Logger(process.env.LOGGER_ID, process.env.FIREBASE_AUTH_URL, process.env.FIREBASE_SECRET, process.env.LISTEN_ON_EXISTING, process.env.STORAGE);

//logger.validate();
logger.start();
