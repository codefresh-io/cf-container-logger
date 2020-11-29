const { RuntimeLogger } = require('..');
const logger = require('cf-logs').Logger('codefresh:containerLogger:logger:kubernetes');


class KubernetesLogger extends RuntimeLogger {

    constructor({
        loggerId,
        taskLogger,
    }) {
        super({ loggerId, taskLogger })

    }
}

module.exports = KubernetesLogger;