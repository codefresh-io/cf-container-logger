const RuntimeLogger = require('../lib');

const main = async function () {
    try {
        const runtimeLogger = await RuntimeLogger({
            type: 'k8',
            loggerId: '5c987bc3d5db460e8b29c853_1553497052840',
            taskLoggerConfig: {
                task: {
                    accountId: 'accountId',
                    jobId: '5c987bc3d5db460e8b29c853_1553497052840'
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
