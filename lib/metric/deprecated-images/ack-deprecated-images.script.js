#!/usr/bin/env node

async function ackDeprecatedImages() {
    try {
        const count = Number(process.argv[2]);
        if (Number.isNaN(count)) {
            console.error('Usage: node ./ack-deprecated-images.script.js <count>');
            process.exit(1);
        }

        const URL = 'http://0.0.0.0:8080/deprecated-images/ack';

        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count }),
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log(JSON.stringify(data));
    } catch (error) {
        console.error('Error: ', error);
        process.exit(1);
    }
}

ackDeprecatedImages();
