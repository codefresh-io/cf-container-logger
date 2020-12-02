const { KubeConfig, Client } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const { existsSync } = require('fs');
const CFError = require('cf-errors');
const _ = require('lodash');

const { ContainerHandlingStatus } = require('../../enums');
const Base = require('../Base');
const ContainerLogger = require('./ContainerLogger');
const logger = require('cf-logs').Logger('codefresh:containerLogger:logger:kubernetes');


class KubernetesLogger extends Base {

    constructor({
        kubeClient,
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        super({ loggerId, taskLogger, state, logSizeLimit });
        this.kubeClient = kubeClient;
        this.labelSelector = `io.codefresh.logger.id=${this.loggerId}`;
    }

    static async build({
        loggerId,
        taskLogger,
        state,
        logSizeLimit,
    }) {
        logger.info('using kubernetes logger');

        const kubeconfig = new KubeConfig();
        if (process.env.KUBECONFIG && existsSync(process.env.KUBECONFIG)) {
            logger.info(`loading config from: ${process.env.KUBECONFIG}`);            
            
            kubeconfig.loadFromFile(process.env.KUBECONFIG);
        } else {
            logger.info(`loading in-cluster kubeconfig`);

            kubeconfig.loadFromCluster();
        }
        
        const backend = new Request({ kubeconfig });
        const client = new Client({ backend, version: 1.13 });
        await client.loadSpec();
        logger.info(`kubernetes api spec loaded`);

        return new KubernetesLogger({ kubeClient: client, loggerId, taskLogger, state, logSizeLimit });
    }

    async _handlePod(pod) {
        const podId = pod.metadata.uid;
        const receivedLoggerId = pod.metadata.labels['io.codefresh.logger.id'];
        const runCreationLogic = pod.metadata.labels['io.codefresh.runCreationLogic'];
        const receivedLogSizeLimit = pod.metadata.labels['io.codefresh.logger.logSizeLimit'];
        const steps = pod.metadata.labels['io.codefresh.logger.stepNames'] || pod.metadata.labels['io.codefresh.logger.stepName'];
        const containers = pod.metadata.labels['io.codefresh.logger.containers'] || pod.metadata.labels['io.codefresh.logger.container'];
        const logSizeLimit = receivedLogSizeLimit ? (parseInt(receivedLogSizeLimit) * 1000000) : undefined;

        if (!podId) {
            logger.error('Not handling pod because id is missing');
            return;
        }

        if (receivedLoggerId !== this.loggerId) {
            logger.info(`Not handling new pod: ${pod.metadata.name} because io.codefresh.logger.loggerId label doesn't match: ${this.loggerId}`);
            return;
        }

        if (!containers) {
            logger.error(`Not handling pod ${pod.metadata.name} because it has no io.codefresh.logger.containers or io.codefresh.logger.container labels`);
        }

        if (!steps) {
            logger.error(`Not handling pod ${pod.metadata.name} because it has no io.codefresh.logger.stepNames or io.codefresh.logger.stepName labels`);
        }
        
        // this will create an object where the keys are the containers name and the value is their matching step name.
        const stepContainers = _.zipObject(containers.split('.'), steps.split('.'));

        // Handle only containers that are not already handled
        const unhandledContainers = _.reduce(stepContainers, (acc, stepName, containerName) => {
            if (this._containerHandled(`${podId}_${containerName}`)) {
                logger.info(`Not handling container: ${containerName} pod: ${pod.metadata.name} because this container was already handled previously`);
                delete acc[containerName];
            }
            return acc;
        }, _.clone(stepContainers));

        // prepare container statuses object
        const containerStatuses = _.reduce(pod.status.containerStatuses || [], (acc, status) => {
            if (unhandledContainers[status.name]) {
                acc[status.name] = status;
            }
            return acc;
        }, {});
        
        // handle all unhandled containers
        return Promise.all(_.map(unhandledContainers, async (stepName, containerName) => {
            const containerId = `${podId}_${containerName}`;
            const containerStatus = containerStatuses[containerName];

            this.state.containers[containerId] = { status: ContainerHandlingStatus.INITIALIZING };
            logger.info(`Handling container: ${containerId}, status: ${JSON.stringify(_.get(containerStatus, 'state'))}`);
            const stepLogger = this.taskLogger.create(stepName, undefined, runCreationLogic);
            logger.info(`Brought step logger for container: ${containerId}`);
            
            const podApi = this.kubeClient.api.v1.namespaces(pod.metadata.namespace).pods(pod.metadata.name);
            const logStream = podApi.log.getStream({ qs: { container: containerName, follow: true } });
           
            const containerLogger = new ContainerLogger({
                containerId,
                stepName,
                stream: logStream,
                stepLogger,
                logSizeLimit,
                isWorkflowLogSizeExceeded: this.logLimitExceeded.bind(this),
            });
                
            containerLogger.on('message.logged', () => { this.emit('message.logged'); });
            containerLogger.once('end', () => { this.emit('container.end'); });

            return containerLogger.start()
                .then(() => {
                    this.containerLoggers.push(containerLogger);
                    this.state.containers[containerId] = { status: ContainerHandlingStatus.LISTENING };
                    this.emit('newState', this.state);
                }, (err) => {
                    this.state.containers[containerId] = { status: ContainerHandlingStatus.ERROR };
                    const error = new CFError({
                        cause: err,
                        message: `Failed to start logging for container: ${containerId}`,
                        containerId,
                    });
                    logger.error(error.toString());
                });
        }));
    }

    async listen() {
        logger.info(`starting to watch for pods with label-selector: ${this.labelSelector}`);

        const stream = await this.kubeClient.api.v1.watch.pods.getObjectStream({ qs: { labelSelector: this.labelSelector } });
        stream.on('error', (err) => { logger.error(`watch error: ${err}`); });
        stream.on('data', e => this._handlePod(e.object));
    }

    async findExisting() {
        const res = await this.kubeClient.api.v1.pods.get({ qs: { labelSelector: this.labelSelector } });
        return await Promise.all(_.map(res.body.items, this._handlePod.bind(this)));
    }
}

module.exports = KubernetesLogger;