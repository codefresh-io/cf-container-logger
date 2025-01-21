import fastify from 'fastify';
import cfLogs from 'cf-logs';

import { saveServerAddress } from '../helpers';

// eslint-disable-next-line import/no-unresolved
import deprecatedImagesCollector from '../metric/deprecated-images/deprecated-images.collector';

const logger = cfLogs.Logger('codefresh:containerLogger');

export class HttpServer {

    private readonly host;
    private readonly port;
    private readonly server;

    constructor(private taskLogger?: any) {
        try {
            this.host = process.env.HOST || '0.0.0.0';
            this.port = +(process.env.PORT || 8080);
            this.server = fastify();

            this.initSecrets();
            this.initDeprecatedImages();
        } catch (error) {
            logger.error(`could not initialize server for engine's requests due to error: ${error}`);
            throw error;
        }
    }

    setTaskLogger(taskLogger: any) {
        this.taskLogger = taskLogger;
    }

    private initSecrets() {
        const secretsOptions = {
            schema: {
                body: {
                    type: 'object',
                    required: ['key', 'value'],
                    properties: {
                        key: { type: 'string' },
                        value: { type: 'string' },
                    },
                },
            },
        };

        this.server.post('/secrets', secretsOptions, async (request, reply) => {
            try {
                const { body: secret }: { body: any } = request;
                logger.info(`got request to add new mask: ${secret.key}`);
                this.taskLogger.addNewMask(secret);
                reply.code(201);
                return 'secret added';
            } catch (err) {
                logger.info(`could not create new mask for due to error: ${err}`);
                reply.code(500);
                throw err;
            }
        });
    }

    private initDeprecatedImages() {
        this.server.get('/deprecated-images', async () => {
            logger.info(`got request to retrieve deprecated images`);
            return deprecatedImagesCollector.consumeAll();
        });

        this.server.post<{ Body: { count: number } }>('/deprecated-images/ack', async (request, reply) => {
            const { count } = request.body;

            if (typeof count !== 'number' || count < 1) {
                return reply.status(400).send({ error: 'You must provide a valid count (positive integer).' });
            }

            deprecatedImagesCollector.destroyConsumed(count);

            return reply.status(200).send({ count });
        });
    }

    async start() {
        let address: string;
        try {
            address = await this.server.listen({
                host: this.host,
                port: this.port,
            });

            logger.info(`listening for engine's requests on ${address}`);
        } catch (error) {
            logger.error(`could not start server for engine updates due to error: ${error}`);
            throw error;
        }

        try {
            await saveServerAddress(address);
        } catch (error) {
            logger.error(`could not save server address due to error: ${error}`);
            throw error;
        }
    }

}
