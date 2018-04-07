
CONTAINER_ID=$args[0]

echo "checking if container:$CONTAINER_ID exists"
if ( !$CONTAINER_ID ) {
    select-string -Pattern $CONTAINER_ID -Path ./lib/state.json
}
else {
    select-string -Pattern "ready" -Path ./lib/state.json
}