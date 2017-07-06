'use strict';

const fs = require('fs');
const _ = require('lodash');
const Docker = require('dockerode');
const DockerEvents = require('docker-events');
const CFError = require('cf-errors');
const logger = require('cf-logs').Logger('codefresh:containerLogger');
const { ContainerStatus, LoggerStrategy, ContainerHandlingStatus } = require('./enums');
const ContainerLogger = require('./ContainerLogger');

class Logger {
    constructor(loggerId, authUrl, secret, findExistingContainers, customLoggerClass) {
        this.state = { status: 'init' };
        this.customLoggerClass = customLoggerClass;
        this.authUrl = authUrl;
        this.secret = secret;
        this.loggerId = loggerId;
        this.findExistingContainers = findExistingContainers === 'true';
        let dockerSockPath;
        if (fs.existsSync('/var/run/codefresh/docker.sock')) {
            dockerSockPath = '/var/run/codefresh/docker.sock';
            console.log('Using /var/run/codefresh/docker.sock');
        } else {
            dockerSockPath = '/var/run/docker.sock';
            console.log('Using /var/run/docker.sock');
        }

        this.docker = new Docker({
            socketPath: dockerSockPath,
        });
    }

    /**
     * validates the passed params of the constructor
     * @returns {*}
     */
    validate() {
        if (!this.loggerId) {
            return this._error(new CFError('logger id is missing'));
        }
        if (!this.customLoggerClass) {
            return this._error(new CFError('custom logger is missing'));
        }

    }

    /**
     * main entry point.
     * will attach it self to all created containers that their ids in their labels equals loggerId
     * will attach it self to all existing containers if requested
     * the container label should be 'io.codefresh.loggerId'
     * @param loggerId
     * @param authUrl
     */
    start() {
        logger.info(`Logging container created for logger id: ${this.loggerId}`);
        const loggerClass = new this.customLoggerClass(this.authUrl);
         loggerClass.authWithCustomToken(this.secret).then(()=> { 
             this._listenForNewContainers();
             this.state.status = 'ready';
             this._writeNewState();
             if (this.findExistingContainers) {
                 this._listenForExistingContainers();
             }
         }).catch((err) => {
             this._error(new CFError({
                 cause: err,
                 message: `Failed to authenticate to ${this.customLogger.name}`
             }));
        });
    }

    /**
     * will print the error and exit the process
     * @param err
     */
    _error(err) {
        logger.error(err.toString());
        process.exit(1);
    }

    /**
     * will write updates about the attached containers and initial state to a file for future read from isReady.sh script
     * @param state
     */
    _writeNewState() {
        const filePath = `${__dirname}/state.json`;
        const currentState = JSON.stringify(this.state);
        fs.writeFile(filePath, currentState, (err) => {
            if (err) {
                const error = new CFError({
                    cause: err,
                    message: 'failed to write state to file'
                });
                logger.error(error.toString());
            } else {
                logger.info(`State: ${currentState} updated and written to file: ${filePath}`);
            }
        });
    }

    /**
     * receives a container and decides if to start listening on it
     * @param loggerId
     * @param docker
     * @param newContainer
     */
    _handleContainer(container) {
        const containerId = container.Id || container.id;
        const containerStatus = container.Status || container.status;
        const receivedLoggerId = _.get(container, 'Labels', _.get(container, 'Actor.Attributes'))['io.codefresh.logger.id'];
        const receivedLogsUrl = this.customLoggerClass.getLogsUrl(container);
        const receivedLastUpdateUrl = this.customLoggerClass.getLastUpdateUrl(container);
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

        if (!receivedLogsUrl) {
            logger.error(`Container: ${containerId} does contain a firebaseUrl label`);
            return;
        }

        if (!receivedLastUpdateUrl) {
            logger.error(`Container: ${containerId} does contain a loggerLastUpdateUrl label`);
            return;
        }

        if (!loggerStrategy) {
            logger.error(`Container: ${containerId} does contain a loggerStrategy label`);
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
        const receivedLogsLogger = new this.customLoggerClass(receivedLogsUrl);
        const loggerLastUpdate = new this.customLoggerClass(receivedLastUpdateUrl);
        const containerInterface = this.docker.getContainer(containerId);
        const containerLogger = new ContainerLogger(containerId, containerInterface, receivedLogsLogger, loggerLastUpdate, loggerStrategy);
        containerLogger.start()
            .done(() => {
                this.state[containerId] = { status: ContainerHandlingStatus.LISTENING };
                this._writeNewState();
            }, (err) => {
                const error = new CFError({
                    cause: err,
                    message: `Failed to start logging for container:${containerId}`,
                    containerId
                });
                logger.error(error.toString());
            });
    }

    /**
     * Will check if a container was already handled (no matter what the handling status is)
     * @param containerId
     * @private
     */
    _containerHandled(containerId) {
        return this.state[containerId];
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

module.exports = Logger;
