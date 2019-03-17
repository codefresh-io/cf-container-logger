const CFError = require('cf-errors');
const RuntimeDocker = require('./RuntimeDocker');
const RuntimeK8 = require('./RuntimeK8');

const factoryMap = {
    [RuntimeDocker.TYPE]: RuntimeDocker.factory,
    [RuntimeK8.TYPE]: RuntimeK8.factory
};

const factory = async (opts) => {
    const func = factoryMap[opts.type];
    if (!func) {
        throw new Error(`Failed to create RuntimeLogger. Type: ${opts.type} is not supported`);
    }

    try {
        const runtime = await func(opts);
        await runtime.validate();
        return runtime.start();
    } catch (err) {
        throw new CFError({
            cause: err,
            message: `Failed to create RuntimeLogger. Type: ${opts.type}`
        });
    }
};

module.exports = factory;
