// ↓ Should be imported first
require('@codefresh-io/cf-telemetry/init');
// ↓ Keep one blank line below to prevent automatic import reordering

const { Logger } = require('@codefresh-io/cf-telemetry/logs');
const { getServerAddress } = require('./helpers');

const logger = new Logger('codefresh:containerLogger:addNewMask');

const exitCodes = {
    success: 0,
    error: 1,
    missingArguments: 2,
    unexpectedSuccess: 3,
};

/**
 * Unexpected exit with code 0 can lead to the leakage of secrets in the build logs.
 * The exit should never be successful unless the secret was successfully masked.
 */
let exitWithError = true;
const exitHandler = (exitCode) => {
    if ((!exitCode || !process.exitCode) && exitWithError) {
        logger.warn(`Unexpected exit with code 0. Exiting with ${exitCodes.unexpectedSuccess} instead`);
        process.exitCode = exitCodes.unexpectedSuccess;
    }
};
process.on('exit', exitHandler);

async function updateMasks(secret) {
    try {
        const serverAddress = await getServerAddress();
        logger.debug(`server address: ${serverAddress}`);
        const url = new URL('secrets', serverAddress);

        // eslint-disable-next-line import/no-unresolved
        const { default: httpClient } = await import('got');
        const response = await httpClient.post(url, {
            json: secret,
            throwHttpErrors: false,
        });

        if (response.statusCode === 201) {
            logger.log(`successfully updated masks with secret: ${secret.key}`);
            exitWithError = false;
            process.exit(exitCodes.success);
        } else {
            logger.error(`could not create mask for secret: ${secret.key}. Server responded with: ${response.statusCode}\n\n${response.body}`);
            process.exit(exitCodes.error);
        }
    } catch (error) {
        logger.error(`could not create mask for secret: ${secret.key}. Error: ${error}`);
        process.exit(exitCodes.error);
    }
}

if (require.main === module) {
    // first argument is the secret key second argument is the secret value
    if (process.argv.length < 4) {
        logger.log('not enough arguments, need secret key and secret value');
        process.exit(exitCodes.missingArguments);
    }
    const key = process.argv[2];
    const value = process.argv[3];
    updateMasks({ key, value });
} else {
    module.exports = { updateMasks, exitHandler };
}
