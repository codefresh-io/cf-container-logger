const { stat, writeFile, readFile } = require('node:fs/promises');
const path = require('path');
const { Logger } = require('@codefresh-io/cf-telemetry/logs');
const getPromiseWithResolvers = require('core-js-pure/es/promise/with-resolvers');
const { BuildFinishedSignalFilename } = require('./enums');
const { SERVER_ADDRESS_PATH } = require('./const');

const logger = new Logger('codefresh:containerLogger');

const checkFileInterval = 1000;

function _watchForBuildFinishedSignal(deferred) {
    setTimeout(async () => {
        let fileExists = false;
        try {
            fileExists = await stat(path.resolve(__dirname, BuildFinishedSignalFilename));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error(`Failed to check if file: '${BuildFinishedSignalFilename}' exists because: ${error.toString()}`);
            }
        }

        if (fileExists) {
            logger.log(`FOUND FILE '${BuildFinishedSignalFilename}' --- engine signaling build is finished`);
            return deferred.resolve();
        }

        return _watchForBuildFinishedSignal(deferred);
    }, checkFileInterval);
}

function watchForBuildFinishedSignal() {
    const deferred = getPromiseWithResolvers();

    _watchForBuildFinishedSignal(deferred);

    return deferred.promise;
}

const saveServerAddress = async (serverAddress) => {
    try {
        await writeFile(SERVER_ADDRESS_PATH, serverAddress, { encoding: 'utf8' });
    } catch (error) {
        logger.error(`Failed to save server address: ${error}`);
        throw error;
    }
};

const getServerAddress = async () => {
    try {
        return await readFile(SERVER_ADDRESS_PATH, { encoding: 'utf8' });
    } catch (error) {
        logger.error(`Failed to read server address: ${error}`);
        throw error;
    }
};

/**
 * As `@codefresh-io/cf-telemetry/init` changes the original node.js behavior of how SIGTERM and SIGINT
 * signals are handled, we revert this change back to the original node.js behavior.
 */
const registerExitHandlers = () => {
    process.on('SIGTERM', () => {
        process.exit(143); // default exit code for SIGTERM
    });

    process.on('SIGINT', () => {
        process.exit(130); // default exit code for SIGINT
    });
};

module.exports = {
    /**
     * Polyfill of `Promise.withResolvers`, TC39 Stage 4 proposal.
     * @see https://github.com/tc39/proposal-promise-with-resolvers
     */
    getPromiseWithResolvers,
    watchForBuildFinishedSignal,
    saveServerAddress,
    getServerAddress,
    registerExitHandlers,
};
