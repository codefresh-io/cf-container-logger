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

const TYPES = {
    DOCKER: 'docker',
    K8: 'k8'
};


module.exports = {
    ContainerStatus,
    LoggerStrategy,
    ContainerHandlingStatus,
    TYPES
};

