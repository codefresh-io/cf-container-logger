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
// loggerFactory.getAvailableLoggers()
const {LOGGER_ID, AUTH_URL, SECRET, LISTEN_ON_EXISTING, LOGGER_TYPE} = process.env;
const loggerClass = factory.getLoggerClass(LOGGER_TYPE);
const logger = new looger(LOGGER_ID, AUTH_URL, SECRET, LISTEN_ON_EXISTING, loggerClass);
logger.start();