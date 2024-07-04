const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const SERVER_ADDRESS_PATH = resolve(tmpdir(), 'LOGGER_SERVER_ADDRESS');

module.exports = {
    SERVER_ADDRESS_PATH,
};
