# cf-container-logger

# required environment variables:
    # FIREBASE_AUTH_URL - the main firebase ref to authenticate on initialization
    # FIREBASE_SECRET - the secret key to write to the firebase auth url and all future derived urls
    # LOGGER_ID - logger id. if a container will include this id in its label, we will log it
    # LISTEN_ON_EXISTING - by default, if not provided, will only listen for new containers. this will enable listening on existing containers

# Container labels
    # logging strategies
        # io.codefresh.loggerStrategy
            # logs - will get all container logs from the beginning
            # attach - will get all container logs from the point where attach was enabled. usefull for getting all interactive i/o
            
            
