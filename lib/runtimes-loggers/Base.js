const _ = require('lodash');
const { EventEmitter } = require('events');
const { ContainerHandlingStatus } = require('../enums');

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

    // start listening for new containers/pods
    async listen() {
        throw new Error('Method not implemented');
    }

    // find existing containers/pods
    async findExisting() {
        throw new Error('Method not implemented');
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
        if (this.state.containers[containerId] && this.state.containers[containerId] !== ContainerHandlingStatus.ERROR) {
            return true;
        }
        return false;
    }
}

module.exports = RuntimeLogger;