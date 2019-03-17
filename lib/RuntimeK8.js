'use strict';

const fs                      = require('fs');
const _                       = require('lodash');
const Docker                  = require('dockerode');
const DockerEvents            = require('docker-events');
const CFError                 = require('cf-errors');
const logger                  = require('cf-logs').Logger('codefresh:runtimeK8');
const ContainerStatus         = require('./enums').ContainerStatus;
const LoggerStrategy          = require('./enums').LoggerStrategy;
const ContainerHandlingStatus = require('./enums').ContainerHandlingStatus;
const k8s                     =  require('@kubernetes/client-node');
const RuntimeStepK8           = require('./RuntimeStepK8');
const RuntimeBase             = require('./RuntimeBase');
const { TYPES }               = require('./enums');


class RuntimeK8 extends RuntimeBase {

    constructor(opts) {
        super(opts);
    }

    static async factory(opts) {
        const runtimeLogger = new RuntimeK8(opts);

        const kc = new k8s.KubeConfig();
        if (process.env.DEFAULT_KUBE_CONFIG) {
            kc.loadFromDefault();
        } else {
            kc.loadFromCluster();
        }

        runtimeLogger.kc = kc;

        return runtimeLogger;
    }

    /**
     * receives a container and decides if to start listening on it
     * @param loggerId
     * @param docker
     * @param newContainer
     */
    async _handlePod(pod) { // jshint ignore:line
        const containerId                   = _.get(pod, 'metadata.name');
        const podStatusPhase                = _.get(pod, 'status.phase');

        const containerRunning = _.get(pod, 'status.containerStatuses[0].state.running');

        const receivedLoggerId              = _.get(pod, 'metadata.labels', {})['io.codefresh.logger.id'];
        const runCreationLogic              = _.get(pod, 'metadata.labels', {})['io.codefresh.runCreationLogic'];
        const stepName                      = _.get(pod, 'metadata.labels', {})['io.codefresh.stepName'];
        const receivedLogSizeLimit          = _.get(pod, 'metadata.labels', {})['io.codefresh.logSizeLimit'];

        if (receivedLoggerId !== this.loggerId) {
            logger.info('Not handling');
            return;
        }

        if (!containerRunning) {
            logger.info(`Not handling pod: ${containerId}, container is not in running state`);
            return;
        }

        // Validate that we are not already listening on the container
        if (this.containerHandled(containerId)) {
            logger.info(`Not handling container: ${containerId}, status: '${podStatusPhase}' because this container was already handled previously`);
            return;
        }

        this.state[containerId] = { status: ContainerHandlingStatus.INITIALIZING };
        logger.info(`Handling pod: ${containerId}, status: '${podStatusPhase}'`);
        const stepLogger = this.taskLogger.create(stepName, undefined, runCreationLogic);
        logger.info(`Brought step logger for container: ${containerId}`);


        const logSizeLimit = receivedLogSizeLimit ? (parseInt(receivedLogSizeLimit) * 1000000) : undefined;

        const containerInterface = new k8s.Attach(this.kc);
        const runtimeStepDocker    = new RuntimeStepK8({
            containerId,
            containerInterface,
            stepLogger,
            logSizeLimit,
            isWorkflowLogSizeExceeded: this.logLimitExceeded.bind(this),
            namespace: 'default',
            containerName: 'step',
            tty: true
        });
        this.handleNewRuntimeStep(runtimeStepDocker);
    }

    /**
     * will listen for all new containers
     */
    _listenForNewContainers() {
        const watch = new k8s.Watch(this.kc);
        watch.watch('/api/v1/pods', {}, (type, obj) => {
                this._handlePod(obj);
            }, (err) => {
                console.log(err);
            });

        logger.info(`Started listening for new pods`);
    }

    /**
     * will listen on all existing containers
     */
    _listenForExistingContainers() {
    }

}
RuntimeK8.TYPE          = TYPES.K8;


module.exports = RuntimeK8;
