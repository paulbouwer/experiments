# Create AKS Cluster with Managed Identity

## Pre-requisites

Configure environment variables

```
$ export LOCATION=AustraliaEast
$ export RESOURCEGROUP=AKS-001
$ export AKS_NAME=aks-001
$ export KUBERNETES_VERSION=1.17.3
```

Create Resource Group

```
$ az group create --name $RESOURCEGROUP --location $LOCATION
```

## Create AKS Cluster 

Create Log Analytics workspace

```
$ MONITORING_WORKSPACE_RESOURCEID=$(az resource create -g $RESOURCEGROUP \
    --resource-type=Microsoft.OperationalInsights/workspaces -n $RESOURCEGROUP \
    --api-version "2015-11-01-preview" -l $LOCATION \
    -p '{ "sku":{ "Name": "Standalone"} }' --query "id" -o tsv)
```

Create AKS cluster

```
$ az aks create --name $AKS_NAME \
     --resource-group $RESOURCEGROUP --location $LOCATION \
     --node-resource-group "$RESOURCEGROUP-Nodes" --kubernetes-version $KUBERNETES_VERSION \
     --nodepool-name linux --node-count 3 --node-vm-size "Standard_D4s_v3" \
     --load-balancer-sku standard --network-plugin azure --network-policy azure \
     --vm-set-type VirtualMachineScaleSets --ssh-key-value "~/.ssh/id_rsa.pub" \
     --enable-addons monitoring --workspace-resource-id $MONITORING_WORKSPACE_RESOURCEID \
     --enable-managed-identity 
```

https://docs.microsoft.com/en-us/azure/aks/faq#can-i-provide-my-own-name-for-the-aks-node-resource-group

## Obtain Credentials

Get Kubernetes credentials

```
$ az aks get-credentials --resource-group $RESOURCEGROUP --name $AKS_NAME
```

Check Kubernetes credentials work

```
$ kubectl get nodes 
```