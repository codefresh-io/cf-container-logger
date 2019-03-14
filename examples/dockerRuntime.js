const RuntimeLogger = require('../lib');

const main = async function () {
    try {
        const runtimeLogger = await RuntimeLogger({
            type: 'docker',
            loggerId: 'jobId-itai',
            taskLoggerConfig: {
                task: {
                    accountId: 'accountId',
                    jobId: 'jobId-itai'
                },
                opts: {
                    type: 'firebase',
                    baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
                    firebaseSecret: process.env.FIREBASE_SECRET
                }
            },
            findExistingContainers: 'true',
            logSizeLimit: 1 * 1000000
        });
    } catch (err) {
        console.error(err.stack);
    }

};

main();
