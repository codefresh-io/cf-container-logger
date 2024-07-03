/* jshint ignore:start */

const timers = require('node:timers/promises');
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
const { getPromiseWithResolvers } = require('../lib/helpers');
const proxyquire = require('proxyquire').noCallThru();
chai.use(sinonChai);

const originalProcessExit = process.exit;

describe('addNewMask', () => {
    before(() => {
        process.exit = sinon.spy();
    });

    beforeEach(() => {
        process.exit.resetHistory();
    });

    after(() => {
        process.exit = originalProcessExit;
    });

    describe('positive', () => {
        it('should send a request to add a secret', async () => {
            const rpSpy = sinon.spy(async () => ({ statusCode: 201 }));
            const deferredAddress = getPromiseWithResolvers();
            const addNewMask = proxyquire('../lib/addNewMask', {
                'request-promise': rpSpy,
                './logger': {
                    secretsServerAddress: deferredAddress.promise,
                },
            });
    
            const secret = {
                key: '123',
                value: 'ABC',
            };

            deferredAddress.resolve('http://127.0.0.1:1337');
            addNewMask(secret);
    
            await timers.setTimeout(10);
            expect(rpSpy).to.have.been.calledOnceWith({
                uri: `http://127.0.0.1:1337/secrets`,
                method: 'POST',
                json: true,
                body: secret,
                resolveWithFullResponse: true,
            });
            await timers.setTimeout(10);
            expect(process.exit).to.have.been.calledOnceWith(0);
        });
    });

    describe('negative', () => {
        it('should send a request to add a secret', async () => {
            const rpSpy = sinon.spy(async () => { throw 'could not send request';});
            deferredAddress = getPromiseWithResolvers();
            const addNewMask = proxyquire('../lib/addNewMask', {
                'request-promise': rpSpy,
                './logger': {
                    secretsServerAddress: deferredAddress.promise,
                },
            });
    
            const secret = {
                key: '123',
                value: 'ABC',
            };

            deferredAddress.resolve('http://127.0.0.1:1337');
            addNewMask(secret);
            await timers.setTimeout(10);
            expect(process.exit).to.have.been.calledOnceWith(1);
        });
    });
});
