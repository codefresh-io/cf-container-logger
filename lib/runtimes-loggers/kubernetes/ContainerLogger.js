const EventEmitter   = require('events');
const logger         = require('cf-logs').Logger('codefresh:kubernetes:containerLogger');
const { Transform }  = require('stream');
const strs           = require('stringstream');
const _              = require('lodash');

class ContainerLogger extends EventEmitter {

    constructor({
        containerId,
        stepName,
        stepLogger,
        attachInterface,
        logSizeLimit,
        isWorkflowLogSizeExceeded,
    }) {
        super();
        this.containerId               = containerId;
        this.stepName                  = stepName;
        this.stepLogger                = stepLogger;
        this.attachInterface           = attachInterface;
        this.logSizeLimit              = logSizeLimit;
        this.isWorkflowLogSizeExceeded = isWorkflowLogSizeExceeded;
        this.logSize                   = 0;
        this.finishedStreams           = 0;
    }

    async start() { 
        const stdout = strs('utf8');
        const stderr = strs('utf8');

        stdout.once('end', () => logger.debug(`stdout end event was fired for container: ${this.containerId}`))
        stderr.once('end', () => logger.debug(`stderr end event was fired for container: ${this.containerId}`))

        logger.info(`Step logger started for container: ${this.containerId} step-name: ${this.stepName}`);
        if (_.get(this.stepLogger, 'opts.logsRateLimitConfig')) {
            logger.info(`step: ${this.stepName} - found logger rate limit configuration, using streams api`);
            this._streamTty(stdout, stderr);
        } else {
            this._handleTtyStream(stdout, stderr);
        }

        return this.attachInterface(
            stdout,              // stdout
            stderr,              // stderr
            undefined,           // stdin
            true                 // tty
        );
    }

    _handleTtyStream(stdout, stderr) {
        stdout.once('end', this._handleFinished.bind(this));
        stdout.on('error', err => logger.error(`step: ${this.stepName} [stdout] error: ${err}`));
        stdout.on('data', this._logMessage.bind(this, false));

        stderr.once('end', this._handleFinished.bind(this));
        stderr.on('error', err => logger.error(`step: ${this.stepName} [stderr] error: ${err}`));
        stderr.on('data', this._logMessage.bind(this, true));
        logger.info(`Listening on stream 'data' event for container: ${this.containerId}`);
    }

    _logMessage(isError, message) {
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

    _streamTty(stdout, stderr) {
        logger.info(`Piping stdout and stderr to step streams of step: ${this.stepName}`);

        const stepLoggerWritableStream = this.stepLogger.writeStream();
        stepLoggerWritableStream.on('error', err => logger.error(`stepLoggerWritableStream: ${err}`));
        
        stdout.on('error', err => logger.error(`step: ${this.stepName} [stdout] error: ${err}`));
        stderr.on('error', err => logger.error(`step: ${this.stepName} [stderr] error: ${err}`));
        
        // Attention(!) all streams piped to step logger writable stream must be a new streams(!) in order to avoid message piping twice to writable stream.
        // { end = false } on the stepLoggerWritableStream because there is only one instance of it for all the steps.
        stdout
            .pipe(this._logSizeLimitStream())
            .pipe(this.stepLogger.createMaskingStream())
            .pipe(this.stepLogger.stepNameTransformStream().once('end', this._handleFinished.bind(this)))
            .pipe(stepLoggerWritableStream, {end: false});

        stderr
            .pipe(this._logSizeLimitStream())
            .pipe(this._errorTransformerStream())
            .pipe(this.stepLogger.createMaskingStream())
            .pipe(this.stepLogger.stepNameTransformStream().once('end', this._handleFinished.bind(this)))
            .pipe(stepLoggerWritableStream, {end: false});
    }

    _stepLogSizeExceeded() {
        return this.logSize > this.logSizeLimit;
    }

    _errorTransformerStream() {
        return new Transform({
            transform: (data, encoding, done) => {
                const message = `\x1B[31m${data.toString('utf8')}\x1B[0m`;
                done(null, Buffer.from(message));
            }
        });
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
        this.finishedStreams++;
        if (this.finishedStreams >= 2) {
            // the emission of this event reflects the ending of all streams handled by this container logger
            logger.info(`step: ${this.stepName} streams ended`);
            this.emit('end');
        }
    }
}

module.exports = ContainerLogger;
