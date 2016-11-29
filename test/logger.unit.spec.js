'use strict';

const proxyquire = require('proxyquire').noCallThru();
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
chai.use(sinonChai);

describe('Logger tests', () => {

    let processExit;

    before(() => {
        processExit = process.exit;
    });

    after(() => {
        process.exit = processExit;
    });

    describe('integration', () => {

        describe('positive tests', () => {

            it.skip('should successfully initiate and register a new container', (done) => {
                const processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                const stream = {
                    on: (event, callback) => {
                        if (event === 'data') {
                            callback('my meesage to log');
                        }                        else if (event === 'end') {
                            callback();
                            setTimeout(() => {
                                expect(getContainerSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(authWithCustomTokenSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterStartSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterOnSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(writeFileSpy).to.have.been.calledTwice; // jshint ignore:line
                                done();
                            }, 10);
                        }
                    }
                };

                const container = {
                    attach: (options, callback) => {
                        expect(options).to.deep.equal({
                            stream: true,
                            stdout: true,
                            stderr: true,
                            tty: true
                        });
                        callback(null, stream);
                    }
                };

                let getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal('newContainerId');
                    return container;
                });

                let firstWrite   = true;
                let writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal('{"status":"ready"}');
                    }                    else {
                        expect(content).to.equal('{"status":"ready","newContainerId":{"status":"created"}}');
                    }
                    firstWrite = false;
                    callback();
                });

                let authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal('firebaseSecret');
                    callback();
                });

                let emitterStartSpy = sinon.spy(); // jshint ignore:line
                let emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal('create');
                    callback({
                        id: 'newContainerId',
                        Actor: {
                            Attributes: {
                                'io.codefresh.loggerId': 'loggerId',
                                'io.codefresh.firebaseUrl': 'firebaseAuthUrl'
                            }
                        }
                    });
                });

                const Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal('firebaseAuthUrl');
                        return {
                            authWithCustomToken: authWithCustomTokenSpy,
                            child(child) {
                                if (child === 'logs') {
                                    return {
                                        push: sinon.spy()
                                    };
                                }                                else if (child === 'lastUpdate') {
                                    return {
                                        set: sinon.spy()
                                    };
                                }
                            }
                        };
                    },
                    'dockerode': function () {
                        return {
                            getContainer: getContainerSpy
                        };
                    },
                    'docker-events': function () {
                        return {
                            start: emitterStartSpy,
                            on: emitterOnSpy
                        };
                    },
                    'fs': {
                        writeFile: writeFileSpy
                    }

                });

                const logger = new Logger('loggerId', 'firebaseAuthUrl', 'firebaseSecret', false);
                logger.validate();
                logger.start();
            });

            it.skip('should not handle in case there is no firebase url label on a created container', (done) => {
                const processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                const stream = {
                    on: (event, callback) => {
                        if (event === 'data') {

                        }                        else if (event === 'end') {
                            callback();
                            setTimeout(() => {
                                expect(getContainerSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(authWithCustomTokenSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterStartSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterOnSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(writeFileSpy).to.have.been.calledTwice; // jshint ignore:line
                                expect(logger._listenForExistingContainers).to.have.been.calledOnce; // jshint ignore:line
                                done();
                            }, 10);
                        }
                    }
                };

                const container = {
                    attach: (options, callback) => {
                        expect(options).to.deep.equal({
                            stream: true,
                            stdout: true,
                            stderr: true,
                            tty: true
                        });
                        callback(null, stream);
                    }
                };

                let getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal('newContainerId');
                    return container;
                });

                let firstWrite   = true;
                let writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal('{"status":"ready"}');
                    }                    else {
                        expect(content).to.equal('{"status":"ready","newContainerId":{"status":"created"}}');
                    }
                    firstWrite = false;
                    callback();
                });

                let authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal('firebaseSecret');
                    callback();
                });

                let emitterStartSpy = sinon.spy(); // jshint ignore:line
                let emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal('create');
                    callback({
                        id: 'newContainerId',
                        Actor: {
                            Attributes: {
                                'io.codefresh.loggerId': 'loggerId'
                            }
                        }
                    });
                });

                const Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal('firebaseAuthUrl');
                        return {
                            authWithCustomToken: authWithCustomTokenSpy
                        };
                    },
                    'dockerode': function () {
                        return {
                            getContainer: getContainerSpy
                        };
                    },
                    'docker-events': function () {
                        return {
                            start: emitterStartSpy,
                            on: emitterOnSpy
                        };
                    },
                    'fs': {
                        writeFile: writeFileSpy
                    },
                    'cf-logs': {
                        Logger() {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy((message) => {
                                    expect(message).to.equal('Container: newContainerId does contain a firebaseUrl label. skipping');
                                    done();
                                }),
                                error: sinon.spy()
                            };
                        }
                    }

                });

                let logger                          = new Logger('loggerId', 'firebaseAuthUrl', 'firebaseSecret', 'true'); // jshint ignore:line
                logger._listenForExistingContainers = sinon.spy();
                logger.validate();
                logger.start();
            });

            it.skip('should not handle in case there is no loggerId label on a create container', (done) => {
                const processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                const stream = {
                    on: (event, callback) => {
                        if (event === 'data') {

                        }                        else if (event === 'end') {
                            callback();
                            setTimeout(() => {
                                expect(getContainerSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(authWithCustomTokenSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterStartSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(emitterOnSpy).to.have.been.calledOnce; // jshint ignore:line
                                expect(writeFileSpy).to.have.been.calledTwice; // jshint ignore:line
                                done();
                            }, 10);
                        }
                    }
                };

                const container = {
                    attach: (options, callback) => {
                        expect(options).to.deep.equal({
                            stream: true,
                            stdout: true,
                            stderr: true,
                            tty: true
                        });
                        callback(null, stream);
                    }
                };

                let getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal('newContainerId');
                    return container;
                });

                let firstWrite   = true;
                let writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal('{"status":"ready"}');
                    }                    else {
                        expect(content).to.equal('{"status":"ready","newContainerId":{"status":"created"}}');
                    }
                    firstWrite = false;
                    callback();
                });

                let authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal('firebaseSecret');
                    callback();
                });

                let emitterStartSpy = sinon.spy(); // jshint ignore:line
                let emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal('create');
                    callback({
                        id: 'newContainerId',
                        Actor: {
                            Attributes: {}
                        }
                    });
                });

                const infoSpy = sinon.spy();

                const Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal('firebaseAuthUrl');
                        return {
                            authWithCustomToken: authWithCustomTokenSpy
                        };
                    },
                    'dockerode': function () {
                        return {
                            getContainer: getContainerSpy
                        };
                    },
                    'docker-events': function () {
                        return {
                            start: emitterStartSpy,
                            on: emitterOnSpy
                        };
                    },
                    'fs': {
                        writeFile: writeFileSpy
                    },
                    'cf-logs': {
                        Logger() {
                            return {
                                info: infoSpy,
                                warn: sinon.spy((message) => {
                                    expect(message).to.equal('Container: newContainerId does contain a firebaseUrl label. skipping');
                                    done();
                                }),
                                error: sinon.spy()
                            };
                        }
                    }

                });

                const logger = new Logger('loggerId', 'firebaseAuthUrl', 'firebaseSecret');
                logger.validate();
                logger.start();
                setTimeout(() => {
                    expect(infoSpy).to.have.been.calledWith('Not handling new container: newContainerId. loggerId label: undefined');
                    done();
                }, 1000);
            });

        });

        describe('negative tests', () => {

            it('should fail in case no logger id was provided', (done) => {
                const errorSpy = sinon.spy();

                const processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith('Error: logger id is missing');
                    done();
                });
                process.exit       = processExitSpy;

                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger() {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                const logger = new Logger(null, 'firebaseAuthUrl', 'firebaseSecret');
                logger.validate();
            });

            it('should fail in case no firebase auth url was provided', (done) => {
                const errorSpy = sinon.spy();

                const processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith('Error: firebase auth url is missing');
                    done();
                });
                process.exit       = processExitSpy;

                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger() {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                const logger = new Logger('loggerId', null, 'firebaseSecret');
                logger.validate();
            });

            it('should fail in case no firebase secret was provided', (done) => {
                const errorSpy = sinon.spy();

                const processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith('Error: firebase secret is missing');
                    done();
                });
                process.exit       = processExitSpy;

                const Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger() {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                const logger = new Logger('loggerId', 'firebaseAuthUrl', null);
                logger.validate();
            });

            it('should fail in case authentication against firebase fails', (done) => {
                const errorSpy = sinon.spy();

                const processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy)
                        .to
                        .have
                        .been
                        .calledWith('Error: Failed to authenticate to firebase url firebaseAuthUrl; caused by Error: firebase auth error');
                    done();
                });
                process.exit       = processExitSpy;

                const authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal('firebaseSecret');
                    callback(new Error('firebase auth error'));
                });

                const Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal('firebaseAuthUrl');
                        return {
                            authWithCustomToken: authWithCustomTokenSpy
                        };
                    },
                    'dockerode': function () {
                        return {};
                    },
                    'cf-logs': {
                        Logger() {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                const logger = new Logger('loggerId', 'firebaseAuthUrl', 'firebaseSecret');
                logger.validate();
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
                    }
                });

                const logger              = new Logger();
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
                    }
                });

                const logger              = new Logger();
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
                    }
                });

                const logger    = new Logger();
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


});
