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
// const originalConsoleLog = console.log;
console.log("Before hooking");
console.log = consoleLogToLogger;
console.log("After hooking");

// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log("Unhandled exception:");
    console.log(err);
});

// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('unhandledRejection', function(err) {
    // handle the error safely
    console.log("Unhandled rejection:");
    console.log(err);
});

process.on('beforeExit', () => {
    console.log(`before exit called`);
});


process.on('exit', (code) => {
    console.log(`About to exit with code: ${code}`);
    wtf.dump();
    console.log(`Exitting with code: ${code}`);
});

const SOME_EXIT_CONDITION = false;
function wait() {
    console.log("Waiting...");
    if (!SOME_EXIT_CONDITION) setTimeout(wait, 1000);
}
wait();


const SegfaultHandler = require('segfault-handler');

// Optionally specify a callback function for custom logging. This feature is currently only supported for Node.js >= v0.12 running on Linux.
SegfaultHandler.registerHandler("crash.log", function(signal, address, stack) {
    // Do what you want with the signal, address, or stack (array)
    // This callback will execute before the signal is forwarded on.
    console.log("signal:", signal);
    console.log("address:", address);
    console.log("stack:", stack);
});

/*
const Segfault = require('segfault');

Segfault.registerHandler("/usr/src/app/logs/segfault.log");
*/

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
                          'Restarting container log monitoring due to Docker node shutting down. Waiting 5 seconds..');

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
