'use strict';

const fs                      = require('fs');
const _                       = require('lodash');
const CFError                 = require('cf-errors');
const logger                  = require('cf-logs').Logger('codefresh:containerLogger');
const { TaskLogger }          = require('@codefresh-io/task-logger');
const ContainerHandlingStatus = require('./enums').ContainerHandlingStatus;

class RuntimeBase {

    constructor({
        loggerId,
        taskLoggerConfig,
        findExistingContainers,
        logSizeLimit
    }) {
        this.state                  = { status: 'init' };
        this.taskLoggerConfig       = taskLoggerConfig;
        this.loggerId               = loggerId;
        this.findExistingContainers = findExistingContainers === 'true';
        this.logSizeLimit           = logSizeLimit;
        this.steps       = [];
        this.logSize                = 0;
        this.taskLogger             = undefined;
    }

    /**
     * validates the passed params of the constructor
     * @returns {*}
     */
    validate() {
        if (!this.taskLoggerConfig) {
            return this._error(new CFError('taskLogger configuration is missing'));
        }
        if (!this.loggerId) {
            return this._error(new CFError('logger id is missing'));
        }
    }

    /**
     * main entry point.
     * will attach it self to all created containers that their ids in their labels equals loggerId
     * will attach it self to all existing containers if requested
     * the container label should be 'io.codefresh.loggerId'
     */
    start() {

        logger.info(`Logging container created for logger id: ${this.loggerId}`);

        TaskLogger(this.taskLoggerConfig.task, this.taskLoggerConfig.opts)
            .then((taskLogger) => {
                taskLogger.on('error', (err) => {
                    logger.error(err.stack);
                });

                this.taskLogger = taskLogger;
                logger.info(`taskLogger successfully created`);

                this._listenForNewContainers();

                this.state.status = 'ready';
                this._writeNewState();

                if (this.findExistingContainers) {
                    this._listenForExistingContainers();
                }
            })
            .catch((err) => {
                this._error(new CFError({
                    cause: err,
                    message: `Failed to create taskLogger`
                }));
                return;
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
        const filePath     = `${__dirname}/state.json`;
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
     * Will check if a container was already handled (no matter what the handling status is)
     * @param containerId
     */
    containerHandled(containerId) {
        return this.state[containerId];
    }

    logLimitExceeded() {
        // TODO in the future when we allow a workflow to use multuple dinds, this will not be correct
        // we need to get the total size of logs from all dinds
        return this.logSizeLimit && this._getTotalLogSize() > this.logSizeLimit;
    }

    _getTotalLogSize() {
        return _.reduce(this.steps, (sum, containerLogger) => {
            return sum + containerLogger.logSize;
        }, 0);
    }


    _updateTotalLogSize() {
        this.logSize = this._getTotalLogSize();
        this.taskLogger.setLogSize(this.logSize);
    }

    handleNewRuntimeStep(runtimeStep) {
        this.steps.push(runtimeStep);
        runtimeStep.on('message.logged', this._updateTotalLogSize.bind(this));

        runtimeStep.start()
            .done(() => {
                this.state[runtimeStep.id] = { status: ContainerHandlingStatus.LISTENING };
                this._writeNewState();
            }, (err) => {
                const error = new CFError({
                    cause: err,
                    message: `Failed to start logging for container:${runtimeStep.id}`,
                    containerId: runtimeStep.id
                });
                logger.error(error.toString());
            });
    }
}

module.exports = RuntimeBase;
