'use strict';

const ContainerStatus         = {
    CREATE: 'create'
};
const LoggerStrategy          = {
    ATTACH: 'attach',
    LOGS: 'logs',
    ALL: ['attach', 'logs']
};
const ContainerHandlingStatus = {
    INITIALIZING: 'initializing',
    LISTENING: 'listening'
};

const RuntimeType = {
    DOCKER: 'docker',
    KUBERNETES: 'kubernetes',
};


module.exports = {
    ContainerStatus,
    LoggerStrategy,
    ContainerHandlingStatus,
    RuntimeType,
};

