'use strict';

var Logger = require('./logger');
let logger = new Logger(process.env.LOGGER_ID, process.env.FIREBASE_AUTH_URL, process.env.FIREBASE_SECRET, process.env.LISTEN_ON_EXISTING);
logger.validate();
logger.start();