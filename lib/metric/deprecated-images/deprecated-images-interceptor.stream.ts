import { Transform, TransformCallback } from 'stream';

// eslint-disable-next-line import/no-unresolved
import deprecatedImagesCollector from './deprecated-images.collector';

export class DeprecatedImagesInterceptorStream extends Transform {
    private lastChunk: Buffer;

    constructor(private readonly noPush = false) {
        super();
        this.lastChunk = Buffer.alloc(0);
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        try {

            const text = Buffer
                .concat([this.lastChunk, chunk])
                .toString('utf8');

            const lines = text.split('\n');

            // the final element in 'lines' may be an incomplete line
            // save it in lastChunk for next time
            this.lastChunk = Buffer.from(lines.pop() ?? '', 'utf8');

            for (const line of lines) {
                deprecatedImagesCollector.catchDeprecatedImage(line.trim());
            }

            if (!this.noPush) {
                this.push(chunk);
            }

            callback();
        } catch (error) {
            callback(error as any);
        }
    }

    /**
     * _flush() is called when there is no more incoming data.
     * If we still have leftover data that didn't end with a newline,
     * treat it as a final line to be processed.
     */
    _flush(callback: TransformCallback): void {
        try {
            const finalLine = this.lastChunk.toString('utf8');
            deprecatedImagesCollector.catchDeprecatedImage(finalLine.trim());
            callback();
        } catch (error) {
            callback(error as any);
        }
    }
}
