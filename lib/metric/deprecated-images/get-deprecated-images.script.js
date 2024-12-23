#!/usr/bin/env node

async function getDeprecatedImages() {
    try {
        const URL = 'http://0.0.0.0:8080/deprecated-images';

        const response = await fetch(URL);
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

getDeprecatedImages();
