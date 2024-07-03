const { stat, writeFile, readFile } = require('fs/promises');
const path = require('path');
const logger = require('cf-logs').Logger('codefresh:containerLogger');
const getPromiseWithResolvers = require('core-js-pure/es/promise/with-resolvers');
const { BuildFinishedSignalFilename } = require('./enums');
const { serverAddressPath } = require('./const');

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
            console.log(`FOUND FILE '${BuildFinishedSignalFilename}' --- engine signaling build is finished`);
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

const persistServerAddress = async (serverAddress) => {
    try {
        await writeFile(serverAddressPath, serverAddress, { encoding: 'utf8' });
    } catch (error) {
        logger.error(`Failed to persist server address: ${error}`);
        throw error;
    }
};

const getServerAddress = async () => {
    try {
        const serverAddress = await readFile(serverAddressPath, { encoding: 'utf8' });
        return serverAddress;
    } catch (error) {
        logger.error(`Failed to read server address: ${error}`);
        throw error;
    }
};

module.exports = {
    /**
     * Polyfill of `Promise.withResolvers`, TC39 Stage 4 proposal.
     * @see https://github.com/tc39/proposal-promise-with-resolvers
     */
    getPromiseWithResolvers,
    watchForBuildFinishedSignal,
    persistServerAddress,
    getServerAddress,
};
