const timers = require('node:timers/promises')
const Q = require('q');
const proxyquire = require('proxyquire').noCallThru();
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { EventEmitter } = require('events');
const { ContainerStatus } = require('../lib/enums');
const { LoggerStrategy } = require('../lib/enums');
const { getPromiseWithResolvers } = require('../lib/helpers');

const expect = chai.expect;
chai.use(sinonChai);

const mockAddress = 'mockAddress';
const stubFastifyPost = sinon.stub();
const stubFastifyGet = sinon.stub();
const stubFastifyListen = sinon.stub().resolves(mockAddress);
const stubFastify = sinon.stub().returns({
    listen: stubFastifyListen,
    post: stubFastifyPost,
    get: stubFastifyGet,
});
const stubSaveServerAddress = sinon.stub().resolves();

describe('Logger tests', () => {

    let processExit;

    before(() => {
        processExit = process.exit;
    });

    beforeEach(() => {
        stubFastify.resetHistory();
        stubFastifyPost.resetHistory();
        stubFastifyListen.resetHistory();
        stubSaveServerAddress.resetHistory();
    });

    after(() => {
        process.exit = processExit;
    });

    describe('constructor', () => {

        it('should define workflow log size limit default in case of non provided value', () => {
            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const firebaseAuthUrl = 'firebaseAuthUrl';
            const firebaseSecret = 'firebaseSecret';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const findExistingContainers = false;

            const logger = new Logger({
                loggerId,
                firebaseAuthUrl,
                firebaseSecret,
                findExistingContainers,
                firebaseMetricsLogsUrl
            });
            expect(logger.logSizeLimit).to.equal(Logger.WORKFLOW_LOG_SIZE_LIMIT);
        });

        it('should use passed workflow log size limit in case passed', () => {
            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const firebaseAuthUrl = 'firebaseAuthUrl';
            const firebaseSecret = 'firebaseSecret';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const findExistingContainers = false;
            const logSizeLimit = 5000;

            const logger = new Logger({
                loggerId,
                firebaseAuthUrl,
                firebaseSecret,
                findExistingContainers,
                firebaseMetricsLogsUrl,
                logSizeLimit
            });
            expect(logger.logSizeLimit).to.equal(logSizeLimit);
        });
    });

    describe('start', () => {

        describe('positive', () => {

            it('should start and not listen for existing container in case findExistingContainers param is false', async () => { // jshint ignore:line
                const taskLogger = { // jshint ignore:line
                    on: sinon.spy(),
                    restore: sinon.spy(() => Q.resolve()),
                    startHealthCheck: sinon.spy(),
                    onHealthCheckReported: sinon.spy(),
                    getStatus: sinon.spy(),
                };
                const TaskLoggerFactory = sinon.spy(() => {
                    return Q.resolve(taskLogger);
                });

                const Logger = proxyquire('../lib/logger', {
                    '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const taskLoggerConfig = { task: {}, opts: {} };
                const findExistingContainers = false;

                const logger = new Logger({
                    loggerId,
                    taskLoggerConfig,
                    findExistingContainers,
                });
                logger._listenForNewContainers = sinon.spy();
                logger._writeNewState = sinon.spy();
                logger._listenForExistingContainers = sinon.spy();
                logger.start();

                await Q.delay(10);
                expect(TaskLoggerFactory).to.have.been.calledWith(taskLoggerConfig.task, { ...taskLoggerConfig.opts, updateLogsRate: true });
                expect(logger._listenForNewContainers).to.have.been.calledOnce; // jshint ignore:line
                expect(logger._writeNewState).to.have.been.calledOnce; // jshint ignore:line
                expect(logger._listenForExistingContainers).to.not.have.been.called; // jshint ignore:line

            });

            it('should report health check status if failed', async () => { // jshint ignore:line
                let onHealthCheckReportedCb;
                const onHealthCheckReportedSpy = sinon.spy((func) => {
                    onHealthCheckReportedCb = func;
                });

                const taskLogger = { // jshint ignore:line
                    on: sinon.spy(),
                    restore: sinon.spy(() => Q.resolve()),
                    startHealthCheck: sinon.spy(),
                    onHealthCheckReported: onHealthCheckReportedSpy,
                    getStatus: sinon.spy(),
                };
                const TaskLoggerFactory = sinon.spy(() => {
                    return Q.resolve(taskLogger);
                });

                const Logger = proxyquire('../lib/logger', {
                    '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const taskLoggerConfig = { task: {}, opts: {} };
                const findExistingContainers = false;

                const logger = new Logger({
                    loggerId,
                    taskLoggerConfig,
                    findExistingContainers,
                });
                logger._listenForNewContainers = sinon.spy();
                logger._writeNewState = sinon.spy();
                logger._listenForExistingContainers = sinon.spy();
                logger.start();
                await Q.delay(10);
                onHealthCheckReportedCb({ status: 'failed' });
                expect(taskLogger.startHealthCheck).to.be.calledOnce;
                expect(logger.state.failedHealthChecks.length).to.be.equals(1);

            });

            it('should report health check status if succeed', async () => { // jshint ignore:line
                let onHealthCheckReportedCb;
                const onHealthCheckReportedSpy = sinon.spy((func) => {
                    onHealthCheckReportedCb = func;
                });

                const taskLogger = { // jshint ignore:line
                    on: sinon.spy(),
                    restore: sinon.spy(() => Q.resolve()),
                    startHealthCheck: sinon.spy(),
                    onHealthCheckReported: onHealthCheckReportedSpy,
                    getStatus: sinon.spy(),
                };
                const TaskLoggerFactory = sinon.spy(() => {
                    return Q.resolve(taskLogger);
                });

                const Logger = proxyquire('../lib/logger', {
                    '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const taskLoggerConfig = { task: {}, opts: {} };
                const findExistingContainers = false;

                const logger = new Logger({
                    loggerId,
                    taskLoggerConfig,
                    findExistingContainers,
                });
                logger._listenForNewContainers = sinon.spy();
                logger._writeNewState = sinon.spy();
                logger._listenForExistingContainers = sinon.spy();
                logger.start();


                await Q.delay(10);
                onHealthCheckReportedCb({ status: 'succeed' });

                expect(taskLogger.startHealthCheck).to.be.calledOnce;
                expect(logger.state.healthCheckStatus).to.deep.equal({ status: 'succeed' });

            });

            it('should start and listen for existing container in case findExistingContainers param is "true"', async () => {

                const taskLogger = {
                    on: sinon.spy(),
                    restore: sinon.spy(() => Q.resolve()),
                    startHealthCheck: sinon.spy(),
                    onHealthCheckReported: sinon.spy(),
                    getStatus: sinon.spy(),
                };
                const TaskLoggerFactory = sinon.spy(() => {
                    return Q.resolve(taskLogger);
                });

                const Logger = proxyquire('../lib/logger', {
                    '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const taskLoggerConfig = { task: {}, opts: {} };
                const findExistingContainers = 'true';

                const logger = new Logger({
                    loggerId,
                    taskLoggerConfig,
                    findExistingContainers
                });
                logger._listenForNewContainers = sinon.spy();
                logger._writeNewState = sinon.spy();
                logger._listenForExistingContainers = sinon.spy();
                logger.start();
                await Q.delay(10);
                expect(logger._listenForNewContainers).to.have.been.calledOnce; // jshint ignore:line
                expect(logger._writeNewState).to.have.been.calledOnce; // jshint ignore:line
                expect(logger._listenForExistingContainers).to.have.been.calledOnce; // jshint ignore:line

            });

        });

        describe('negative', () => {

            it('should call process exit in case creation of task logger failed', (done) => {
                let exited = false;
                const processExitSpy = sinon.spy((exitCode) => {
                    if (exited) {
                        return
                    } else {
                        exited = true;
                    }
                    expect(exitCode).to.equal(1);
                    done();
                });
                process.exit = processExitSpy;

                const TaskLoggerFactory = sinon.spy(() => {
                    return Q.reject(new Error('my error'));
                });

                const Logger = proxyquire('../lib/logger', {
                    '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const taskLoggerConfig = { task: {}, opts: {} };
                const findExistingContainers = false;

                const logger = new Logger({
                    loggerId,
                    taskLoggerConfig,
                    findExistingContainers,
                });
                logger.start();
            });

        });

    });

    describe('_listenForExistingContainers', () => {

        describe('positive', () => {

            it('should call handlerContainer according to the amount of containers returned', (done) => {
                const listContainersSpy = sinon.spy((callback) => {
                    callback(null, [{}, {}]);
                });

                const Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const logger = new Logger({});
                logger._handleContainer = sinon.spy();
                logger._listenForExistingContainers();
                setTimeout(() => {
                    expect(logger._handleContainer).to.have.callCount(2);
                    done();
                }, 10);

            });

            it('should not call handleContainer in case of no returned containers', (done) => {
                const listContainersSpy = sinon.spy((callback) => {
                    callback(null, []);
                });

                const Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const logger = new Logger({});
                logger._handleContainer = sinon.spy();
                logger._listenForExistingContainers();
                setTimeout(() => {
                    expect(logger._handleContainer).to.have.callCount(0);
                    done();
                }, 10);

            });

        });

        describe('negative', () => {

            it('should call _error in case of an error from getting the containers', (done) => {
                const listContainersSpy = sinon.spy((callback) => {
                    callback(new Error('getting containers error'));
                });

                const Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const logger = new Logger({});
                logger._error = sinon.spy((err) => {
                    expect(err.toString()).to.equal('Error: Query of existing containers failed; caused by Error: getting containers error');
                });
                logger._listenForExistingContainers();
                setTimeout(() => {
                    expect(logger._error).to.have.been.calledOnce; // jshint ignore:line
                    done();
                }, 10);

            });

        });

    });

    describe('_listenForNewContainers', () => {

        it('should call handleContainer in case of an create event', () => {
            const startSpy = sinon.spy();
            const onSpy = sinon.spy();
            const Logger = proxyquire('../lib/logger', {
                'docker-events': function () {
                    return {
                        start: startSpy,
                        on: onSpy
                    };
                },
                'dockerode': function () {
                    return {};
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const logger = new Logger({});
            logger._listenForNewContainers();
            expect(startSpy).to.have.been.calledOnce; // jshint ignore:line
            expect(onSpy.callCount).to.equal(2); // jshint ignore:line
        });

    });

    describe('_writeNewState', () => {

        it('should print a log message if write to file succeeded', () => {
            const writeFileSpy = sinon.spy((filePath, currentState, callback) => {
                callback();
            });

            const Logger = proxyquire('../lib/logger', {
                'fs': {
                    writeFile: writeFileSpy,
                    readFileSync: sinon.spy(() => {
                        return '{}';
                    }),
                    existsSync: () => { return true; }
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const logger = new Logger({});
            logger._writeNewState();
            expect(writeFileSpy).to.have.been.calledOnce; // jshint ignore:line
        });

        it('should print an error in case of a write error', () => {
            const writeFileSpy = sinon.spy((filePath, currentState, callback) => {
                callback(new Error('write error'));
            });

            const Logger = proxyquire('../lib/logger', {
                'fs': {
                    writeFile: writeFileSpy,
                    readFileSync: sinon.spy(() => {
                        return '{}';
                    }),
                    existsSync: () => { return true; },
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const logger = new Logger({});
            logger._writeNewState();
            expect(writeFileSpy).to.have.been.calledOnce; // jshint ignore:line
        });

    });

    describe('validate', () => {

        it('should call process exit in case firebase authentication url was not provided', () => {
            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const firebaseAuthUrl = 'firebaseAuthUrl';
            const firebaseSecret = 'firebaseSecret';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
            });
            logger.validate();

        });

        it('should call process exit in case firebase authentication url was not provided', (done) => {
            const processExitSpy = sinon.spy((exitCode) => {
                expect(exitCode).to.equal(1);
                done();
            });
            process.exit = processExitSpy;

            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const firebaseAuthUrl = '';
            const firebaseSecret = 'firebaseSecret';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
            });
            logger.validate();

        });

        it('should call process exit in case firebase secret was not provided', (done) => {
            const processExitSpy = sinon.spy((exitCode) => {
                expect(exitCode).to.equal(1);
                done();
            });
            process.exit = processExitSpy;

            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const firebaseAuthUrl = 'firebaseAuthUrl';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const firebaseSecret = '';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
            });
            logger.validate();

        });

        it('should call process exit in case firebase secret was not provided', (done) => {
            const processExitSpy = sinon.spy((exitCode) => {
                expect(exitCode).to.equal(1);
                done();
            });
            process.exit = processExitSpy;

            const Logger = proxyquire('../lib/logger', {
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = '';
            const firebaseAuthUrl = 'firebaseAuthUrl';
            const firebaseSecret = 'firebaseSecret';
            const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
            });
            logger.validate();

        });

    });

    describe('handle', () => {

        describe('handle container', () => {

            describe('handle', () => {

                describe('positive', () => {

                    it('valid process', (done) => {
                        const startSpy = sinon.spy(() => {
                            return Q.resolve();
                        });
                        const infoSpy = sinon.spy();
                        const errorSpy = sinon.spy();
                        const ContainerLoggerSpy = sinon.spy(() => {
                            const emitter = new EventEmitter();
                            emitter.start = startSpy;
                            return emitter;
                        });
                        const Logger = proxyquire('../lib/logger', {
                            'cf-logs': {
                                Logger: () => {
                                    return {
                                        info: infoSpy,
                                        error: errorSpy
                                    };

                                }
                            },
                            './ContainerLogger': ContainerLoggerSpy,
                            'fastify': stubFastify,
                            './helpers': {
                                saveServerAddress: stubSaveServerAddress,
                                getPromiseWithResolvers,
                            },
                        });

                        const loggerId = 'loggerId';
                        const findExistingContainers = false;
                        const logger = new Logger({
                            loggerId, findExistingContainers
                        });
                        logger._writeNewState = sinon.spy();
                        logger.taskLogger = {
                            on: sinon.spy(),
                            create: function () {
                                return {
                                    restore: sinon.spy(() => Q.resolve())
                                }
                            }
                        };
                        const container = {
                            Id: 'containerId',
                            Status: ContainerStatus.CREATE,
                            Labels: {
                                'io.codefresh.logger.id': 'loggerId',
                                'io.codefresh.logger.stepName': 'name',
                                'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                            }
                        };
                        logger._handleContainer(container);

                        setTimeout(() => {
                            expect(startSpy).to.have.been.calledOnce; // jshint ignore:line
                            expect(logger._writeNewState).to.have.been.calledOnce; // jshint ignore:line
                            done();
                        }, 10);
                    });

                    it('should pass received step log size limit to ContainerLogger', async () => {
                        const infoSpy = sinon.spy();
                        const errorSpy = sinon.spy();
                        const Logger = proxyquire('../lib/logger', {
                            'cf-logs': {
                                Logger: () => {
                                    return {
                                        info: infoSpy,
                                        error: errorSpy
                                    };

                                }
                            },
                            'firebase': function () {
                                return {};
                            },
                            'fastify': stubFastify,
                            './helpers': {
                                saveServerAddress: stubSaveServerAddress,
                                getPromiseWithResolvers,
                            },
                        });

                        const loggerId = 'loggerId';
                        const findExistingContainers = false;
                        const logger = new Logger({
                            loggerId, findExistingContainers
                        });
                        logger._writeNewState = sinon.spy();
                        logger.taskLogger = {
                            on: sinon.spy(),
                            create: function () {
                                return {
                                    restore: sinon.spy(() => Q.resolve())
                                }
                            }
                        };
                        const container = {
                            Id: 'containerId',
                            Status: ContainerStatus.CREATE,
                            Labels: {
                                'io.codefresh.logger.id': 'loggerId',
                                'io.codefresh.logger.stepName': 'name',
                                'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                                'io.codefresh.logger.logSizeLimit': '20',
                            }
                        };
                        logger._handleContainer(container);
                        await Q.delay(10);
                        expect(logger.containerLoggers[0].logSizeLimit).to.equal(20000000);
                    });

                    it('should pass undefined step log size limit to ContainerLogger in case of no label', async () => {
                        const infoSpy = sinon.spy();
                        const errorSpy = sinon.spy();
                        const Logger = proxyquire('../lib/logger', {
                            'cf-logs': {
                                Logger: () => {
                                    return {
                                        info: infoSpy,
                                        error: errorSpy
                                    };

                                }
                            },
                            'fastify': stubFastify,
                            './helpers': {
                                saveServerAddress: stubSaveServerAddress,
                                getPromiseWithResolvers,
                            },
                        });

                        const loggerId = 'loggerId';
                        const findExistingContainers = false;
                        const logger = new Logger({
                            loggerId, findExistingContainers
                        });
                        logger._writeNewState = sinon.spy();
                        logger.taskLogger = {
                            on: sinon.spy(),
                            create: function () {
                                return {
                                    restore: sinon.spy(() => Q.resolve())
                                }
                            }
                        };
                        const container = {
                            Id: 'containerId',
                            Status: ContainerStatus.CREATE,
                            Labels: {
                                'io.codefresh.logger.id': 'loggerId',
                                'io.codefresh.logger.stepName': 'name',
                                'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                            }
                        };
                        logger._handleContainer(container);
                        await Q.delay(10);
                        expect(logger.containerLoggers[0].logSizeLimit).to.equal(undefined);
                    });

                    it('should update total log size when new log message event was sent', async () => {
                        const infoSpy = sinon.spy();
                        const errorSpy = sinon.spy();
                        const Logger = proxyquire('../lib/logger', {
                            'cf-logs': {
                                Logger: () => {
                                    return {
                                        info: infoSpy,
                                        error: errorSpy
                                    };

                                }
                            },
                            'firebase': function () {
                                return {};
                            },
                            'fastify': stubFastify,
                            './helpers': {
                                saveServerAddress: stubSaveServerAddress,
                                getPromiseWithResolvers,
                            },
                        });

                        const loggerId = 'loggerId';
                        const findExistingContainers = false;
                        const logger = new Logger({
                            loggerId, findExistingContainers
                        });
                        logger._writeNewState = sinon.spy();
                        logger.taskLogger = {
                            on: sinon.spy(),
                            create: function () {
                                return {
                                    restore: sinon.spy(() => Q.resolve())
                                }
                            },
                            setLogSize: sinon.spy()
                        };

                        const container = {
                            Id: 'containerId',
                            Status: ContainerStatus.CREATE,
                            Labels: {
                                'io.codefresh.logger.id': 'loggerId',
                                'io.codefresh.logger.stepName': 'name',
                                'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                            }
                        };
                        logger._handleContainer(container);
                        await Q.delay(10);
                        expect(logger.totalLogSize).to.equal(0);
                        logger.containerLoggers[0].logSize = 1000;
                        logger.containerLoggers[0].emit('message.logged', 1000);
                        expect(logger.totalLogSize).to.equal(1000);
                        expect(logger.taskLogger.setLogSize).to.have.been.calledWith(1000);
                    });

                });

                describe('should print an error in case firebase ref fails', () => {

                    it('error while starting the container logger instance', (done) => {
                        const startSpy = sinon.spy(() => {
                            return Q.reject(new Error('ContainerLogger error'));
                        });
                        const infoSpy = sinon.spy();
                        const errorSpy = sinon.spy();
                        const Logger = proxyquire('../lib/logger', {
                            'cf-logs': {
                                Logger: () => {
                                    return {
                                        info: infoSpy,
                                        error: errorSpy
                                    };

                                }
                            },
                            'firebase': function () {
                                return {};
                            },
                            './ContainerLogger': function () {
                                const emitter = new EventEmitter();
                                emitter.start = startSpy;
                                return emitter;
                            },
                            'fastify': stubFastify,
                            './helpers': {
                                saveServerAddress: stubSaveServerAddress,
                                getPromiseWithResolvers,
                            },
                        });

                        const loggerId = 'loggerId';
                        const findExistingContainers = false;
                        const logger = new Logger({
                            loggerId, findExistingContainers
                        });
                        logger._writeNewState = sinon.spy();
                        logger.taskLogger = {
                            on: sinon.spy(),
                            create: function () {
                                return {
                                    restore: sinon.spy(() => Q.resolve())
                                }
                            },
                            setLogSize: sinon.spy()
                        };
                        const container = {
                            Id: 'containerId',
                            Status: ContainerStatus.CREATE,
                            Labels: {
                                'io.codefresh.logger.id': 'loggerId',
                                'io.codefresh.logger.stepName': 'name',
                                'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                            }
                        };
                        logger._handleContainer(container);

                        setTimeout(() => {
                            expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                            expect(errorSpy)
                                .to
                                .have
                                .been
                                .calledWith('Error: Failed to start logging for container:containerId; caused by Error: ContainerLogger error'); // jshint ignore:line
                            done();
                        }, 10);

                    });

                });

            });

        });

        describe('do not handle container because it does not need handling', () => {

            it('was previously handled', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const firebaseAuthUrl = 'firebaseAuthUrl';
                const firebaseSecret = 'firebaseSecret';
                const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
                });
                const container = {
                    Id: 'containerId',
                    Status: 'start',
                    Labels: {
                        'io.codefresh.logger.firebase.logsUrl': 'firebaseUrl',
                        'io.codefresh.logger.strategy': LoggerStrategy.LOGS
                    }
                };
                logger._containerHandled = sinon.spy(() => {
                    return true;
                });
                logger._handleContainer(container);

                expect(infoSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(infoSpy)
                    .to
                    .have
                    .been
                    .calledWith('Not handling container: containerId, status: \'start\' because this container was already handled previously');

            });

            it('no loggerId', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const firebaseAuthUrl = 'firebaseAuthUrl';
                const firebaseSecret = 'firebaseSecret';
                const firebaseMetricsLogsUrl = 'firebaseMetricsLogsUrl';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, firebaseAuthUrl, firebaseSecret, findExistingContainers, firebaseMetricsLogsUrl
                });
                const container = {
                    Id: 'containerId',
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.firebase.logsUrl': 'firebaseUrl',
                        'io.codefresh.logger.strategy': LoggerStrategy.LOGS
                    }
                };
                logger._handleContainer(container);
                expect(infoSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(infoSpy).to.have.been.calledWith('Not handling new container: containerId. loggerId label: undefined');

            });
        });

        describe('do not handle container because of missing details (error)', () => {

            it('no containerId', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                        'io.codefresh.logger.strategy': LoggerStrategy.LOGS
                    }
                };
                logger._handleContainer(container);
                expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(errorSpy).to.have.been.calledWith('Not handling container because id is missing');

            });

            it('no container status', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Id: 'containerId',
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                        'io.codefresh.logger.strategy': LoggerStrategy.LOGS
                    }
                };
                logger._handleContainer(container);
                expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(errorSpy).to.have.been.calledWith('Not handling container: containerId, because this container status is missing');

            });

            it('no step name', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Id: 'containerId',
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                    }
                };
                logger._handleContainer(container);
                expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(errorSpy).to.have.been.calledWith('Container: containerId does not contain a stepName label');

            });

            it('no strategy provided', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Id: 'containerId',
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                        'io.codefresh.logger.stepName': 'name',
                    }
                };
                logger._handleContainer(container);
                expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(errorSpy).to.have.been.calledWith('Container: containerId does not contain a loggerStrategy label');

            });

            it('provided strategy does not exist', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Id: 'containerId',
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                        'io.codefresh.logger.stepName': 'name',
                        'io.codefresh.logger.strategy': 'non-existing-strategy',
                    }
                };
                logger._handleContainer(container);
                expect(errorSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(errorSpy).to.have.been.calledWith('Container: containerId, loggerStrategy: \'non-existing-strategy\' is not supported');

            });

            it('container status is create and strategy is logs', () => {
                const infoSpy = sinon.spy();
                const errorSpy = sinon.spy();
                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: () => {
                            return {
                                info: infoSpy,
                                error: errorSpy
                            };

                        }
                    },
                    'fastify': stubFastify,
                    './helpers': {
                        saveServerAddress: stubSaveServerAddress,
                        getPromiseWithResolvers,
                    },
                });

                const loggerId = 'loggerId';
                const findExistingContainers = false;
                const logger = new Logger({
                    loggerId, findExistingContainers
                });
                const container = {
                    Id: 'containerId',
                    Status: ContainerStatus.CREATE,
                    Labels: {
                        'io.codefresh.logger.id': 'loggerId',
                        'io.codefresh.logger.stepName': 'name',
                        'io.codefresh.logger.strategy': LoggerStrategy.LOGS,
                    }
                };
                logger._handleContainer(container);
                expect(infoSpy).to.have.been.calledOnce; // jshint ignore:line
                expect(infoSpy)
                    .to
                    .have
                    .been
                    .calledWith(
                        'Not handling container: containerId on \'create\' status because logging strategy is: logs which needs to wait for \'start\' status');

            });

        });

    });

    describe('log limit exceeded', () => {

        it('should return true in case log limit exceeded', async () => {
            const infoSpy = sinon.spy();
            const errorSpy = sinon.spy();
            const Logger = proxyquire('../lib/logger', {
                'cf-logs': {
                    Logger: () => {
                        return {
                            info: infoSpy,
                            error: errorSpy
                        };

                    }
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, findExistingContainers
            });
            logger._writeNewState = sinon.spy();

            logger.taskLogger = {
                on: sinon.spy(),
                create: function () {
                    return {
                        restore: sinon.spy(() => Q.resolve())
                    }
                },
                setLogSize: sinon.spy()
            };

            const container = {
                Id: 'containerId',
                Status: ContainerStatus.CREATE,
                Labels: {
                    'io.codefresh.logger.id': 'loggerId',
                    'io.codefresh.logger.stepName': 'name',
                    'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                }
            };
            logger.logSizeLimit = 100;
            logger._handleContainer(container);
            await Q.delay(10);
            logger.containerLoggers[0].emit('message.logged', logger.logSizeLimit + 1);
            expect(logger.logLimitExceeded()).to.equal(true);
        });

        it('should return false in case log limit not exceeded', async () => {
            const infoSpy = sinon.spy();
            const errorSpy = sinon.spy();
            const Logger = proxyquire('../lib/logger', {
                'cf-logs': {
                    Logger: () => {
                        return {
                            info: infoSpy,
                            error: errorSpy
                        };

                    }
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, findExistingContainers
            });
            logger._writeNewState = sinon.spy();
            const setSpy = sinon.spy();
            logger.firebaseMetricsLogs = {
                child: () => {
                    return {
                        set: setSpy
                    };
                }
            };

            logger.taskLogger = {
                on: sinon.spy(),
                create: function () {
                    return {
                        restore: sinon.spy(() => Q.resolve())
                    }
                },
                setLogSize: sinon.spy()
            };

            const container = {
                Id: 'containerId',
                Status: ContainerStatus.CREATE,
                Labels: {
                    'io.codefresh.logger.id': 'loggerId',
                    'io.codefresh.logger.stepName': 'name',
                    'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                }
            };
            logger.logSizeLimit = 11;
            logger._handleContainer(container);
            await Q.delay(10);
            logger.containerLoggers[0].logSize = 10;
            expect(logger.logLimitExceeded()).to.equal(false);
        });

        it('should return false in case log limit was not defined', async () => {
            const infoSpy = sinon.spy();
            const errorSpy = sinon.spy();
            const Logger = proxyquire('../lib/logger', {
                'cf-logs': {
                    Logger: () => {
                        return {
                            info: infoSpy,
                            error: errorSpy
                        };

                    }
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, findExistingContainers
            });
            logger._writeNewState = sinon.spy();

            logger.taskLogger = {
                on: sinon.spy(),
                create: function () {
                    return {
                        restore: sinon.spy(() => Q.resolve())
                    }
                },
                setLogSize: sinon.spy()
            };

            const container = {
                Id: 'containerId',
                Status: ContainerStatus.CREATE,
                Labels: {
                    'io.codefresh.logger.id': 'loggerId',
                    'io.codefresh.logger.stepName': 'name',
                    'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                }
            };
            logger._handleContainer(container);
            await Q.delay(10);
            logger.containerLoggers[0].logSize = 10;
            expect(logger.logLimitExceeded()).to.equal(undefined);
        });

    });

    describe('total log size', () => {

        it('should return true in case log limit exceeded for one container logger', async () => {
            const infoSpy = sinon.spy();
            const errorSpy = sinon.spy();
            const Logger = proxyquire('../lib/logger', {
                'cf-logs': {
                    Logger: () => {
                        return {
                            info: infoSpy,
                            error: errorSpy
                        };

                    }
                },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, findExistingContainers
            });
            logger._writeNewState = sinon.spy();
            logger.taskLogger = {
                on: sinon.spy(),
                create: function () {
                    return {
                        restore: sinon.spy(() => Q.resolve())
                    }
                },
                setLogSize: sinon.spy()
            };

            const container = {
                Id: 'containerId',
                Status: ContainerStatus.CREATE,
                Labels: {
                    'io.codefresh.logger.id': 'loggerId',
                    'io.codefresh.logger.stepName': 'name',
                    'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                }
            };
            logger._handleContainer(container);
            await Q.delay(10);
            logger.containerLoggers[0].emit('message.logged', 1000);
            expect(logger.totalLogSize).to.equal(1000);
        });

        it('should return true in case log limit exceeded for two container loggers', async () => {
            const infoSpy = sinon.spy();
            const errorSpy = sinon.spy();
            const ContainerLoggerSpy = sinon.spy(() => {
                const emitter = new EventEmitter();
                emitter.start = sinon.spy(() => Q.resolve());
                return emitter;
            });
            const Logger = proxyquire('../lib/logger', {
                'cf-logs': {
                    Logger: () => {
                        return {
                            info: infoSpy,
                            error: errorSpy
                        };

                    }
                },
                './ContainerLogger': ContainerLoggerSpy,
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const findExistingContainers = false;
            const logger = new Logger({
                loggerId, findExistingContainers
            });
            logger._writeNewState = sinon.spy();
            logger.taskLogger = {
                on: sinon.spy(),
                create: function () {
                    return {
                        restore: sinon.spy(() => Q.resolve())
                    }
                },
                setLogSize: sinon.spy()
            };

            const container = {
                Id: 'containerId',
                Status: ContainerStatus.CREATE,
                Labels: {
                    'io.codefresh.logger.id': 'loggerId',
                    'io.codefresh.logger.stepName': 'name',
                    'io.codefresh.logger.strategy': LoggerStrategy.ATTACH,
                }
            };
            logger._handleContainer(container);
            container.Id = 'newid';
            logger._handleContainer(container);
            await Q.delay(10);
            logger.containerLoggers[0].emit('message.logged', 1000);
            logger.containerLoggers[1].emit('message.logged', 1000);
            expect(logger.totalLogSize).to.equal(2000);
            expect(logger.taskLogger.setLogSize).to.have.been.calledWith(2000);
        });

    });

    describe('_handleContainerStreamEnd', () => {
        it('should change status to done if build finished & all streams closed & all messages flushed', async () => {
            const taskLogger = new EventEmitter();
            taskLogger.restore = sinon.spy(() => Q.resolve());
            taskLogger.startHealthCheck = sinon.spy();
            taskLogger.onHealthCheckReported = sinon.spy();
            taskLogger.create = sinon.spy();
            taskLogger.getStatus = sinon.spy();
            const awaitLogsFlushed = Q.defer();
            taskLogger.awaitLogsFlushed = () => awaitLogsFlushed.promise;

            const dockerEvents = new EventEmitter();
            dockerEvents.start = () => { };

            const containerLogger = new EventEmitter();
            containerLogger.start = () => Q.resolve();

            const Logger = proxyquire('../lib/logger', {
                '@codefresh-io/task-logger': { TaskLogger: () => Q.resolve(taskLogger) },
                'docker-events': function () { return dockerEvents; },
                './ContainerLogger': function () { return containerLogger; },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const taskLoggerConfig = { task: {}, opts: {} };
            const findExistingContainers = false;
            const buildFinishedPromise = Q.defer();

            const logger = new Logger({
                loggerId,
                taskLoggerConfig,
                findExistingContainers,
                buildFinishedPromise: buildFinishedPromise.promise,
            });
            logger._writeNewState = () => { };

            const container = {
                Id: 'containerId',
                Status: 'running',
                Labels: {
                    'io.codefresh.logger.id': loggerId,
                    'io.codefresh.runCreationLogic': true,
                    'io.codefresh.logger.stepName': 's1',
                    'io.codefresh.logger.strategy': 'attach',
                }
            }


            logger.start();
            await Q.delay(10);
            expect(logger.containerLoggers).to.have.lengthOf(0);

            // create 1st container
            dockerEvents.emit('create', container);
            await Q.delay(10);
            expect(logger.containerLoggers).to.have.lengthOf(1);
            let allStreamsClosed1 = false;
            logger._awaitAllStreamsClosed().then(() => {
                allStreamsClosed1 = true;
            });
            expect(allStreamsClosed1).to.be.false;

            // end 1st container
            containerLogger.emit('end');
            await Q.delay(10);
            expect(allStreamsClosed1).to.be.true;

            // create a 2nd container
            container.Id = 'containerId2';
            dockerEvents.emit('create', container);
            buildFinishedPromise.resolve(); // build is now finished
            await Q.delay(10);
            expect(logger.containerLoggers).to.have.lengthOf(2);
            let allStreamsClosed2 = false;
            logger._awaitAllStreamsClosed().then(() => {
                allStreamsClosed2 = true;
            });
            expect(allStreamsClosed2).to.be.false;

            // end 2nd container
            containerLogger.emit('end');
            await Q.delay(10);
            expect(allStreamsClosed2).to.be.true;

            // all logs flushed
            awaitLogsFlushed.resolve();
            await Q.delay(10);
            expect(logger.state.status).to.be.equal('done');
        });
    });

    describe('_updateLastLoggingDate', () => {
        it('should update last logging date when logs flush', async () => {
            const taskLogger = new EventEmitter();
            taskLogger.restore = sinon.spy(() => Q.resolve());
            taskLogger.startHealthCheck = sinon.spy();
            taskLogger.onHealthCheckReported = sinon.spy();
            taskLogger.create = sinon.spy();
            taskLogger.getStatus = sinon.spy();

            const dockerEvents = new EventEmitter();
            dockerEvents.start = () => { };

            const containerLogger = new EventEmitter();
            containerLogger.start = () => Q.resolve();

            const Logger = proxyquire('../lib/logger', {
                '@codefresh-io/task-logger': { TaskLogger: () => Q.resolve(taskLogger) },
                'docker-events': function () { return dockerEvents; },
                './ContainerLogger': function () { return containerLogger; },
                'fastify': stubFastify,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const logger = new Logger({
                loggerId: 'loggerId',
                taskLoggerConfig: { task: {}, opts: {} },
                findExistingContainers: false,
                buildFinishedPromise: Q.defer().promise,
            });
            logger._writeNewState = () => { };
            logger._updateLastLoggingDate = sinon.spy();
            logger.start();
            await Q.delay(10);

            expect(logger._updateLastLoggingDate).to.not.have.been.called;

            taskLogger.emit('flush');
            await Q.delay(10);

            expect(logger._updateLastLoggingDate).to.have.been.calledOnce;
        });
    });

    describe('engine updates', () => {
        it('should listen for engine updates', async () => {
            const taskLogger = {
                on: sinon.spy(),
                restore: sinon.spy(async () => {}),
                startHealthCheck: sinon.spy(),
                onHealthCheckReported: sinon.spy(),
                getStatus: sinon.spy(),
            };
            const TaskLoggerFactory = sinon.spy(async () => taskLogger);

            const HttpServer = proxyquire('../lib/http-server', {
                'fastify': stubFastify,
                '../helpers': {
                    saveServerAddress: stubSaveServerAddress,
                }
            });

            const Logger = proxyquire('../lib/logger', {
                '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                './http-server': HttpServer,
                './helpers': {
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const taskLoggerConfig = { task: {}, opts: {} };
            const findExistingContainers = false;

            process.env.PORT = 1337;
            process.env.HOST = '127.0.0.1';
            const logger = new Logger({
                loggerId,
                taskLoggerConfig,
                findExistingContainers,
            });
            logger._listenForNewContainers = sinon.spy();
            logger._writeNewState = sinon.spy();
            logger._listenForExistingContainers = sinon.spy();
            await logger.start();

            expect(stubFastify).to.have.been.calledOnce;
            expect(stubFastifyListen).to.have.been.calledOnceWithExactly({
                port: 1337,
                host: '127.0.0.1',
            });
            expect(stubSaveServerAddress).to.have.been.calledOnceWithExactly(mockAddress);
        });

        it('should fails if unable to start server', async () => {
            const taskLogger = {
                on: sinon.spy(),
                restore: sinon.spy(async () => {}),
                startHealthCheck: sinon.spy(),
                onHealthCheckReported: sinon.spy(),
                getStatus: sinon.spy(),
            };
            const TaskLoggerFactory = sinon.spy(async () => taskLogger);

            const HttpServer = proxyquire('../lib/http-server', {
                'fastify': stubFastify,
            });

            const Logger = proxyquire('../lib/logger', {
                '@codefresh-io/task-logger': { TaskLogger: TaskLoggerFactory },
                './http-server': HttpServer,
                './helpers': {
                    saveServerAddress: stubSaveServerAddress,
                    getPromiseWithResolvers,
                },
            });

            const loggerId = 'loggerId';
            const taskLoggerConfig = { task: {}, opts: {} };
            const findExistingContainers = false;

            const logger = new Logger({
                loggerId,
                taskLoggerConfig,
                findExistingContainers,
            });
            logger._listenForNewContainers = sinon.spy();
            logger._writeNewState = sinon.spy();
            logger._listenForExistingContainers = sinon.spy();

            const expectedError = new Error('failed to start server');
            stubFastifyListen.rejects(expectedError);
            try {
                await logger.start();
                expect.fail('should have thrown an error');
            } catch (error) {
                expect(error).to.equal(expectedError);
            }
        });
    });
});
