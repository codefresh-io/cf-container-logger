const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const proxyquire = require('proxyquire').noCallThru();

const expect = chai.expect;
chai.use(sinonChai);


describe('addNewMask', () => {
    const originalProcessExit = process.exit;
    const originalConsole = console;

    const stubGetServerAddress = sinon.stub();
    const stubProcessExit = sinon.stub();
    const stubLogger = {
        debug: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        log: sinon.stub(),
    };
    const stubGot = {
        post: sinon.stub().resolves({ statusCode: 201 }),
    };

    const secret = {
        key: '123',
        value: 'ABC',
    };

    before(async () => {
        process.exit = stubProcessExit;
        const { default: httpClient } = await import('got');
        sinon.stub(httpClient, 'post').callsFake(stubGot.post);
    });

    beforeEach(() => {
        stubProcessExit.resetHistory();
        stubGetServerAddress.resetHistory();
        for (const stub in stubLogger) {
            stubLogger[stub].resetHistory();
        }
        for (const stub in stubGot) {
            stubGot[stub].resetHistory();
        }
    });

    after(() => {
        process.exit = originalProcessExit;
        console = originalConsole;
    });

    describe('positive', () => {
        it('should send a request to add a secret', async () => {
            const serverAddress = 'https://xkcd.com/605/'
            stubGetServerAddress.resolves(serverAddress);
            stubGot.post.resolves({ statusCode: 201 });

            const { updateMasks, exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/init': {
                    terminate: () => ({
                        finally: callback => callback(),
                    })
                },
                './helpers': { getServerAddress: stubGetServerAddress },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            await updateMasks(secret);
            expect(stubGot.post).to.have.been.calledOnceWith(new URL('secrets', serverAddress), {
                json: secret,
                throwHttpErrors: false,
            });
            expect(stubProcessExit).to.have.been.calledOnceWith(0);
        });
    });

    describe('negative', () => {
        it('should fail if the server address is not available', async () => {
            stubGetServerAddress.rejects('could not get server address');
            const { updateMasks, exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/init': {
                    terminate: () => ({
                        finally: callback => callback(),
                    })
                },
                '@codefresh-io/cf-telemetry/logs': {
                    Logger: function() { return stubLogger },
                },
                './helpers': {
                    getServerAddress: stubGetServerAddress,
                },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            await updateMasks(secret);
            expect(stubLogger.error).to.have.been.calledOnceWith('could not create mask for secret: 123. Error: could not get server address');
            expect(stubProcessExit).to.have.been.calledOnceWith(1);
        });

        it('should fail if the server address is not valid URL', async () => {
            stubGetServerAddress.resolves('foo');
            const { updateMasks, exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/init': {
                    terminate: () => ({
                        finally: callback => callback(),
                    })
                },
                '@codefresh-io/cf-telemetry/logs': {
                    Logger: function() { return stubLogger },
                },
                './helpers': {
                    getServerAddress: stubGetServerAddress,
                },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            await updateMasks(secret);
            expect(stubLogger.error).to.have.been.calledOnceWith('could not create mask for secret: 123. Error: TypeError: Invalid URL');
            expect(stubProcessExit).to.have.been.calledOnceWith(1);
        });

        it('should fail if server responded not with 201', async () => {
            const serverAddress = 'https://g.codefresh.io'
            stubGetServerAddress.resolves(serverAddress);
            stubGot.post.resolves({
                statusCode: 500,
                body: 'Internal Server Error',
            });
            const { updateMasks, exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/init': {
                    terminate: () => ({
                        finally: callback => callback(),
                    })
                },
                '@codefresh-io/cf-telemetry/logs': {
                    Logger: function() { return stubLogger },
                },
                './helpers': { getServerAddress: stubGetServerAddress },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            await updateMasks(secret);
            expect(stubLogger.error).to.have.been.calledOnceWith('could not create mask for secret: 123. Server responded with: 500\n\nInternal Server Error');
            expect(stubProcessExit).to.have.been.calledOnceWith(1);
        });
    });

    describe('exitHandler', () => {
        it('should set exit code to 3 if the original exit code is 0 and variable was not masked', () => {
            const { exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/logs': {
                    Logger: function() { return stubLogger },
                },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            exitHandler(0);
            expect(process.exitCode).to.be.equal(3);
            expect(stubLogger.warn).to.have.been.calledOnceWith('Unexpected exit with code 0. Exiting with 3 instead');
            process.exitCode = undefined;
        });

        it('should set exit code to 3 if the original exit code is 0 and variable was not masked', () => {
            const { exitHandler } = proxyquire('../lib/addNewMask', {
                '@codefresh-io/cf-telemetry/logs': {
                    Logger: function() { return stubLogger },
                },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            if (process.exitCode !== undefined) {
                throw new Error('process.exitCode should be undefined to run this test');
            }
            process.exitCode = 0;
            exitHandler();
            expect(process.exitCode).to.be.equal(3);
            expect(stubLogger.warn).to.have.been.calledOnceWith('Unexpected exit with code 0. Exiting with 3 instead');
            process.exitCode = 0;
        });

        it('should not change exit code if the variable was masked successfully', async () => {
            const serverAddress = 'https://xkcd.com/605/'
            stubGetServerAddress.resolves(serverAddress);
            stubGot.post.resolves({ statusCode: 201 });
            const { updateMasks, exitHandler } = proxyquire('../lib/addNewMask', {
                './helpers': { getServerAddress: stubGetServerAddress },
            });
            process.listeners('exit').forEach((listener) => {
                if (listener === exitHandler) {
                    process.removeListener('exit', listener);
                }
            });
            await updateMasks(secret);
            expect(process.exitCode).not.to.be.equal(3);
            expect(stubLogger.warn).not.to.have.been.calledOnceWith('Unexpected exit with code 0. Exiting with 3 instead');
        });
    });
});
