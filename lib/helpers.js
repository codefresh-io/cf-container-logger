const retry = (fn, ms=1000,maxRetries=50) => new Promise((resolve,reject) => { 
    var retries=0;
    fn()
    .then(resolve)
    .catch(() => {
        setTimeout(() => {
            console.log('retrying failed promise...');
            ++retries;
            if(retries==maxRetries) {
                return reject('maximum retries exceeded');
            }
            retry(fn, ms).then(resolve);
        }, ms);
    })
});

module.exports = {
    retry
}