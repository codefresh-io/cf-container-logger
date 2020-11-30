const { RuntimeType } = require('../enums');

const loggers = {
    [RuntimeType.DOCKER]: require('./docker'),
    [RuntimeType.KUBERNETES]: require('./kubernetes'),
};

async function getRuntimeLogger(runtimeType, {
    loggerId,
    taskLogger,
    state,
    logSizeLimit,
}) {
    const builder = loggers[runtimeType];
    if (!builder) {
        throw new Error(`invalid runtime-type: ${runtimeType}`);
    }

    return await builder.build({ loggerId, taskLogger, state, logSizeLimit });
}

module.exports = {
    getRuntimeLogger,
};

