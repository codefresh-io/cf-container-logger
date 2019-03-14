const k8s = require('@kubernetes/client-node');
const strs = require('stringstream');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const stream = strs('utf8');

const attach = new k8s.Attach(kc);
attach.attach('default', 'example9', 'step',
    stream, process.stderr, null /* stdin */, true /* tty */);


stream.on('data', (chunk) => {
    const buf     = new Buffer(chunk);
    const message = buf.toString('utf8');
    console.log(message);
});
