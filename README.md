# cf-container-logger

# Logs streamer

This version of the container logger removes the dependency on Firebase, instead
the logs are sent to the `cf-logs-streamer` service.

## Development Env

To experiment with this code you need to run the logs-streamer service on your
laptop (`localhost:8081`)

Build a new version of the container-logger with:

```
docker build -t codefresh/cf-container-logger:on-prem -f Dockerfile.ubuntu .
```

To run a test container that will print random log messages to it's stdout which
will be picked by the container-logger use:

```
docker run -d \
  -l io.codefresh.logger.id=testcluster1 \
  -l io.codefresh.logger.firebase.logsUrl="https://codefresh-staging-75bd2.firebaseio.com/staging/build-logs/59392fdc8516ce00018c623a/steps/-Km6NtY4Eg6U2WwUaUVc/logs" \
  -l io.codefresh.logger.firebase.lastUpdateUrl="https://something" \
  -l io.codefresh.logger.strategy=attach \
  chentex/random-logger
```

To deploy the container-logger set the streamer address in the daemonset.yml
file and run:

```
kubectl apply -f daemonset.yml
```

# required environment variables:
    # LOGGER_ID - logger id. if a container will include this id in its label, we will log it
    # LOG_TO_CONSOLE - by default, logging to console is disabled and only logging to a file is enabled. set this env to log to console to
    # LISTEN_ON_EXISTING - by default, if not provided, will only listen for new containers. this will enable listening on existing containers

# Container labels
    # logging strategies
        # io.codefresh.loggerStrategy
            # logs - will get all container logs from the beginning
            # attach - will get all container logs from the point where attach was enabled. usefull for getting all interactive i/o

