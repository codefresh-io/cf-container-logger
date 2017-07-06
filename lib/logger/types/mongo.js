'use strict';

const mongoose = require('mongoose');
const _ = require('lodash');
const CFError = require('cf-errors');
const logger = require('cf-logs').Logger('codefresh:containerLogger');

class mongoLogger {
    constructor(mongoAuthUrl) {
        this.mongoAuthUrl = mongoAuthUrl;
        this.mongoSecret = process.env.SECRET;
        this.name = 'mongo';
        this.mongoLogger = this._createLogger(this.mongoAuthUrl);
    }

    _validator() {
        if (!this.mongoAuthUrl) {
            return this._error(new CFError('mongo auth url is missing'));
        }
    }

    /**
     * will print the error and exit the process
     * @param err
     */
    _error(err) {
        logger.error(err.toString());
        process.exit(1);
    }

    _createLogger(url) {
        try {
            return mongoose.connect(url);
        } catch (err) {
            this._error = new CFError({
                cause: err,
                message: `Failed to create a new mongo logger ref`
            });
        }
    }

    authenticateLogger() {
        return this.mongoLogger.authWithCustomToken(this.mongoSecret).then(() => {
            logger.info(`Authenticated to mongo url: ${this.mongoAuthUrl}`);
            return;
        }).catch(e => {
            return Promise.reject(e);
        });
    }

    push(message) {
        this.mongoLogger.push(message);
    }
    set(val) {
        this.mongoLogger.set(val);
    }

    static getLogsUrl(container) {
        return _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.mongo.logsUrl'];
    }

    static getLastUpdateUrl(container) {
        return _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.mongo.lastUpdateUrl'];
    }
}

module.exports = mongoLogger;