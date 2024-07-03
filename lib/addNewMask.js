const { getServerAddress } = require('./helpers');

async function updateMasks(secret) {
    try {
        const serverAddress = await getServerAddress();
        console.debug(`server address: ${serverAddress}`);
        const url = new URL('secrets', serverAddress);

        const { default: httpClient } = await import('got');
        const response = await httpClient.post(url, {
            json: secret,
        });
    
        if (response.statusCode !== 201) {
            console.error(`could not create mask for secret: ${secret.key}, because server responded with: ${response.statusCode}\n\n${JSON.stringify(response.body)}`);
            process.exit(1);
        }
        console.log(`successfully updated masks with secret: ${secret.key}`);
        process.exit(0);
    } catch (error) {
        console.error(`could not create mask for secret: ${secret.key}, due to error: ${error}`);
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
