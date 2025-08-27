// ↓ Should be imported first
require('@codefresh-io/cf-telemetry/init');
// ↓ Keep one blank line below to prevent automatic import reordering

const otel = require('@codefresh-io/cf-telemetry/otel');
const path = require('node:path');
const cflogs = require('cf-logs');

const unhandledErrorsTotal = otel.cf.getMeter().createCounter(
    'codefresh.unhandled_errors',
    {
        description: 'Number of unhandled errors',
        unit: '{unhandled_error}',
        valueType: otel.api.ValueType.INT,
    },
);

const loggerOptions = {
    filePath: path.join(__dirname, '../logs', 'logs.log'),
    console: process.env.LOG_TO_CONSOLE || false,
    consoleOptions: {
        timestamp() {
            return new Date().toISOString();
        }
    }
};
cflogs.init(loggerOptions);

const Logger = require('./logger');
const { watchForBuildFinishedSignal } = require('./helpers');

const taskLoggerConfig = JSON.parse(process.env.TASK_LOGGER_CONFIG);

const logger = new Logger({
    loggerId: process.env.LOGGER_ID,
    taskLoggerConfig,
    findExistingContainers: process.env.LISTEN_ON_EXISTING,
    logSizeLimit: process.env.LOG_SIZE_LIMIT ? (parseInt(process.env.LOG_SIZE_LIMIT, 10) * 1000000) : undefined,
    buildFinishedPromise: watchForBuildFinishedSignal(),
    showProgress: process.env.SHOW_PROGRESS === 'true',
});

logger.validate();
logger.start();

process.on('beforeExit', (code) => {
    console.log(`beforeExit: ${code}`);
    logger.state.beforeExitCode = code;
    logger._writeNewState();
});
process.on('exit', (code) => {
    console.log(`exit: ${code}`);
    logger.state.exitCode = code;
    logger._writeNewState();
});

process.on('uncaughtException', (error) => {
    unhandledErrorsTotal.add(1, { 'cf.unhandled_error.type': 'uncaughtException' });
    console.log(`uncaughtException: ${error}`);
    logger.state.uncaughtException = error;
    logger._writeNewState();
});

process.on('unhandledRejection', (reason) => {
    unhandledErrorsTotal.add(1, { 'cf.unhandled_error.type': 'unhandledRejection' });
    console.log(`unhandledRejection: ${reason}`);
    logger.state.unhandledRejection = reason;
    logger._writeNewState();
});
