const Docker = require('dockerode');
const DockerEvents = require('docker-events');
const fs = require('fs');
const _ = require('lodash');
const CFError = require('cf-errors');
const Base = require('../Base');
const ContainerLogger = require('./ContainerLogger');
const { ContainerStatus, LoggerStrategy, ContainerHandlingStatus } = require('../../enums');
const logger = require('cf-logs').Logger('codefresh:containerLogger:logger:docker');


class DockerLogger extends Base {

    constructor({
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        super({ loggerId, taskLogger, state, logSizeLimit });

        let dockerSockPath;
        if (fs.existsSync('/var/run/codefresh/docker.sock')) {
            dockerSockPath = '/var/run/codefresh/docker.sock';
        } else {
            dockerSockPath = '/var/run/docker.sock';
        }

        this.docker = new Docker({ socketPath: dockerSockPath });
    }

    static async build({
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        const logger = new DockerLogger({ loggerId, taskLogger, state, logSizeLimit });
        return logger;
    }

    async listen() {
        const emitter = new DockerEvents({ docker: this.docker });
        emitter.start();
        emitter.on('create', this._handleContainer.bind(this));
        emitter.on('start', this._handleContainer.bind(this));

        logger.info(`Started listening for new containers`);
    }

    async findExisting() {
        logger.info(`Finding existing containers to listen on`);
        this.docker.listContainers((err, containers) => {
            if (err) {
                this.emit('error', new CFError({
                    cause: err,
                    message: `Query of existing containers failed`
                }));
            } else {
                _.forEach(containers, this._handleContainer.bind(this));
            }
        });
    }

    /**
     * receives a container and decides if to start listening on it
     * @param newContainer
     */
    async _handleContainer(container) {
        const containerId = container.Id || container.id;
        const containerStatus = container.Status || container.status;
        const receivedLoggerId = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.id'];
        const runCreationLogic = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.runCreationLogic'];
        const stepName = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.stepName'];
        const receivedLogSizeLimit = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.logSizeLimit'];
        const loggerStrategy = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.strategy'];

        if (!containerId) {
            logger.error(`Not handling container because id is missing`);
            return;
        }

        // Validate that we are not already listening on the container
        if (this._containerHandled(containerId)) {
            logger.info(`Not handling container: ${containerId}, status: '${containerStatus}' because this container was already handled previously`);
            return;
        }

        if (!containerStatus) {
            logger.error(`Not handling container: ${containerId}, because this container status is missing`);
            return;
        }

        if (receivedLoggerId !== this.loggerId) {
            logger.info(`Not handling new container: ${containerId}. loggerId label: ${receivedLoggerId}`);
            return;
        }

        if (!stepName) {
            logger.error(`Container: ${containerId} does not contain a stepName label`);
            return;
        }

        if (!loggerStrategy) {
            logger.error(`Container: ${containerId} does not contain a loggerStrategy label`);
            return;
        }

        if (LoggerStrategy.ALL.indexOf(loggerStrategy) === -1) {
            logger.error(`Container: ${containerId}, loggerStrategy: '${loggerStrategy}' is not supported`);
            return;
        }

        // in case the strategy is LOGS, this means we need to wait for the container to actually start running
        if (containerStatus === ContainerStatus.CREATE && loggerStrategy === LoggerStrategy.LOGS) {
            logger.info(`Not handling container: ${containerId} on '${containerStatus}' status because logging strategy is: ${LoggerStrategy.LOGS} which needs to wait for 'start' status`);
            return;
        }

        const logSizeLimit = receivedLogSizeLimit ? (parseInt(receivedLogSizeLimit) * 1000000) : undefined;

        this.state.containers[containerId] = { status: ContainerHandlingStatus.INITIALIZING };
        logger.info(`Handling container: ${containerId}, status: '${containerStatus}'`);
        const stepLogger = this.taskLogger.create(stepName, undefined, runCreationLogic);
        logger.info(`Brought step logger for container: ${containerId}`);

        const containerInterface = this.docker.getContainer(containerId);
        const containerLogger = new ContainerLogger({
            containerId,
            containerInterface,
            stepLogger,
            logSizeLimit,
            isWorkflowLogSizeExceeded: this.logLimitExceeded.bind(this),
            loggerStrategy
        });
        this.containerLoggers.push(containerLogger);

        containerLogger.on('message.logged', () => { this.emit('message.logged'); });
        containerLogger.once('end', () => { this.emit('container.end'); });

        return containerLogger.start()
            .done(() => {
                this.state.containers[containerId] = { status: ContainerHandlingStatus.LISTENING };
                this.emit('newState', this.state);
            }, (err) => {
                const error = new CFError({
                    cause: err,
                    message: `Failed to start logging for container:${containerId}`,
                    containerId
                });
                logger.error(error.toString());
            });
    }
}

module.exports = DockerLogger;
