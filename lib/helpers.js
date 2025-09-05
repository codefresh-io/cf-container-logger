/* eslint-disable promise/catch-or-return */

// ↓ Should be imported first
const { terminate } = require('@codefresh-io/cf-telemetry/init');
// ↓ Keep one blank line below to prevent automatic import reordering

const { stat, writeFile, readFile } = require('node:fs/promises');
const path = require('path');
const { Logger } = require('@codefresh-io/cf-telemetry/logs');
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
    const deferred = Promise.withResolvers();

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

const shutdownGracefully = async (code) => {
    try {
        await terminate();
    } catch (error) {
        // supress any error during terminating telemetry
        logger.error(`Error occurred while terminating telemetry.`, error);
    }

    process.exit(code);
};

/**
 * As `@codefresh-io/cf-telemetry/init` changes the original node.js behavior of how SIGTERM and SIGINT
 * signals are handled, we revert this change back to the original node.js behavior.
 */
const registerExitHandlers = () => {
    process.on('SIGTERM', async () => {
        await shutdownGracefully(143); // default exit code for SIGTERM
    });

    process.on('SIGINT', async () => {
        await shutdownGracefully(130); // default exit code for SIGINT
    });
};

module.exports = {
    shutdownGracefully,
    watchForBuildFinishedSignal,
    saveServerAddress,
    getServerAddress,
    registerExitHandlers,
};
