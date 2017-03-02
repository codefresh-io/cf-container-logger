'use strict';

const Q              = require('q');
const logger         = require('cf-logs').Logger('codefresh:containerLogger');
const CFError        = require('cf-errors');
const LoggerStrategy = require('./enums').LoggerStrategy;
const wtf = require('wtfnode');

class ContainerLogger {

    constructor(containerId, containerInterface, firebaseLogger, firebaseLastUpdate, loggerStrategy, onDockerNodeTerminationHandler) {
        this.containerId        = containerId;
        this.containerInterface = containerInterface;
        this.firebaseLogger     = firebaseLogger;
        this.firebaseLastUpdate = firebaseLastUpdate;
        this.loggerStrategy     = loggerStrategy;
        this.tty                = false;
        this.dockerNodeTerminationHandlerFired = false;
        this.onDockerNodeTerminationHandler = onDockerNodeTerminationHandler;
        logger.warn("ContainerLogger created with onDockerNodeTerminationHandler:", onDockerNodeTerminationHandler === undefined);
    }

    start() {
        return Q.ninvoke(this.containerInterface, 'inspect')
            .then((inspectedContainer) => {
                this.tty = inspectedContainer.Config.Tty;
                if (this.loggerStrategy === LoggerStrategy.ATTACH) {
                    return this._getAttachStrategyStream();
                } else if (this.loggerStrategy === LoggerStrategy.LOGS) {
                    return this._getLogsStrategyStream();
                } else {
                    return Q.reject(new CFError(`Strategy: ${this.loggerStrategy} is not supported`));
                }
            })
            .then(([stdout, stderr]) => {
                logger.info(`Attached stream to container: ${this.containerId}`);
                // Listening on the stream needs to be performed different depending if a tty is attached or not
                // See documentation of the docker api here: https://docs.docker.com/engine/reference/api/docker_remote_api_v1.24/#/attach-to-a-container
                if (this.tty) {
                    this._handleTtyStream(stdout, false);
                    this._handleTtyStream(stderr, true);
                } else {
                    this._handleNonTtyStream(stdout, false);
                    this._handleNonTtyStream(stderr, true);
                }

                stdout.on('end', () => {
                    try {
                        logger.info(`stdout end event was fired for container: ${this.containerId}`);

                        logger.warn('stdoutend: dumping wtfnode stats');
                        wtf.dump();
                        logger.warn('stdoutend: finished dumping wtfnode stats');

                        if (this.onDockerNodeTerminationHandler &&
                            !this.dockerNodeTerminationHandlerFired) {
                            logger.warn(
                                'Triggering Docker node termination handler (from stdout handler).');
                            this.dockerNodeTerminationHandlerFired = true;
                            this.onDockerNodeTerminationHandler();
                        }
                    } catch (err) {
                        console.log('ContainerLogger stdout.end exception');
                        console.log(err);
                    }
                });

                stderr.on('end', () => {
                    try {
                        logger.info(`stderr end event was fired for container: ${this.containerId}`);

                        logger.warn('stderrend: dumping wtfnode stats');
                        wtf.dump();
                        logger.warn('stderrend: finished dumping wtfnode stats');

                        if (this.onDockerNodeTerminationHandler &&
                            !this.dockerNodeTerminationHandlerFired) {
                            logger.warn(
                                'Triggering Docker node termination handler (from stderr handler).');
                            this.dockerNodeTerminationHandlerFired = true;
                            this.onDockerNodeTerminationHandler();
                        }

                    } catch (err) {
                        console.log('ContainerLogger stderr.end exception');
                        console.log(err);
                    }
                });
            }, (err) => {
                return Q.reject(new CFError({
                    cause: err,
                    message: `Failed to handle container:${this.containerId}`
                }));
            });
    }

    _getAttachStrategyStream() {
        return Q.all([
            Q.ninvoke(this.containerInterface, 'attach', {
                stream: true,
                stdout: true,
                stderr: false,
                tty: true
            }),
            Q.ninvoke(this.containerInterface, 'attach', {
                stream: true,
                stdout: false,
                stderr: true,
                tty: true
            })
        ]);
    }

    _getLogsStrategyStream() {
        return Q.all([
            Q.ninvoke(this.containerInterface, 'logs', {
                follow: 1,
                stdout: 1,
                stderr: 0
            }),
            Q.ninvoke(this.containerInterface, 'logs', {
                follow: 1,
                stdout: 0,
                stderr: 1
            })
        ]);
    }

    _handleTtyStream(stream, isError) {
        stream.on('data', (chunk) => {
            try {
                const buf = new Buffer(chunk);

                const message = buf.toString('utf8');
                this._logMessageToFirebase(message, isError);
            } catch (err) {
                console.log('ContainerLogger data exception');
                console.log(err);
            }
        });
        logger.info(`Listening on stream 'data' event for container: ${this.containerId}`);
    }

    _handleNonTtyStream(stream, isError) {
        stream.on('readable', () => {
            try {
                let header = stream.read(8);
                while (header !== null) {
                    const payload = stream.read(header.readUInt32BE(4));
                    if (payload === null) {
                        break;
                    }
                    this._logMessageToFirebase(new Buffer(payload).toString('utf8'), isError);
                    header = stream.read(8);
                }
            } catch (err) {
                console.log('ContainerLogger readable exception');
                console.log(err);
            }
        });
        logger.info(`Listening on stream 'readable' event for container: ${this.containerId}`);
    }

    _logMessageToFirebase(message, isError) {
        if (isError) {
            message = `\x1B[31m${message}\x1B[0m`;
        }

        this.firebaseLogger.push(message);
        this.firebaseLastUpdate.set(new Date().getTime());
    }

}

module.exports = ContainerLogger;
