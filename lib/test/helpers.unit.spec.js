const proxyquire = require('proxyquire').noCallThru();
const chai = require('chai');
const sinon = require('sinon');

const expect = chai.expect;
const stubFsPromises = {
  writeFile: sinon.stub(),
  readFile: sinon.stub(),
};
const stubLogger = {
  debug: sinon.stub(),
  log: sinon.stub(),
  error: sinon.stub(),
};

describe('helpers', () => {
  afterEach(() => {
    for (const stub in stubFsPromises) {
      stubFsPromises[stub].resetHistory();
    }
    for (const stub in stubLogger) {
      stubLogger[stub].resetHistory();
    }
  });

  describe('saveServerAddress() and getServerAddress()', () => {
    describe('saveServerAddress()', () => {
      it('should write the server address to the file', async () => {
        const SERVER_ADDRESS_PATH = 'little/bobby/tables/we/call/him';
        const serverAddress = 'foo';
        const { saveServerAddress } = proxyquire('../helpers.js', {
          'node:fs/promises': stubFsPromises,
          'cf-logs': { Logger: () => stubLogger },
          './const': { SERVER_ADDRESS_PATH },
        });
        await saveServerAddress(serverAddress);
        expect(stubFsPromises.writeFile).to.have.been.calledOnceWithExactly(SERVER_ADDRESS_PATH, serverAddress, { encoding: 'utf8' });
      });

      it('should fail if the file cannot be written', async () => {
        const { saveServerAddress } = proxyquire('../helpers.js', {
          'node:fs/promises': stubFsPromises,
          'cf-logs': { Logger: () => stubLogger },
        });
        const expectedError = new Error('oh no');
        stubFsPromises.writeFile.rejects(expectedError);
        try {
          await saveServerAddress('foo');
          expect.fail('should have thrown an error');
        } catch (error) {
          expect(error).to.be.equal(expectedError);
          expect(stubLogger.error).to.have.been.calledOnceWithExactly(`Failed to save server address: ${expectedError}`);
        }
      });
    });

    describe('getServerAddress()', () => {
      it('should read the server address from the file', async () => {
        const SERVER_ADDRESS_PATH = 'little/bobby/tables/we/call/him';
        const serverAddress = 'foo';
        const { getServerAddress } = proxyquire('../helpers.js', {
          'node:fs/promises': stubFsPromises,
          'cf-logs': { Logger: () => stubLogger },
          './const': { SERVER_ADDRESS_PATH },
        });
        stubFsPromises.readFile.resolves(serverAddress);
        const result = await getServerAddress();
        expect(result).to.be.equal(serverAddress);
        expect(stubFsPromises.readFile).to.have.been.calledOnceWithExactly(SERVER_ADDRESS_PATH, { encoding: 'utf8' });
      });

      it('should fail if the file cannot be read', async () => {
        const { getServerAddress } = proxyquire('../helpers.js', {
          'node:fs/promises': stubFsPromises,
          'cf-logs': { Logger: () => stubLogger },
        });
        const expectedError = new Error('oh no');
        stubFsPromises.readFile.rejects(expectedError);
        try {
          await getServerAddress();
          expect.fail('should have thrown an error');
        } catch (error) {
          expect(error).to.be.equal(expectedError);
          expect(stubLogger.error).to.have.been.calledOnceWithExactly(`Failed to read server address: ${expectedError}`);
        }
      });
    });

    it('should write/read to/from the same location', async () => {
      const { saveServerAddress, getServerAddress } = require('../helpers.js');
      const serverAddress = 'http://g.codefresh.io';
      await saveServerAddress(serverAddress);
      const result = await getServerAddress();
      expect(result).to.be.equal(serverAddress);
    });
  });
});
