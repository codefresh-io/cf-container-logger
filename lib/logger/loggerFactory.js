'use strict';

const requireDir = require('require-dir');
const _ = require('lodash');
const cfLogs = require('cf-logs');


class loggerFactory {
    constructor() {
        this.loggersMap = requireDir('./types');
    }

    getAvailableLoggers() {
        return _.keys(this.loggersMap);
    }

    getLoggerClass(loggerName) {
        const loggerClass = this.loggersMap[loggerName];
        if (_.isNil(loggerClass)) {
            cfLogs.warn(`${loggerName} does not exist`);
        }

        return this.loggersMap[loggerName];
    }
}

module.exports = loggerFactory;