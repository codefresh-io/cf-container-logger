import { DeprecatedImageDto } from './deprecated-image.dto';

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
}

export default new DeprecatedImagesCollector();
