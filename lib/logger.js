'use strict';
var Docker       = require('dockerode');
var DockerEvents = require('docker-events');
var fs           = require('fs');
var Q            = require('q');
var Firebase     = require('firebase');
var logger       = require('cf-logs').Logger("codefresh:containerLogger");
var CFError      = require('cf-errors');
var _            = require('lodash');

class Logger {

    constructor(loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers) {
        this.state                  = { status: 'init' };
        this.firebaseAuthUrl        = firebaseAuthUrl;
        this.firebaseSecret         = firebaseSecret;
        this.loggerId               = loggerId;
        this.findExistingContainers = findExistingContainers === "true";
        this.docker                 = new Docker();
    }

    /**
     * validates the passed params of the constructor
     * @returns {*}
     */
    validate() {
        if (!this.firebaseAuthUrl) {
            return this._error(new CFError("firebase auth url is missing"));
        }
        if (!this.firebaseSecret) {
            return this._error(new CFError("firebase secret is missing"));
        }
        if (!this.loggerId) {
            return this._error(new CFError("logger id is missing"));
        }
    }

    /**
     * main entry point.
     * will attach it self to all created containers that their ids in their labels equals loggerId
     * will attach it self to all existing containers if requested
     * the container label should be 'io.codefresh.loggerId'
     * the path to write the containers logs will be passed through 'io.codefresh.firebaseUrl' label
     * @param loggerId
     * @param firebaseAuthUrl
     * @param firebaseSecret
     */
    start() {

        logger.info(`Logging container created for logger id: ${this.loggerId}`);

        var authRef = new Firebase(this.firebaseAuthUrl);
        authRef.authWithCustomToken(this.firebaseSecret, (err) => {
            if (err) {
                this._error(new CFError({
                    cause: err,
                    message: `Failed to authenticate to firebase url ${this.firebaseAuthUrl}`
                }));
                return;
            }
            logger.info(`Authenticated to firebase url: ${this.firebaseAuthUrl}`);

            this._listenForNewContainers();

            this.state.status = "ready";
            this._writeNewState();

            if (this.findExistingContainers) {
                this._listenForExistingContainers();
            }

        });

    };

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
        var filePath     = __dirname + "/state.json";
        var currentState = JSON.stringify(this.state);
        fs.writeFile(filePath, currentState, (err) => {
            if (err) {
                var error = new CFError({
                    cause: err,
                    message: 'failed to write state to file'
                });
                logger.error(error.toString());
            }
            else {
                logger.info(`State: ${currentState} updated and written to file: ${filePath}`);
            }
        });
    };

    /**
     * receives a container and decides if to start listening on it
     * @param loggerId
     * @param docker
     * @param newContainer
     */
    _handleContainer(container) {
        let receivedLoggerId    = _.get(container, "Labels", _.get(container, "Actor.Attributes"))["io.codefresh.loggerId"];
        let receivedFirebaseUrl = _.get(container, "Labels", _.get(container, "Actor.Attributes"))["io.codefresh.firebaseUrl"];
        let containerId         = container.Id || container.id;
        let containerLogger;

        if (receivedLoggerId === this.loggerId) {
            logger.info(`Handling container: ${containerId}`);
            if (!receivedFirebaseUrl) {
                logger.warn(`Container: ${containerId} does contain a firebaseUrl label. skipping`);
                return;
            }
            try {
                containerLogger = new Firebase(receivedFirebaseUrl);
            }
            catch (err) {
                var error = new CFError({
                    cause: err,
                    message: `Failed to create a new firebase ref`
                });
                logger.error(error.toString());
                return;
            }

            //TODO decide if to attach by checking if already attached
            var containerInterface = this.docker.getContainer(containerId);
            Q.ninvoke(containerInterface, 'attach', {
                    stream: true,
                    stdout: true,
                    stderr: true,
                    tty: true
                })
                .done((stream) => {
                    logger.info(`Attached stream to container: ${containerId}`);
                    stream.on('data', function (chunk) {
                        var buf     = new Buffer(chunk);
                        var message = buf.toString('utf8');
                        containerLogger.child("logs").push(message);
                        containerLogger.child("lastUpdate").set(new Date().getTime());
                    });
                    logger.info(`Listening on stream 'data' event for container: ${containerId}`);
                    stream.on('end', function () {
                        logger.info(`stream end event was fired for container: ${containerId}`);
                    });
                    this.state[containerId] = { status: "created" };
                    this._writeNewState();
                }, (err) => {
                    var error = new CFError({
                        cause: err,
                        message: `Failed to get a stream to container:${containerId}`,
                        containerId: containerId
                    });
                    logger.error(error.toString());
                });
        }
        else {
            logger.info(`Not handling new container: ${containerId}. loggerId label: ${receivedLoggerId}`);
        }
    };

    /**
     * will listen for all new containers
     */
    _listenForNewContainers() {
        var emitter = new DockerEvents({
            docker: this.docker
        });
        emitter.start();
        emitter.on("create", this._handleContainer.bind(this));

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