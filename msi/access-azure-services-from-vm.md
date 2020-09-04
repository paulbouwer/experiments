# Access Azure services from a Virtual Machine using a Managed Identity

**Create the Azure Resources**

Configure environment variables

```
UNIQUE=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
LOCATION=AustraliaEast
RESOURCEGROUP=vm-msi
VM_NAME=vm-msi
STORAGEACCOUNT_NAME=msi$UNIQUE
BLOB_CONTAINER_NAME=demo
BLOB_NAME=demo
```

Create Resource Group

```
az group create --name $RESOURCEGROUP --location $LOCATION
```

Create Linux VM and get the Public IP

```
az vm create -n $VM_NAME -g $RESOURCEGROUP --image UbuntuLTS \
  --size Standard_D2s_v3 \
  --admin-username azureuser --generate-ssh-keys

VM_PUBLIC_IP=$(az vm show -n $VM_NAME -g $RESOURCEGROUP --show-details --query publicIps -o tsv)
```

Create Storage Account, Blob Container and upload a file

```
az storage account create -n $STORAGEACCOUNT_NAME -g $RESOURCEGROUP \
    --location $LOCATION --sku Standard_LRS

# Assign my user permission to create container and upload a blob via azure cli
STORAGEACCOUNT_RESOURCEID=$(az storage account show \
    -n $STORAGEACCOUNT_NAME -g $RESOURCEGROUP --query "id" -o tsv)

MYUSER_AAD_OBJECT_ID=$(az ad signed-in-user show --query objectId -o tsv)

az role assignment create --role "Storage Blob Data Contributor" \
    --assignee $MYUSER_AAD_OBJECT_ID --scope $STORAGEACCOUNT_RESOURCEID

az storage container create --account-name $STORAGEACCOUNT_NAME \
    --name $BLOB_CONTAINER_NAME --auth-mode login

cat <<EOF >> $BLOB_NAME
Hello world! I've been accessed via a Managed Identity.
EOF

az storage blob upload --account-name $STORAGEACCOUNT_NAME \
    --container-name $BLOB_CONTAINER_NAME --auth-mode login \
    --name $BLOB_NAME --file $BLOB_NAME
```

**Access Storage from VM via Managed Identity**

Create the Azure Identity that will be used on the VM to access the blob uploaded in a previous step. The Azure Identity in this demo will be given the Storage Blob Data Reader role scoped at the blob container level.

```
STORAGE_MSI_NAME=storage-$BLOB_CONTAINER_NAME-identity
STORAGE_MSI_PRINCIPALID=$(az identity create --name $STORAGE_MSI_NAME \
  -g $RESOURCEGROUP --query 'principalId' -o tsv)

# If you get an error with this step, the Azure Identity may not have propagated yet. Wait a few seconds, and try again.
az role assignment create --role "Storage Blob Data Reader" \
  --assignee $STORAGE_MSI_PRINCIPALID \
  --scope $STORAGEACCOUNT_RESOURCEID
```

Obtain some necessary values for use in the VM.
```
echo MSI_CLIENTID=$(az identity create --name $STORAGE_MSI_NAME -g $RESOURCEGROUP --query 'clientId' -o tsv)
echo STORAGEACCOUNT_NAME=$STORAGEACCOUNT_NAME
echo BLOB_CONTAINER_NAME=$BLOB_CONTAINER_NAME
echo BLOB_NAME=$BLOB_NAME
```

Assign the Azure Identity created to the VM.

```
az vm identity assign  -n $VM_NAME -g $RESOURCEGROUP --identities $STORAGE_MSI_NAME
```

Ssh into the vm

```
ssh azureuser@$VM_PUBLIC_IP

sudo apt install jq -y
curl -LO https://github.com/mike-engel/jwt-cli/releases/download/3.1.0/jwt-cli-3.1.0-linux.tar.gz
```

Obtain the access token for the Azure Identity we created to access the Blob storage.

```
MSI_CLIENTID=
STORAGEACCOUNT_NAME=
BLOB_CONTAINER_NAME=
BLOB_NAME=

curl -s "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/&client_id=$MSI_CLIENTID" -H Metadata:true | jq

ACCESS_TOKEN=$(curl -s "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/&client_id=$MSI_CLIENTID" -H Metadata:true| jq -r '.access_token')

jwt decode $ACCESS_TOKEN
```

Access the blob we uploaded earlier.

```
curl -s "https://$STORAGEACCOUNT_NAME.blob.core.windows.net/$BLOB_CONTAINER_NAME/$BLOB_NAME" -H "x-ms-version: 2017-11-09" -H "Authorization: Bearer $ACCESS_TOKEN"
```