const Express = require('express');
const fs     = require('fs');


const ERROR_MESSAGES = {
    MISSING_PORT: 'Failed to construct server without port',
};

class Server {
    constructor(metadata) {
        console.log('Starting server component');
        this.metadata = metadata;
        this.port =  metadata.port;
        this.logger = metadata.logger;
        this.app = new Express();
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.app.listen(this.port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }).then(() => {
            this.initRoutes();
            console.log(`server is running on port ${this.port}`);
        }).catch((err) => {
            console.log(`server is NOT running due to error ${err}`);
        });
    }

    initRoutes() {
        this.app.get('/status', (req, res) => {
            res.json(this.logger.state);
        });
        this.app.get('/logs', (req, res) => {
            fs.createReadStream(this.metadata.logsPath).pipe(res);
        });
    }
}

Server.Errors = ERROR_MESSAGES;

module.exports = Server;
