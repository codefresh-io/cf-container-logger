const retry = (fn, ms = 1000, maxRetries = 50) => new Promise((resolve, reject) => {
    let retries = 0;
    fn()
        .then(resolve)
        .catch(() => {
            // eslint-disable-next-line consistent-return
            setTimeout(() => {
                console.log('retrying failed promise...');
                // eslint-disable-next-line no-plusplus
                ++retries;
                if (retries === maxRetries) {
                    // eslint-disable-next-line prefer-promise-reject-errors
                    return reject('maximum retries exceeded');
                }
                // eslint-disable-next-line promise/catch-or-return
                retry(fn, ms).then(resolve);
            }, ms);
        });
});

module.exports = {
    retry
};
