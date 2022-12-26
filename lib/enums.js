const ContainerStatus = {
    CREATE: 'create'
};
const LoggerStrategy = {
    ATTACH: 'attach',
    LOGS: 'logs',
    ALL: ['attach', 'logs']
};
const ContainerHandlingStatus = {
    INITIALIZING: 'initializing',
    LISTENING: 'listening'
};

const BuildFinishedSignalFilename = 'build_finished';

module.exports = {
    ContainerStatus,
    LoggerStrategy,
    ContainerHandlingStatus,
    BuildFinishedSignalFilename,
};
