'use strict';

const path   = require('path');
const cflogs = require('cf-logs');
const loggerFactory = require('./logger/loggerFactory');
const looger = require('./logger/logger');
// const originalLogger = require('./logger');


const loggerOptions = {
    filePath: path.join(__dirname, '../logs', 'logs.log'),
    console: process.env.LOG_TO_CONSOLE || false
};
cflogs.init(loggerOptions);
const factory = new loggerFactory();
const loggerClass = factory.getLoggerClass('firebase');
const {LOGGER_ID, FIREBASE_AUTH_URL, FIREBASE_SECRET, LISTEN_ON_EXISTING} = process.env;
const logger = new looger(LOGGER_ID, FIREBASE_AUTH_URL, FIREBASE_SECRET, LISTEN_ON_EXISTING, loggerClass);
logger.start();