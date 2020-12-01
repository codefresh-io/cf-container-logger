const Base = require('../Base');
const logger = require('cf-logs').Logger('codefresh:containerLogger:logger:kubernetes');


class KubernetesLogger extends Base {

    constructor({
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        super({ loggerId, taskLogger, state, logSizeLimit });
        logger.info('Using kubernetes runtime');
    }
}

module.exports = KubernetesLogger;