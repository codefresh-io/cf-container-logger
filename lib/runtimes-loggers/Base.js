const _ = require('lodash');
const { EventEmitter } = require('events');

class RuntimeLogger extends EventEmitter {
    constructor({
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        super();
        this.loggerId = loggerId;
        this.taskLogger = taskLogger;
        this.logSizeLimit = logSizeLimit;
        this.containerLoggers = [];
        this.state = state;
    }

    static async build() {
        throw new Error('Method not implemented');
    }

    async listenForNewContainers() {
        throw new Error('Method not implemented');
    }

    async listenForExistingContainers() {
        throw new Error('Method not implemented');
    }

    getContainers() {
        return this.containerLoggers;
    }

    getTotalLogSize() {
        return _.reduce(this.containers, (sum, containerLogger) => sum + containerLogger.logSize, 0);
    }

    logLimitExceeded() {
        return this.logSizeLimit && this.getTotalLogSize() > this.logSizeLimit;
    }

    /**
     * Will check if a container was already handled (no matter what the handling status is)
     * @param containerId
     * @private
     */
    _containerHandled(containerId) {
        return this.state.containers[containerId];
    }
}

module.exports = RuntimeLogger;