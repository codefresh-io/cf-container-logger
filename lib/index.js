'use strict';

const cflogs = require('cf-logs');

const loggerOptions = {
    consoleOptions: {
        stderrLevels: ['error'],
        formatter(options) {
            return `${options.timestamp()} ${options.level.toUpperCase()} >> ${undefined !== options.message ? options.message : ''
            }${options.meta && Object.keys(options.meta).length ? ` << ${JSON.stringify(options.meta)}` : ''}`;
        }
    }
};
cflogs.init(loggerOptions);

const Logger = require('./logger');

const logger = new Logger({
    loggerId: process.env.LOGGER_ID,
    taskLoggerConfig: JSON.parse(process.env.TASK_LOGGER_CONFIG),
    findExistingContainers: process.env.LISTEN_ON_EXISTING,
    logSizeLimit: process.env.LOG_SIZE_LIMIT ? (parseInt(process.env.LOG_SIZE_LIMIT) * 1000000) : undefined,
});

logger.validate();
logger.start();
