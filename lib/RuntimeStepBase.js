const EventEmitter   = require('events');


class RuntimeStepBase extends EventEmitter {

    constructor({
        stepLogger,
        logSizeLimit,
        isWorkflowLogSizeExceeded, // eslint-disable-line
        loggerStrategy,
        tty = false
    }) {
        super();
        this.stepLogger = stepLogger;
        this.logSizeLimit              = logSizeLimit;
        this.logSize                   = 0;
        this.isWorkflowLogSizeExceeded = isWorkflowLogSizeExceeded;
        this.stepFinished              = false;
        this.loggerStrategy            = loggerStrategy;
        this.tty                       = tty;
    }

    _stepLogSizeExceeded() {
        return this.logSize > this.logSizeLimit;
    }

    logMessage(message, isError) {
        if (this.logSizeLimit && (this._stepLogSizeExceeded() || this.isWorkflowLogSizeExceeded()) && !isError) {
            if (!this.logExceededLimitsNotified) {
                this.logExceededLimitsNotified = true;
                message = `\x1B[01;93mLog size exceeded for ${this._stepLogSizeExceeded() ? 'this step' : 'the workflow'}.\nThe step will continue to execute until it finished but new logs will not be stored.\x1B[0m\r\n`;
            } else {
                return;
            }
        }

        if (isError) {
            message = `\x1B[31m${message}\x1B[0m`;
        }

        this.stepLogger.write(message);

        if (this.logSizeLimit) {
            this.logSize += Buffer.byteLength(message);
            this.stepLogger.setLogSize(this.logSize);
        }
        this.emit('message.logged');
    }
}

module.exports = RuntimeStepBase;
