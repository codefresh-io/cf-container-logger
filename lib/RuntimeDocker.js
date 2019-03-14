'use strict';

const fs                      = require('fs');
const _                       = require('lodash');
const Docker                  = require('dockerode');
const DockerEvents            = require('docker-events');
const CFError                 = require('cf-errors');
const logger                  = require('cf-logs').Logger('codefresh:runtimeDocker');
const ContainerStatus         = require('./enums').ContainerStatus;
const LoggerStrategy          = require('./enums').LoggerStrategy;
const ContainerHandlingStatus = require('./enums').ContainerHandlingStatus;
const RuntimeStepDocker       = require('./RuntimeStepDocker');
const RuntimeBase             = require('./RuntimeBase');
const { TYPES }               = require('./enums');


class RuntimeDocker extends RuntimeBase {

    constructor(opts) {
        super(opts);
    }

    static async factory(opts) {
        const runtimeLogger = new RuntimeDocker(opts);

        let dockerSockPath;
        if (fs.existsSync('/var/run/codefresh/docker.sock')) {
            dockerSockPath = '/var/run/codefresh/docker.sock';
            //console.log('Using /var/run/codefresh/docker.sock');
        } else if (fs.existsSync('/var/run/docker.sock')) {
            dockerSockPath = '/var/run/docker.sock';
            //console.log('Using /var/run/docker.sock');
        }

        let docker;
        if (dockerSockPath) {
            docker = new Docker({
                socketPath: dockerSockPath,
            });
        } else {
            docker = new Docker();
        }

        try {
            await docker.info();
        } catch (err) {
            throw new CFError({
                cause: err,
                message: 'Failed to validate docker connection'
            });
        }

        runtimeLogger.docker = docker;

        return runtimeLogger;
    }

    /**
     * receives a container and decides if to start listening on it
     * @param loggerId
     * @param docker
     * @param newContainer
     */
    async _handleContainer(container) { // jshint ignore:line
        const containerId                   = container.Id || container.id;
        const containerStatus               = container.Status || container.status;
        const receivedLoggerId              = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.id'];
        const runCreationLogic              = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.runCreationLogic'];
        const stepName                      = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.stepName'];
        const receivedLogSizeLimit = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.logSizeLimit'];
        const loggerStrategy                = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.strategy'];

        if (!containerId) {
            logger.error(`Not handling container because id is missing`);
            return;
        }

        // Validate that we are not already listening on the container
        if (this.containerHandled(containerId)) {
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


        this.state[containerId] = { status: ContainerHandlingStatus.INITIALIZING };
        logger.info(`Handling container: ${containerId}, status: '${containerStatus}'`);
        const stepLogger = this.taskLogger.create(stepName, undefined, runCreationLogic);
        logger.info(`Brought step logger for container: ${containerId}`);


        const logSizeLimit = receivedLogSizeLimit ? (parseInt(receivedLogSizeLimit) * 1000000) : undefined;

        const containerInterface = this.docker.getContainer(containerId);
        const runtimeStepDocker    = new RuntimeStepDocker({
            containerId,
            containerInterface,
            stepLogger,
            logSizeLimit,
            isWorkflowLogSizeExceeded: this.logLimitExceeded.bind(this),
            loggerStrategy
        });
        this.handleNewRuntimeStep(runtimeStepDocker);
    }

    /**
     * will listen for all new containers
     */
    _listenForNewContainers() {
        const emitter = new DockerEvents({
            docker: this.docker
        });
        emitter.start();
        emitter.on('create', this._handleContainer.bind(this));
        emitter.on('start', this._handleContainer.bind(this));

        logger.info(`Started listening for new containers`);
    }

    /**
     * will listen on all existing containers
     */
    _listenForExistingContainers() {
        logger.info(`Finding existing containers to listen on`);
        this.docker.listContainers((err, containers) => {
            if (err) {
                this._error(new CFError({
                    cause: err,
                    message: `Query of existing containers failed`
                }));
            } else {
                _.forEach(containers, this._handleContainer.bind(this));
            }
        });
    }

}
RuntimeDocker.TYPE          = TYPES.DOCKER;


module.exports = RuntimeDocker;
