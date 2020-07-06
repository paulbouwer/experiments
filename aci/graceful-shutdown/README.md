
# Graceful shutdown on ACI

> NOTE: This works on a Linux workload.

Build the graceful shutdown test application

```
$ docker build -t paulbouwer/graceful-shutdown:1.0 .
```

Run the SIGTERM check on an ACI instance

```
$ export RESOURCEGROUP=graceful-shutdown
$ export LOCATION=AustraliaEast

# Create Resource Group
$ az group create --name $RESOURCEGROUP --location $LOCATION

# Create Log Analytics Workspace
$ WORKSPACE_ID=$(az monitor log-analytics workspace create -g $RESOURCEGROUP -n $RESOURCEGROUP -l $LOCATION \
        --query "customerId" -o tsv)
$ WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys -g $RESOURCEGROUP -n $RESOURCEGROUP \
        --query "primarySharedKey" -o tsv)

# Create ACI instance
$ az container create -g $RESOURCEGROUP --name aci-signal -l $LOCATION \
        --image paulbouwer/graceful-shutdown:1.0 --os-type Linux --restart-policy Never \
        --ports 8080 --ip-address Public \
        --log-analytics-workspace $WORKSPACE_ID --log-analytics-workspace-key $WORKSPACE_KEY

# Show processes
$ az container exec -g $RESOURCEGROUP -n aci-signal --exec-command ps
PID   USER     TIME  COMMAND
    1 node      0:00 npm
   16 node      0:00 node server.js
   23 node      0:00 ps

# Shutdown the app
$ az container stop -g $RESOURCEGROUP --name aci-signal

# See the capture of the SIGTERM signal by the app before shutdown
$ az monitor log-analytics query -w $WORKSPACE_ID --analytics-query "ContainerInstanceLog_CL | order by TimeGenerated desc" --query "[].{time:TimeGenerated, log:Message}"

[
  {
    "log": "SIGTERM signal received.\n",
    "time": "2020-07-06T00:51:39.501Z"
  },
  ...
]
```

