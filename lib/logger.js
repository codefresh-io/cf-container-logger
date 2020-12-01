'use strict';

const fs                      = require('fs');
const { EventEmitter }        = require('events');
const _                       = require('lodash');
const Q                       = require('q');
const CFError                 = require('cf-errors');
const logger                  = require('cf-logs').Logger('codefresh:containerLogger');
const { getRuntimeLogger } = require('./runtimes-loggers');
const { TaskLogger }          = require('@codefresh-io/task-logger');
const express                 = require('express');

const initialState = { pid: process.pid, status: 'init', lastLogsDate: new Date() , failedHealthChecks: [] , restartCounter: 0, containers: {} };
class Logger {

    constructor({
        runtimeType,
        loggerId,
        taskLoggerConfig,
        findExistingContainers,
        logSizeLimit,
        buildFinishedPromise,
        showProgress,
    }) {
        this.runtimeType            = runtimeType;
        this.taskLoggerConfig       = taskLoggerConfig;
        this.loggerId               = loggerId;
        this.findExistingContainers = findExistingContainers === 'true';
        this.logSizeLimit           = logSizeLimit;
        this.logSize                = 0;
        this.taskLogger             = undefined;
        this.buildFinishedPromise = buildFinishedPromise || Q.resolve();
        this.finishedContainers = 0;
        this.finishedContainersEmitter = new EventEmitter();
        this.showProgress = showProgress;

        this._readState();
        this._handleBuildFinished();
        this._updateStateInterval = setInterval(this._updateStateFile.bind(this), 1000);
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
    async start() {

        logger.info(`Logging container created for logger id: ${this.loggerId}`);
        try {
            this.taskLogger = await TaskLogger(this.taskLoggerConfig.task, this.taskLoggerConfig.opts);

            this.taskLogger.on('error', (err) => {
                logger.error(err.stack);
            });

            this.taskLogger.on('flush', () => {
                this._updateMissingLogs();
                this._updateLastLoggingDate();
            });
            
            this.taskLogger.startHealthCheck();
            
            if (this.taskLogger.onHealthCheckReported) {
                this.taskLogger.onHealthCheckReported((status) => {
                    if (status.status === 'failed') {
                        this.state.failedHealthChecks.push(status);
                        this.state.status = 'failed';
                    } else {
                        this.state.healthCheckStatus = status; 
                    }
                    
                    this._writeNewState();
                });
            }

            this.state.logsStatus = this.taskLogger.getStatus();
            logger.info(`taskLogger successfully created`);
        } catch (err) {
            this._error(new CFError({
                cause: err,
                message: `Failed to create taskLogger`
            }));
            return;
        }
        
        // create runtime logger (k8s / docker)
        try {
            this.runtimeLogger = await getRuntimeLogger(this.runtimeType, {
                loggerId: this.loggerId,
                taskLogger: this.taskLogger,
                state: this.state,
                logSizeLimit: this.logSizeLimit,
            });
            this.runtimeLogger.on('message.logged', this._updateTotalLogSize.bind(this));
            this.runtimeLogger.on('container.end', this._handleContainerStreamEnd.bind(this));
            this.runtimeLogger.on('newState', this._writeNewState.bind(this));
            this.runtimeLogger.on('error', this._error.bind(this));
    
            await this.runtimeLogger.listen();
        } catch (err) {
            this._error(new CFError({
                cause: err,
                message: `Failed to create runtime-logger`
            }));
            return;
        }

        this.state.status = 'ready';
        this._writeNewState();
        
        if (this.findExistingContainers) {
            await this.runtimeLogger.findExisting();
        }
        
        this._listenForEngineUpdates();
    }

    _readState() {
        const filePath = `${__dirname}/state.json`;
        if (fs.existsSync(filePath)) {
            try {
                this.state = _.omit(JSON.parse(fs.readFileSync(filePath, 'utf8'), ['containers', 'pid']));
            } catch (err) {
                logger.error(`failed to parse previous state: ${err}. using initial state.`);
                this.state = initialState;
                return;
            }
            this.state.containers = {};
            this.state.pid = process.pid;
            let restartCounter =  _.get(this.state, 'restartCounter', 0);
             restartCounter++;
             this.state.restartCounter = restartCounter;
        }else {
            this.state =  initialState;
        }
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
     * @param disableLog
     */
    _writeNewState(disableLog = false) {
        const filePath     = `${__dirname}/state.json`;
        const currentState = JSON.stringify(this.state);
        fs.writeFile(filePath, currentState, (err) => {
            if (err) {
                const error = new CFError({
                    cause: err,
                    message: 'failed to write state to file'
                });
                logger.error(error.toString());
            } else if (!disableLog) {
                logger.info(`State: ${currentState} updated and written to file: ${filePath}`);
            }
        }); 
    }

    _updateMissingLogs() {
        const resolvedCalls = _.get(this, 'state.logsStatus.resolvedCalls', 0);
        const writeCalls = _.get(this, 'state.logsStatus.writeCalls', 0);
        const rejectedCalls = _.get(this, 'state.logsStatus.rejectedCalls', 0);

        _.set(this, 'state.logsStatus.missingLogs', writeCalls - resolvedCalls - rejectedCalls);
    }

    _updateTotalLogSize() {
        this.logSize = this.runtimeLogger.getTotalLogSize();
        this.taskLogger.setLogSize(this.logSize);
    }

    _updateLastLoggingDate() {
        this.state.lastLogsDate = new Date();
    }

    _updateStateFile() {
        if (this.state.status === 'done') {
            clearInterval(this._updateStateInterval);
        } else {
            this._writeNewState(true);

            if (this.showProgress) {
                logger.debug(`logger progress update: ${JSON.stringify(this.state.logsStatus)}`);
            }
        }
    }

    _listenForEngineUpdates() {
        const app = express();
        this._app = app;
        const port = process.env.PORT || 8080;
        const host = process.env.HOST || 'localhost';

        app.use(require('body-parser').json());

        app.post('/secrets', (req, res) => {
            try {
                const secret = req.body;
                logger.info(`got request to add new mask: ${JSON.stringify(secret)}`);

                // secret must have { key, value } structure
                this.taskLogger.addNewMask(secret);
                res.status(201).end('secret added');
            } catch (err) {
                logger.info(`could not create new mask due to error: ${err}`);
                res.status(400).end(err);
            }
        });

        app.listen(port, host, () => {
            logger.info(`listening for engine updates on ${host}:${port}`);
        });
    }

    _handleContainerStreamEnd() {
        this.finishedContainers++;
        this.finishedContainersEmitter.emit('end');
    }

    // do not call before build is finished
    _awaitAllStreamsClosed() {
        const deferred = Q.defer();
        this._checkAllStreamsClosed(deferred);
        this.finishedContainersEmitter.on('end', this._checkAllStreamsClosed.bind(this, deferred));
        return deferred.promise;
    }

    _checkAllStreamsClosed(deferred) {
        const totalContainers = Object.keys(this.state.containers).length;
        logger.debug(`checking if all containers finished: total: ${totalContainers} finished: ${this.finishedContainers}`);
        if (this.finishedContainers === totalContainers) {
            deferred.resolve();
        }
    }

    _handleBuildFinished() {
        this.buildFinishedPromise
            .then(() => {
                logger.info('=== build is finished ===');
                return this._awaitAllStreamsClosed();
            })
            .then(() => {
                logger.info('=== all streams have been closed ===');
                return this.taskLogger.awaitLogsFlushed();
            })
            .then(() => {
                logger.info('=== All logs flushed. Container logger finished. ===');
                this.state.logsStatus = this.taskLogger.getStatus();
                this.state.status = 'done';
                this._writeNewState();
            });
    }
}

module.exports = Logger;
