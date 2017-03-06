'use strict';

const path   = require('path');
const Q      = require('q');
const cflogs = require('cf-logs');

const loggerOptions = {
    filePath: path.join(__dirname, '../logs', 'logs.log'),
    console: process.env.LOG_TO_CONSOLE || false
};
cflogs.init(loggerOptions);

const localLogger = cflogs.Logger('codefresh:containerLogger');

const Logger = require('./logger');


function monitorContainerLogs() {
    localLogger.info('Starting to monitor container logs.');

    const logger =
              new Logger(
                  process.env.LOGGER_ID,
                  process.env.FIREBASE_AUTH_URL,
                  process.env.FIREBASE_SECRET,
                  process.env.LISTEN_ON_EXISTING,
                  () => {
                      localLogger.info(
                          `Restarting container log monitoring due to Docker node 
                          shutting down. Waiting 2 seconds..`);
                      Q.delay(5000).then(() => {
                          monitorContainerLogs();
                      });
                  });

    logger.validate();
    logger.start();
}

monitorContainerLogs();
