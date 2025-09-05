const chai = require('chai');
const sinon = require('sinon');
const { ContainerHandlingStatus } = require('../lib/enums');
const proxyquire = require('proxyquire');

const expect = chai.expect;
const exitSpy = sinon.spy();
const orgExit = process.exit;
const orgArgs = process.argv;

describe('isReady script', () => {
    beforeEach(() => {
        exitSpy.resetHistory();
        process.exit = exitSpy;
    });
    afterEach(() => {
        process.exit = orgExit;
        process.argv = orgArgs;
    });
    describe('Container Logger Checks', () => {
        it('Should check exit with 0 code if container logger is ready', async () => {
            const state = JSON.stringify({ status: 'ready', containers: {} })
            process.argv = [];
            const { isReady } = proxyquire('../lib/isReady.js', {
                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(0);
        });
        it('Should check exit with 1 code if container logger is not ready', async () => {
            const state = JSON.stringify({status: 'notReady', containers: {}})
            process.argv = [];
            const {isReady} = proxyquire('../lib/isReady.js', {
                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(1);
        });
    });
    describe('Container Checks', () => {
        it('Should check exit with 0 code if container is ready', async () => {
            const state = JSON.stringify({
                status: 'ready',
                containers: {'container-id': {status: ContainerHandlingStatus.LISTENING}}
            })
            process.argv = ['foo', 'bar', 'container-id'];
            const {isReady} = proxyquire('../lib/isReady.js', {
                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(0);
        });
        it('Should check exit with 0 code if container is waiting for start status', async () => {
            const state = JSON.stringify({
                status: 'ready',
                containers: {'container-id': {status: ContainerHandlingStatus.WAITING_FOR_START}}
            })
            process.argv = ['foo', 'bar', 'container-id'];
            const {isReady} = proxyquire('../lib/isReady.js', {
                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(0);
        });
        it('Should check exit with 0 code if container is finished status', async () => {
            const state = JSON.stringify({
                status: 'ready',
                containers: {'container-id': {status: ContainerHandlingStatus.FINISHED}}
            })
            process.argv = ['foo', 'bar', 'container-id'];
            const {isReady} = proxyquire('../lib/isReady.js', {
                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(0);
        });
        it('Should check exit with 1 code if container is not ready', async () => {
            const state = JSON.stringify({
                status: 'ready',
                containers: {'container-id': {status: ContainerHandlingStatus.INITIALIZING}}
            })
            process.argv = ['foo', 'bar', 'container-id'];
            const {isReady} = proxyquire('../lib/isReady.js', {

                'fs': {
                    readFileSync: () => Buffer.from(state),
                },
            });
            await isReady();
            expect(process.exit).to.have.been.calledOnceWith(1);
        });
    });
});
