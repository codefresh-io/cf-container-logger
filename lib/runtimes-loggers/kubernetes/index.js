const { RuntimeLogger } = require('..');
const logger = require('cf-logs').Logger('codefresh:containerLogger:logger:kubernetes');


class KubernetesLogger extends RuntimeLogger {

    constructor({
        loggerId,
        taskLogger,
    }) {
        super({ loggerId, taskLogger });
        logger.info('Using kubernetes runtime');
    }
}

module.exports = KubernetesLogger;