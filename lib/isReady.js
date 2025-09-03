// ↓ Should be imported first
require('@codefresh-io/cf-telemetry/init');
// ↓ Keep one blank line below to prevent automatic import reordering

const { readFileSync } = require('fs');
const _ = require('lodash');
const { Logger } = require('@codefresh-io/cf-telemetry/logs');
const { ContainerHandlingStatus } = require('./enums');
const { registerExitHandlers } = require('./helpers');

registerExitHandlers();

const logger = new Logger('codefresh:containerLogger:isReady');

logger.info(`isReady env: ${JSON.stringify(process.env)}`);

function isContainerReady(state, containerId) {
    logger.log(`checking if container ${containerId} is ready`);
    const containerState = _.get(state, `containers[${containerId}]`, {});
    const isReady = [
        ContainerHandlingStatus.LISTENING,
        ContainerHandlingStatus.WAITING_FOR_START,
        ContainerHandlingStatus.FINISHED,
    ].includes(containerState.status);
    logger.log(`container ${containerId} is: ${isReady ? 'READY' : 'NOT READY'}`);
    return isReady;
}

function isContainerLoggerReady(state) {
    logger.log(`checking if container logger is ready`);
    const isReady = state.status === 'ready';
    logger.log(`container logger is: ${isReady ? 'READY' : 'NOT READY'}`);
    return isReady;
}

(() => {
    const containerId = process.argv[2];
    const state = JSON.parse(readFileSync('./lib/state.json').toString('utf-8'));
    let isReady = false;
    if (containerId) {
        isReady = isContainerReady(state, containerId);
    } else {
        isReady = isContainerLoggerReady(state);
    }

    process.exit(isReady ? 0 : 1);
})();
