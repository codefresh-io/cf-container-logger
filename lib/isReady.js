/* eslint-disable promise/catch-or-return */

// ↓ Should be imported first
require('@codefresh-io/cf-telemetry/init');
// ↓ Keep one blank line below to prevent automatic import reordering

const { readFileSync } = require('fs');
const _ = require('lodash');
const { Logger } = require('@codefresh-io/cf-telemetry/logs');
const { ContainerHandlingStatus } = require('./enums');
const { registerExitHandlers, shutdownGracefully } = require('./helpers');

registerExitHandlers();

const logger = new Logger('codefresh:containerLogger:isReady');

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

const isReady = async () => {
    const containerId = process.argv[2];
    const state = JSON.parse(readFileSync('./lib/state.json').toString('utf-8'));
    let ready = false;
    if (containerId) {
        ready = isContainerReady(state, containerId);
    } else {
        ready = isContainerLoggerReady(state);
    }

    await shutdownGracefully(ready ? 0 : 1);
};

if (require.main === module) {
    isReady();
} else {
    module.exports = { isReady };
}
