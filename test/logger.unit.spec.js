var proxyquire = require('proxyquire').noCallThru();
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);

describe('Logger tests', function () {

    var processExit;

    before(() => {
        processExit = process.exit;
    });

    after(() => {
        process.exit = processExit;
    });

    describe('integration', () => {

        describe('positive tests', () => {

            it('should successfully initiate and register a new container', (done) => {
                var processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                var stream = {
                    on: (event, callback) => {
                        if (event === 'data') {
                            callback("my meesage to log");
                        }
                        else if (event === 'end') {
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

                var container = {
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

                var getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal("newContainerId");
                    return container;
                });

                var firstWrite   = true;
                var writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal("{\"status\":\"ready\"}");
                    }
                    else {
                        expect(content).to.equal("{\"status\":\"ready\",\"newContainerId\":{\"status\":\"created\"}}");
                    }
                    firstWrite = false;
                    callback();
                });

                var authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal("firebaseSecret");
                    callback();
                });

                var emitterStartSpy = sinon.spy(); // jshint ignore:line
                var emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal("create");
                    callback({
                        id: "newContainerId",
                        Actor: {
                            Attributes: {
                                "io.codefresh.loggerId": "loggerId",
                                "io.codefresh.firebaseUrl": "firebaseAuthUrl"
                            }
                        }
                    });
                });

                var Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal("firebaseAuthUrl");
                        return {
                            authWithCustomToken: authWithCustomTokenSpy,
                            child: function (child) {
                                if (child === "logs") {
                                    return {
                                        push: sinon.spy()
                                    };
                                }
                                else if (child === "lastUpdate") {
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

                var logger = new Logger("loggerId", "firebaseAuthUrl", "firebaseSecret", false);
                logger.validate();
                logger.start();
            });

            it('should not handle in case there is no firebase url label on a created container', (done) => {
                var processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                var stream = {
                    on: (event, callback) => {
                        if (event === 'data') {

                        }
                        else if (event === 'end') {
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

                var container = {
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

                var getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal("newContainerId");
                    return container;
                });

                var firstWrite   = true;
                var writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal("{\"status\":\"ready\"}");
                    }
                    else {
                        expect(content).to.equal("{\"status\":\"ready\",\"newContainerId\":{\"status\":\"created\"}}");
                    }
                    firstWrite = false;
                    callback();
                });

                var authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal("firebaseSecret");
                    callback();
                });

                var emitterStartSpy = sinon.spy(); // jshint ignore:line
                var emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal("create");
                    callback({
                        id: "newContainerId",
                        Actor: {
                            Attributes: {
                                "io.codefresh.loggerId": "loggerId"
                            }
                        }
                    });
                });

                var Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal("firebaseAuthUrl");
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
                        Logger: function () {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy((message) => {
                                    expect(message).to.equal("Container: newContainerId does contain a firebaseUrl label. skipping");
                                    done();
                                }),
                                error: sinon.spy()
                            };
                        }
                    }

                });

                var logger = new Logger("loggerId", "firebaseAuthUrl", "firebaseSecret", "true");
                logger._listenForExistingContainers = sinon.spy();
                logger.validate();
                logger.start();
            });

            it('should not handle in case there is no loggerId label on a create container', (done) => {
                var processExitSpy = sinon.spy((exitCode) => {
                    done(new Error(`process exit was called with exitCode ${exitCode}`));
                });
                process.exit       = processExitSpy;

                var stream = {
                    on: (event, callback) => {
                        if (event === 'data') {

                        }
                        else if (event === 'end') {
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

                var container = {
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

                var getContainerSpy = sinon.spy((containerId) => { // jshint ignore:line
                    expect(containerId).to.equal("newContainerId");
                    return container;
                });

                var firstWrite   = true;
                var writeFileSpy = sinon.spy((filePath, content, callback) => { // jshint ignore:line
                    if (firstWrite) {
                        expect(content).to.equal("{\"status\":\"ready\"}");
                    }
                    else {
                        expect(content).to.equal("{\"status\":\"ready\",\"newContainerId\":{\"status\":\"created\"}}");
                    }
                    firstWrite = false;
                    callback();
                });

                var authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal("firebaseSecret");
                    callback();
                });

                var emitterStartSpy = sinon.spy(); // jshint ignore:line
                var emitterOnSpy    = sinon.spy((event, callback) => { // jshint ignore:line
                    expect(event).to.equal("create");
                    callback({
                        id: "newContainerId",
                        Actor: {
                            Attributes: {}
                        }
                    });
                });

                var infoSpy = sinon.spy();

                var Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal("firebaseAuthUrl");
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
                        Logger: function () {
                            return {
                                info: infoSpy,
                                warn: sinon.spy((message) => {
                                    expect(message).to.equal("Container: newContainerId does contain a firebaseUrl label. skipping");
                                    done();
                                }),
                                error: sinon.spy()
                            };
                        }
                    }

                });

                var logger = new Logger("loggerId", "firebaseAuthUrl", "firebaseSecret");
                logger.validate();
                logger.start();
                setTimeout(() => {
                    expect(infoSpy).to.have.been.calledWith("Not handling new container: newContainerId. loggerId label: undefined");
                    done();
                }, 1000);
            });

        });

        describe('negative tests', () => {

            it('should fail in case no logger id was provided', (done) => {
                var errorSpy = sinon.spy();

                var processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith("Error: logger id is missing");
                    done();
                });
                process.exit       = processExitSpy;

                var Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: function () {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                var logger = new Logger(null, "firebaseAuthUrl", "firebaseSecret");
                logger.validate();
            });

            it('should fail in case no firebase auth url was provided', (done) => {
                var errorSpy = sinon.spy();

                var processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith("Error: firebase auth url is missing");
                    done();
                });
                process.exit       = processExitSpy;

                var Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: function () {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                var logger = new Logger("loggerId", null, "firebaseSecret");
                logger.validate();
            });

            it('should fail in case no firebase secret was provided', (done) => {
                var errorSpy = sinon.spy();

                var processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith("Error: firebase secret is missing");
                    done();
                });
                process.exit       = processExitSpy;

                var Logger = proxyquire('../lib/logger', {
                    'cf-logs': {
                        Logger: function () {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                var logger = new Logger("loggerId", "firebaseAuthUrl", null);
                logger.validate();
            });

            it('should fail in case authentication against firebase fails', (done) => {
                var errorSpy = sinon.spy();

                var processExitSpy = sinon.spy((exitCode) => {
                    expect(exitCode).to.equal(1);
                    expect(errorSpy).to.have.been.calledWith("Error: Failed to authenticate to firebase url firebaseAuthUrl; caused by Error: firebase auth error");
                    done();
                });
                process.exit       = processExitSpy;

                var authWithCustomTokenSpy = sinon.spy((secret, callback) => { // jshint ignore:line
                    expect(secret).to.equal("firebaseSecret");
                    callback(new Error("firebase auth error"));
                });

                var Logger = proxyquire('../lib/logger', {
                    'firebase': function (authUrl) {
                        expect(authUrl).to.equal("firebaseAuthUrl");
                        return {
                            authWithCustomToken: authWithCustomTokenSpy
                        };
                    },
                    'dockerode': function () {
                        return {};
                    },
                    'cf-logs': {
                        Logger: function () {
                            return {
                                info: sinon.spy(),
                                warn: sinon.spy(),
                                error: errorSpy
                            };
                        }
                    }

                });

                var logger = new Logger("loggerId", "firebaseAuthUrl", "firebaseSecret");
                logger.validate();
                logger.start();
            });


        });
    });

    describe('_listenForExistingContainers', () => {
        
        describe('positive', () => {
            
            it('should call handlerContainer according to the amount of containers returned', (done) => {
                var listContainersSpy = sinon.spy((callback) => {
                    callback(null, [{}, {}])
                });

                var Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    }
                });

                var logger = new Logger();
                logger._handleContainer = sinon.spy();
                logger._listenForExistingContainers();
                setTimeout(() => {
                    expect(logger._handleContainer).to.have.callCount(2);
                    done();
                }, 10);

            });

            it('should not call handleContainer in case of no returned containers', (done) => {
                var listContainersSpy = sinon.spy((callback) => {
                    callback(null, [])
                });

                var Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    }
                });

                var logger = new Logger();
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
                var listContainersSpy = sinon.spy((callback) => {
                    callback(new Error("getting containers error"));
                });

                var Logger = proxyquire('../lib/logger', {
                    'dockerode': function () {
                        return {
                            listContainers: listContainersSpy
                        };
                    }
                });

                var logger = new Logger();
                logger._error = sinon.spy((err) => {
                    expect(err.toString()).to.equal("Error: Query of existing containers failed; caused by Error: getting containers error");
                });
                logger._listenForExistingContainers();
                setTimeout(() => {
                    expect(logger._error).to.have.been.calledOnce; // jshint ignore:line
                    done();
                }, 10);

            });

        });
        
    })


});
