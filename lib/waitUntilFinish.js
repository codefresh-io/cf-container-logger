const fs = require('fs');
const path = require('path');
const state = require('./state.json');

const timeout = Number.parseInt(process.argv[process.argv.length - 1]);
console.log('Timeout:', timeout);

let lastLogsDate = state.lastLogsDate;

function _finishOnTimeout() {
    const diff = Date.now() - lastLogsDate;

    const date = new Date(lastLogsDate);
    console.log('Last logs date:', date);
    console.log('Current date:', new Date());
    console.log(lastLogsDate);
    if (diff > timeout) {
        console.log('Timeout reached:', new Date());
        process.exit(0);
    }
}

function _checkTimeout() {
    _finishOnTimeout();
    setTimeout(_checkTimeout);
}

function run(filepath) {
    _checkTimeout();
    fs.watchFile(filepath, (curr) => {
        lastLogsDate = curr.mtimeMs;
    });
}

if (require.main === module) {
    run(path.resolve(__dirname, 'state.json'));
} else {
    module.exports = run;
}
