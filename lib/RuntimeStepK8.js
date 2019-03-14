const Q               = require('q');
const strs            = require('stringstream');
const logger          = require('cf-logs').Logger('codefresh:podLogger');
const CFError         = require('cf-errors');
const LoggerStrategy  = require('./enums').LoggerStrategy;
const RuntimeStepBase = require('./RuntimeStepBase');


class PodLogger extends RuntimeStepBase {

    constructor(opts) {
        super(opts);
        this.containerId = opts.containerId;
        this.containerInterface = opts.containerInterface;
        this.namespace = opts.namespace;
        this.containerName = 'step';
    }

    start() {
        return Q.resolve()
            .then(() => {
                const stdoutStream = strs('utf8');
                const stderrStream = strs('utf8');

                // TODO should wait and retry if needed
                this.containerInterface.attach(this.namespace, this.containerId, this.containerName,
                    stdoutStream, stderrStream, null, this.tty);

                stdoutStream.on('data', (chunk) => {
                    const buf     =   new Buffer(chunk);
                    const message = buf.toString('utf8');
                    this.logMessage(message);
                });

                stderrStream.on('data', (chunk) => {
                    const buf     = new Buffer(chunk);
                    const message = buf.toString('utf8');
                    this.logMessage(message, true);
                });
            });
    }
}

module.exports = PodLogger;
