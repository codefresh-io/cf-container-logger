const { secretsServerAddress } = require('./logger');

async function updateMasks(secret) {
    try {
        const serverAddress = await secretsServerAddress;
        console.log(`server address: ${serverAddress}`);

        const { default: got } = await import('got');
        /** @type {import('got').Got} */
        const httpClient = got.extend({
            prefixUrl: serverAddress,
            responseType: 'json',
            throwHttpErrors: false,
        });
        const response = await httpClient.post(
            'secrets',
            { json: secret },
        );
    
        if (!response.ok) {
            console.error(`could not create mask for secret: ${secret.key}, because server responded with: ${response.statusCode}\n\n${JSON.stringify(response.body)}`);
            process.exit(1);
        }
        console.log(`successfully updated masks with secret: ${secret.key}`);
        process.exit(0);
    } catch (error) {
        console.log(`could not create mask for secret: ${secret.key}, due to error: ${error}`);
        process.exit(1);
    }
}

if (require.main === module) {
    // first argument is the secret key second argument is the secret value
    if (process.argv.length < 4) {
        console.log('not enough arguments, need secret key and secret value');
        process.exit(2);
    }
    const key = process.argv[2];
    const value = process.argv[3];
    updateMasks({ key, value });
} else {
    module.exports = updateMasks;
}
