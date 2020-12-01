const EventEmitter   = require('events');
const logger         = require('cf-logs').Logger('codefresh:kubernetes:containerLogger');
const { Transform } = require('stream');
const _ = require('lodash');

class ContainerLogger extends EventEmitter {

    constructor({
        containerId,
        stepName,
        stream,
        stepLogger,
        logSizeLimit,
        isWorkflowLogSizeExceeded,
    }) {
        super();
        this.containerId               = containerId;
        this.stepName                  = stepName;
        this.stream                    = stream;
        this.stepLogger                = stepLogger;
        this.logSizeLimit              = logSizeLimit;
        this.isWorkflowLogSizeExceeded = isWorkflowLogSizeExceeded;
        this.logSize                   = 0;
        this.stepFinished              = false;
    }

    async start() { 
        logger.info(`Step logger started for container: ${this.containerId} step-name: ${this.stepName}`);
        if (_.get(this.stepLogger, 'opts.logsRateLimitConfig')) {
            logger.info(`step: ${this.stepName} - found logger rate limit configuration, using streams api`);
            return this._streamTty();
        }
        return this._handleTtyStream();
    }

    _handleTtyStream() {
        this.stream.on('end', this._handleFinished.bind(this));
        this.stream.on('error', err => logger.error(`step: ${this.stepName}, error: ${err}`));
        this.stream.on('data', (chunk) => {
            const buf     = Buffer.from(chunk);
            const message = buf.toString('utf8');
            this._logMessage(message);
        });
        logger.info(`Listening on stream 'data' event for container: ${this.containerId}`);
    }

    _logMessage(message) {
        if (this.logSizeLimit && (this._stepLogSizeExceeded() || this.isWorkflowLogSizeExceeded()) && !isError) {
            if (!this.logExceededLimitsNotified) {
                this.logExceededLimitsNotified = true;
                message = `\x1B[01;93mLog size exceeded for ${this._stepLogSizeExceeded() ? 'this step' : 'the workflow'}.\nThe step will continue to execute until it finished but new logs will not be stored.\x1B[0m\r\n`;
            } else {
                return;
            }
        }

        this.stepLogger.write(message);

        if (this.logSizeLimit) {
            this.logSize += Buffer.byteLength(message);
            this.stepLogger.setLogSize(this.logSize);
        }
        this.emit('message.logged');
    }

    _streamTty() {
        logger.info(`Piping stdout and stderr step streams of step: ${this.stepName}`);

        const stepLoggerWritableStream = this.stepLogger.writeStream();
        stepLoggerWritableStream.on('error', err => logger.error(`stepLoggerWritableStream: ${err}`));
        
        this.stream.on('error', err => logger.error(`step: ${this.stepName}, error: ${err}`));
        
        // Attention(!) all streams piped to step logger writable stream must be a new streams(!) in order to avoid message piping twice to writable stream.
        // { end = false } on the stepLoggerWritableStream because there is only one instance of it for all the steps.
        this.stream
            .pipe(this._logSizeLimitStream())
            .pipe(this.stepLogger.createMaskingStream())
            .pipe(this.stepLogger.stepNameTransformStream().once('end', this._handleFinished.bind(this)))
            .pipe(stepLoggerWritableStream, {end: false});
    }

    _stepLogSizeExceeded() {
        return this.logSize > this.logSizeLimit;
    }

    _logSizeLimitStream() {
        return new Transform({
            transform: (data, encoding, done) => {
                if (this.logSizeLimit && (this._stepLogSizeExceeded() || this.isWorkflowLogSizeExceeded())) {
                    if (!this.logExceededLimitsNotified) {
                        this.logExceededLimitsNotified = true;
                        const message = `\x1B[01;93mLog size exceeded for ${this._stepLogSizeExceeded() ? 'this step' : 'the workflow'}.\nThe step will continue to execute until it finished but new logs will not be stored.\x1B[0m\r\n`;
                        done(null, Buffer.from(message));
                        return;
                    }

                    done(null, Buffer.alloc(0));  // discard chunk
                    return;
                }

                if (this.logSizeLimit) {
                    this.logSize += Buffer.byteLength(data);
                    this.stepLogger.setLogSize(this.logSize);
                }

                this.emit('message.logged');
                done(null, data);
            }
        });
    }

    _handleFinished() {
        // the emission of this event reflects the ending of all streams handled by this container logger
        logger.info(`step: ${this.stepName} - end event emitted`);
        this.emit('end');
    }
}

module.exports = ContainerLogger;
