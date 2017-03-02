'use strict';

const path   = require('path');
const Q      = require('q');
const cflogs = require('cf-logs');
const wtf = require('wtfnode');

const loggerOptions = {
    filePath: path.join(__dirname, '../logs', 'logs.log'),
    console: process.env.LOG_TO_CONSOLE || false
};
cflogs.init(loggerOptions);

const localLogger = cflogs.Logger('codefresh:containerLogger');

const Logger = require('./logger');

function consoleLogToLogger(...args) {
    localLogger.warn(...args);
}
const originalConsoleLog = console.log;
console.log("Before hooking");
console.log = consoleLogToLogger;
console.log("After hooking");

function monitorContainerLogs() {
    localLogger.info('Starting to monitor container logs.');

    const logger =
              new Logger(
                  process.env.LOGGER_ID,
                  process.env.FIREBASE_AUTH_URL,
                  process.env.FIREBASE_SECRET,
                  process.env.LISTEN_ON_EXISTING,
                  () => {
                      localLogger.warn(
                          `Restarting container log monitoring due to Docker node 
                          shutting down. Waiting 5 seconds..`);

                      localLogger.warn('Finished initializing container log monitoring.');
                      localLogger.warn('Event: dumping wtfnode stats');
                      wtf.dump();
                      localLogger.warn('Event: finished dumping wtfnode stats');

                      Q.delay(5000).then(() => {
                          monitorContainerLogs();
                      });
                  });

    logger.validate();
    logger.start();

    localLogger.warn('Finished initializing container log monitoring.');
    localLogger.warn('Index: dumping wtfnode stats');
    wtf.dump();
    localLogger.warn('Index: finished dumping wtfnode stats');
}

monitorContainerLogs();
