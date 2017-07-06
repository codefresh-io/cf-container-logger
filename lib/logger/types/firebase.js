'use strict';

const Firebase = require('firebase');
const _ = require('lodash');
const CFError = require('cf-errors');
const logger = require('cf-logs').Logger('codefresh:containerLogger');

class FirebaseLogger {
    constructor(firebaseAuthUrl) {
        this.firebaseAuthUrl = firebaseAuthUrl;
        this.firebaseSecret = process.env.FIREBASE_SECRET;
        this.name = 'firebase';
        this.firebaseLogger = this._createLogger(firebaseAuthUrl);
    }

    _validator() {
        if (!this.firebaseAuthUrl) {
            return this._error(new CFError('firebase auth url is missing'));
        }
        if (!this.firebaseSecret) {
            return this._error(new CFError('firebase secret is missing'));
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
            return new Firebase(url);
        } catch (err) {
            this._error = new CFError({
                cause: err,
                message: `Failed to create a new firebase logger ref`
            });
        }
    }

    authenticateLogger() {
        return this.firebaseLogger.authWithCustomToken(this.firebaseSecret).then(() => {
            logger.info(`Authenticated to firebase url: ${this.firebaseAuthUrl}`);
            return;
        }).catch(e => {
            return Promise.reject(e);
        });
    }

    push(message) {
        this.firebaseLogger.push(message);
    }
    set(val) {
        this.firebaseLogger.set(val);
    }

    static getLogsUrl(container) {
        return _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.firebase.logsUrl'];
    }

    static getLastUpdateUrl(container) {
        return _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.firebase.lastUpdateUrl'];
    }
}

module.exports = FirebaseLogger;