
const fs = require('fs');
const path = require('path');
const Q = require('q');

class Waiter {

    constructor(timeout, filepath, state) {
        this.timeout = timeout;
        this.filepath = filepath;
        this.state = state;
        this.finished = false;
    }

    _stateListener() {
        this.state = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    }


    _finishOnTimeout() {
        if (this.state.status === 'done') {
            console.log(`Task logger has flushed all logs. Finishing waiter...`);
            this._unwatchState();
            this.finished = true;
            clearInterval(this.sigInterval);
            this.deferred.resolve();
        }
    }

    _checkTimeout() {
        this._finishOnTimeout();
        if (!this.finished) {
            setTimeout(this._checkTimeout.bind(this), 100);
        }
    }

    run() {
        this.deferred = Q.defer();
        console.log(`Logs waiting timeout: ${this.timeout} millis`);
        this.sigInterval = setInterval(this._signalBuildFinished.bind(this), 10000);
        this._signalBuildFinished();
        this._checkTimeout();
        this._watchState();

        return this.deferred.promise;
    }

    _signalBuildFinished() {
        console.log(`sending SIGUSR2 to pid: ${this.state.pid} to signal that build is finished`);
        process.kill(Number.parseInt(this.state.pid), 'SIGUSR2');
    }

    _watchState() {
        fs.watchFile(this.filepath, { persistent: false, interval: 100 }, this._stateListener.bind(this));
    }

    _unwatchState() {
        fs.unwatchFile(this.filepath);
    }

    static wait(timeout, filepath) {
        const state = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        return new Waiter(timeout, filepath, state).run();
    }
}

if (require.main === module) {
    const timeout = Number.parseInt(process.argv[process.argv.length - 1]);
    const filepath = path.resolve(__dirname, 'state.json');
    Waiter.wait(timeout, filepath);
} else {
    module.exports = Waiter;
}
