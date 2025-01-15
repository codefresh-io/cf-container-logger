import cfLogs from 'cf-logs';

// eslint-disable-next-line import/no-unresolved
import { DeprecatedImageDto } from './deprecated-image.dto';

const logger = cfLogs.Logger('codefresh:containerLogger');

// eslint-disable-next-line no-control-regex
const DEPRECATED_IMAGE_REGEX = /^(?:\u001b\[31m\u001b\[1m)?\[DEPRECATION NOTICE].+?Suggest the author of (?<image>.+?) to/;

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
        const imageName = this._parseImageName(logText);

        if (imageName !== null) {
            logger.warn(`detected pulling of the deprecated image '${imageName}'. The original log text: '${logText}'`);

            this.push({
                image: imageName,
            });
        }
    }

    private _parseImageName(logText: string) {
        const match = logText.match(DEPRECATED_IMAGE_REGEX);
        return match?.groups?.image ?? null;
    }
}

export default new DeprecatedImagesCollector();
