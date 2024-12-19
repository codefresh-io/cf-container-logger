// @ts-expect-error it's a js library
import cfLogs from 'cf-logs';

import { DeprecatedImageDto } from './deprecated-image.dto';

const logger = cfLogs.Logger('codefresh:containerLogger');

class DeprecatedImagesCollector {

    private list: DeprecatedImageDto[] = [];

    push(deprecatedImageDto: DeprecatedImageDto) {
        this.list.push(deprecatedImageDto);
    }

    consumeAll() {
        return this.list;
    }

    destroyConsumed(consumedNumber: number) {
        this.list = this.list.slice(consumedNumber);
    }

    catchDeprecatedImage(logText: string) {
        if (logText.includes('[DEPRECATION NOTICE]')) {
            const imageName = this._parseImageName(logText);

            if (imageName === null) {
                logger.error(`detected pulling of the deprecated image but failed to parse the image name. The original log text: '${logText}'`);
            } else {
                logger.warn(`detected pulling of the deprecated image '${imageName}'. The original log text: '${logText}'`);

                this.push({
                    image: imageName,
                });
            }
        }
    }

    private _parseImageName(logText: string) {
        const startMarker = 'Suggest the author of ';
        const endMarker = ' to upgrade the image';

        const startIndex = logText.indexOf(startMarker);
        const endIndex = logText.indexOf(endMarker);

        if (startIndex > -1 && endIndex > -1 && endIndex > startIndex) {
            return logText.substring(startIndex + startMarker.length, endIndex);
        }

        return null;
    }
}

export default new DeprecatedImagesCollector();
