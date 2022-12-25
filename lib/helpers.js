const Q = require('q');
const { existsSync } = require('fs');
const path = require('path');

function _watchBuildTerminationSignalWindows(deferred) {
    setTimeout(() => {
        if (existsSync(path.resolve(__dirname, 'build_finished'))) {
            console.log('FOUND BUILD FINISHED FILE --- engine signaling build is finished');
            deferred.resolve();
        } else {
            _watchBuildTerminationSignalWindows(deferred);
        }
    }, 1000);
}

function _watchBuildTerminationSignal(deferred) {
    process.on('SIGUSR2', () => {
        console.log('GOT SIGUSR2 --- engine signaling build is finished');
        deferred.resolve();
    });
}

function watchForBuildFinishedSignal() {
    const deferred = Q.defer();

    if (process.platform === 'win32') {
        _watchBuildTerminationSignalWindows(deferred);
    } else {
        _watchBuildTerminationSignal(deferred);
    }

    return deferred.promise;
}

module.exports = {
    watchForBuildFinishedSignal,
};
