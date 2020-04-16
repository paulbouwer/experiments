# Install AAD Pod Identity and Secrets Store Driver

## Overview

This guidance demonstrates how to install the Secrets Store CSI Driver with Azure Key Vault Provider. It leverages AAD Pod Identity to provide access to the Azure Key Vault via Managed Azure Identities. These components will be deployed into a security namespace in the AKS cluster.

**Quickstart Guide**

This demonstrates just the essential steps required to install both components.

**Detailed Guide**

This provides additional details around the installation steps. It includes validation/demo applications to test correct component installation and demonstrate correct usage.

## Prerequisites

You will require the following to use this guidance.

- AKS 1.16+
- Bash, Git
- Azure CLI 2.2.0+
- kubectl 1.16+
- Helm 3

## Quickstart Guide

Create a namespace for the AAD Pod Identity and Secrets Store CSI Driver with Azure Key Vault Provider components.

```
kubectl create ns security
```

Install AAD Pod Identity.

```
$ helm repo add aad-pod-identity https://raw.githubusercontent.com/Azure/aad-pod-identity/master/charts
$ helm install aad-pod-identity aad-pod-identity/aad-pod-identity --namespace security --version 1.5.6
```

Install the Secrets Store CSI Driver with Azure Key Vault Provider.

```
$ git clone https://github.com/kubernetes-sigs/secrets-store-csi-driver
$ cd secrets-store-csi-driver

$ helm install csi-secrets-store charts/secrets-store-csi-driver --namespace security
$ kubectl apply -f https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/deployment/provider-azure-installer.yaml --namespace security
```

Done.

## Detailed Guide

### Installing AAD Pod Identity

The following steps demonstrate how to install the AAD Pod Identity components to the **security** namespace in a Kubernetes cluster.

**Reference**

Additional details for the AAD Pod Identity component and the Helm chart used to install it can be found in the following GitHub repo.
- https://github.com/Azure/aad-pod-identity

**Additional Requirement (for AKS Clusters installed with Managed Identity)**

If you have installed your AKS cluster with the `--enable-managed-identity` flag, then you will need to perform the following additional steps before continuing.

Obtain the ClientId of the System Assigned Managed Identity in your AKS Cluster. You will also need some details about the Resource Group that contains the node resources.

```
$ AKS_NAME=<YOUR_AKS_CLUSTER_NAME>
$ AKS_RESOURCEGROUP=<YOUR_AKS_CLUSTER_RESOURCEGROUP>

$ read AKS_MSI_CLIENTID AKS_NODE_RESOURCEGROUP <<< $(az aks show \
  -n $AKS_NAME -g $AKS_RESOURCEGROUP \
  --query "{ClientId:identityProfile.kubeletidentity.clientId,ResourceGroup:nodeResourceGroup}" \
  -o tsv)
$ AKS_NODE_RESOURCEGROUPID=$(az group show -n $AKS_NODE_RESOURCEGROUP --query "id" -o tsv)
```

Assign the following roles to the System Assigned Managed Identity within the scope of the node resources Resource Group. This will authorise assignment/removal of managed identities on the VM/VMSS node resources.

```
$ az role assignment create --role "Virtual Machine Contributor" --assignee $AKS_MSI_CLIENTID --scope $AKS_NODE_RESOURCEGROUPID
$ az role assignment create --role "Managed Identity Operator" --assignee $AKS_MSI_CLIENTID --scope $AKS_NODE_RESOURCEGROUPID
```

**Create a namespace**

Create a namespace for the AAD Pod Identity components.

```
$ kubectl create ns security
```

**Install**

Install the AAD Pod Identity Helm Chart using Helm 3. You can ignore the `skipping unknown hook: "crd-install"` errors, which are as a result of this chart still also supporting Helm 2 users. Helm 3 does not use the crd hooks.

```
$ helm repo add aad-pod-identity https://raw.githubusercontent.com/Azure/aad-pod-identity/master/charts

$ helm install aad-pod-identity aad-pod-identity/aad-pod-identity --namespace security --version 1.5.6
manifest_sorter.go:192: info: skipping unknown hook: "crd-install"
manifest_sorter.go:192: info: skipping unknown hook: "crd-install"
manifest_sorter.go:192: info: skipping unknown hook: "crd-install"
manifest_sorter.go:192: info: skipping unknown hook: "crd-install"
NAME: aad-pod-identity
LAST DEPLOYED: Wed Apr 15 23:32:12 2020
NAMESPACE: security
STATUS: deployed
REVISION: 1
TEST SUITE: None
```

Check that AAD Pod Identity is installed correctly 

```
$ helm ls -n security
NAME                    NAMESPACE       REVISION        UPDATED                                 STATUS          CHART                   APP VERSION
aad-pod-identity        security        1               2020-04-15 23:32:12.9437813 +0000 UTC   deployed        aad-pod-identity-1.5.6  1.5.5

$ kubectl get crd -l 'app.kubernetes.io/name=aad-pod-identity'
NAME                                               CREATED AT
azureassignedidentities.aadpodidentity.k8s.io      2020-04-15T23:32:07Z
azureidentities.aadpodidentity.k8s.io              2020-04-15T23:32:07Z
azureidentitybindings.aadpodidentity.k8s.io        2020-04-15T23:32:07Z
azurepodidentityexceptions.aadpodidentity.k8s.io   2020-04-15T23:32:07Z

$ kubectl get all -n security
NAME                                       READY   STATUS    RESTARTS   AGE
pod/aad-pod-identity-mic-b879b8d44-24m6r   1/1     Running   0          61s
pod/aad-pod-identity-mic-b879b8d44-w65z4   1/1     Running   0          61s
pod/aad-pod-identity-nmi-qdwsj             1/1     Running   0          61s
pod/aad-pod-identity-nmi-qwgnm             1/1     Running   0          61s
pod/aad-pod-identity-nmi-sjr5v             1/1     Running   0          61s

NAME                                  DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR                 AGE
daemonset.apps/aad-pod-identity-nmi   3         3         3       3            3           beta.kubernetes.io/os=linux   62s

NAME                                   READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/aad-pod-identity-mic   2/2     2            2           62s

NAME                                             DESIRED   CURRENT   READY   AGE
replicaset.apps/aad-pod-identity-mic-b879b8d44   2         2         2       62s
```

**Uninstall**

To uninstall/delete the AAD Pod Identity deployment:

```
$ helm uninstall aad-pod-identity -n security
$ kubectl delete namespace security
$ kubectl get crd -l 'app.kubernetes.io/name=aad-pod-identity' \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' \
  | xargs -P 10 -I {} kubectl delete crd {}
```
 
### Validating AAD Pod Identity

This is an **OPTIONAL** set of instructions that can be used to validate that the AAD Pod Identity component has been correctly installed, and are NOT necessary for the installation of the Secrets Store CSI Driver and Azure Key Vault Provider.

**Reference**

Additional details for this validation demo can be found in the following GitHub repo.

- https://github.com/Azure/aad-pod-identity/tree/master/docs/tutorial

**Create a namespace**

Create a namespace for the demo components.

```
$ kubectl create ns demo-identity
```

**Create an Azure Identity**

Create the Azure Identity that will be used by the demo workload to communicate with Azure resources and assign it the role that provides the appropriate level of access to those resources. The Azure Identity in this demo will be given the Reader role scoped at the node resources Resource Group level.

```
$ AKS_NAME=<YOUR_AKS_CLUSTER_NAME>
$ AKS_NODE_RESOURCEGROUP=$(az aks list --query "[?name == '$AKS_NAME'].nodeResourceGroup" -o tsv)
$ AKS_NODE_RESOURCEGROUP_RESOURCEID=$(az group show -n $AKS_NODE_RESOURCEGROUP --query "id" -o tsv)

$ AZUREIDENTITY_PRINCIPALID=$(az identity create --name demo-identity \
  --resource-group $AKS_NODE_RESOURCEGROUP --query 'principalId' -o tsv)

# If you get an error with this step, the Azure Identity may not have propagated yet. Wait a few seconds, and try again. 
$ az role assignment create --role Reader \
  --assignee $AZUREIDENTITY_PRINCIPALID --scope $AKS_NODE_RESOURCEGROUP_RESOURCEID
```

**Additional Requirement (for AKS Clusters installed with Managed Identity)**

If you have installed your AKS cluster with the `--enable-managed-identity` flag, then you will need to perform the following additional steps before continuing.

Obtain the ClientId of the System Assigned Managed Identity in your AKS Cluster, and the ResourceId for the Azure Identity you just created.

```
$ AKS_MSI_CLIENTID=$(az aks show -n $AKS_NAME -g $AKS_RESOURCEGROUP --query "identityProfile.kubeletidentity.clientId" -o tsv)
$ AZUREIDENTITY_RESOURCEID=$(az identity show --name demo-identity --resource-group $AKS_NODE_RESOURCEGROUP --query "id" -o tsv)
```

Assign the following role to the System Assigned Managed Identity within the scope of the Azure Identity just created. This will authorise assignment/removal of this Azure Identity on the VM/VMSS node resources.

```
$ az role assignment create --role "Managed Identity Operator" --assignee $AKS_MSI_CLIENTID --scope $AZUREIDENTITY_RESOURCEID
```

**Configure and deploy workload**

Obtain the SubscriptionId and the Azure Identity ClientId.

```
$ SUBSCRIPTION_ID=$(az account show --query "id" -o tsv)
$ AZUREIDENTITY_CLIENTID=$(az identity show -n demo-identity -g $AKS_NODE_RESOURCEGROUP \
  --query "clientId" -o tsv)
```

Create a **deployment.yaml** file with the following contents. The **aadpodidbinding: demo** label on the pod template is the important bit that will glue everything together.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: demo
    aadpodidbinding: demo
  name: demo
spec:
  selector:
    matchLabels:
      app: demo
      aadpodidbinding: demo
  template:
    metadata:
      labels:
        app: demo
        aadpodidbinding: demo
    spec:
      containers:
      - name: demo
        image: "mcr.microsoft.com/k8s/aad-pod-identity/demo:1.2"
        imagePullPolicy: Always
        args:
          - "--subscriptionid={{SUBSCRIPTION_ID}}"
          - "--clientid={{AZUREIDENTITY_CLIENTID}}"
          - "--resourcegroup={{AKS_NODE_RESOURCEGROUP}}"
        env:
        - name: MY_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: MY_POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: MY_POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
      nodeSelector:
        beta.kubernetes.io/os: linux
```

Substitute the appropriate values for your environment into the **deployment.yaml** file, and deploy the workload into AKS.

```
$ cat deployment.yaml \
  | sed -e s/{{SUBSCRIPTION_ID}}/$SUBSCRIPTION_ID/ \
  | sed -e s/{{AZUREIDENTITY_CLIENTID}}/$AZUREIDENTITY_CLIENTID/ \
  | sed -e s/{{AKS_NODE_RESOURCEGROUP}}/$AKS_NODE_RESOURCEGROUP/ \
  | kubectl apply -n demo-identity -f -

$ kubectl get all -n demo-identity
NAME                        READY   STATUS    RESTARTS   AGE
pod/demo-5d7c78cbb5-mqrbw   1/1     Running   0          8s

NAME                   READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/demo   1/1     1            1           9s

NAME                              DESIRED   CURRENT   READY   AGE
replicaset.apps/demo-5d7c78cbb5   1         1         1       9s
```

**Create AzureIdentity and AzureIdentityBinding resources**

Obtain the Resource Id and Client Id from the Azure Identity.

```
$ read AZUREIDENTITY_RESOURCEID AZUREIDENTITY_CLIENTID <<< $(az identity show \
  -n demo-identity -g $AKS_NODE_RESOURCEGROUP \
  --query "{ResourceId:id,ClientId:clientId}" -o tsv)
```
 
Create the **aadpodidentity.yaml** file with the following contents. This describes the Azure Identity **demo-identity** that you will leverage with the AAD Pod Identity component.

```yaml
# aadpodidentity.yaml
apiVersion: "aadpodidentity.k8s.io/v1"
kind: AzureIdentity
metadata:
 name: demo-identity
spec:
 type: 0
 ResourceID: {{AZUREIDENTITY_RESOURCEID}}
 ClientID: {{AZUREIDENTITY_CLIENTID}}
```

Substitute appropriate values for your environment into the **aadpodidentity.yaml** file and deploy the workload into AKS.

```
$ cat aadpodidentity.yaml \
  | sed -e s#{{AZUREIDENTITY_RESOURCEID}}#$AZUREIDENTITY_RESOURCEID# \
  | sed -e s/{{AZUREIDENTITY_CLIENTID}}/$AZUREIDENTITY_CLIENTID/ \
  | kubectl apply -n demo-identity -f -
```

Create the **aadpodidentitybinding.yaml** file with the following contents.

```yaml
# aadpodidentitybinding.yaml
apiVersion: aadpodidentity.k8s.io/v1
kind: AzureIdentityBinding
metadata:
  name: demo-azure-id-binding
spec: 
  AzureIdentity: {{AZUREIDENTITY_NAME}}
  Selector: {{POD_LABEL_SELECTOR}}
```

Substitute appropriate values for your environment into the **aadpodidentitybinding.yaml** file and deploy the workload into AKS. This binds the previously defined Azure Identity **demo-identity** to all pods with the label **aadpodidbinding: demo**.

```
$ cat aadpodidentitybinding.yaml \
  | sed -e s/{{AZUREIDENTITY_NAME}}/demo-identity/ \
  | sed -e s/{{POD_LABEL_SELECTOR}}/demo/ \
  | kubectl apply -n demo-identity -f -
```

**Verify that it all worked**

The workload deployed via the **deployment.yaml** file is running.

```
$ kubectl get pods -n demo-identity
NAME                    READY   STATUS    RESTARTS   AGE
demo-5d7c78cbb5-mqrbw   1/1     Running   0          47s
```

You should see log messages from the demo pod about successfully acquiring tokens and results from queries to the Azure Metadata endpoint.

```
$ kubectl logs -n demo-identity -l aadpodidbinding=demo -l app=demo -f
```

You should see related logs in the MIC and NMI components of AAD Pod Identity.

```
$ kubectl logs -n security -l app.kubernetes.io/component=mic --prefix
$ kubectl logs -n security -l app.kubernetes.io/component=nmi --prefix
```

**Uninstall**

To uninstall/delete the validation demo run the following. This will leave the aad-pod-identity component intact:

```
$ kubectl delete ns demo-identity
$ az identity delete --name demo-identity --resource-group $AKS_NODE_RESOURCEGROUP
```

### Installing Secrets Store CSI Driver with Azure Key Vault Provider

The following steps demonstrate how to install the Secrets Store CSI Driver and the Azure Key Vault Provider components to the **security** namespace in a Kubernetes cluster.

**Reference**

Additional details for the Secrets Store CSI Driver and the Azure Key Vault Provider components can be found in the following GitHub repos.

- https://github.com/kubernetes-sigs/secrets-store-csi-driver
- https://github.com/Azure/secrets-store-csi-driver-provider-azure

**Namespace**

All the components will be installed into the same namespace as created for the AAD Pod Identity component. Check that it exists.

```
$ kubectl get ns security
NAME       STATUS   AGE
security   Active   7m37s
```

**Install**

Clone the secrets-store-csi-driver GitHub repo.

```
$ git clone https://github.com/kubernetes-sigs/secrets-store-csi-driver
$ cd secrets-store-csi-driver
```

Install the secrets-store-csi-driver Helm Chart using Helm 3.

```
$ helm install csi-secrets-store charts/secrets-store-csi-driver --namespace security
NAME: csi-secrets-store
LAST DEPLOYED: Wed Apr 15 23:40:28 2020
NAMESPACE: security
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
The Secrets Store CSI Driver is getting deployed to your cluster.

To verify that Secrets Store CSI Driver has started, run:

  kubectl --namespace=security get pods -l "app=secrets-store-csi-driver"

Now you can follow these steps https://github.com/kubernetes-sigs/secrets-store-csi-driver#use-the-secrets-store-csi-driver
to create a SecretProviderClass resource, and a deployment using the SecretProviderClass.

$ kubectl --namespace=security get pods -l "app=secrets-store-csi-driver"
NAME                                               READY   STATUS    RESTARTS   AGE
csi-secrets-store-secrets-store-csi-driver-8b9nt   3/3     Running   0          63s
csi-secrets-store-secrets-store-csi-driver-grl8v   3/3     Running   0          63s
csi-secrets-store-secrets-store-csi-driver-z7hqz   3/3     Running   0          63s
```

Get a list of objects installed.

```
$ helm get manifest -n security csi-secrets-store | egrep -A2 "^kind"
kind: ServiceAccount
metadata:
  name: secrets-store-csi-driver
--
kind: CustomResourceDefinition
metadata:
  name: secretproviderclasses.secrets-store.csi.x-k8s.io
--
kind: ClusterRole
metadata:
  name: secretproviderclasses-role
--
kind: ClusterRoleBinding
metadata:
  name: secretproviderclasses-rolebinding
--
kind: DaemonSet
apiVersion: apps/v1
metadata:
--
kind: CSIDriver
metadata:
  name: secrets-store.csi.k8s.io
```

Install the Azure Key Vault Provider for Secret Store CSI Driver.

```
$ kubectl apply -f https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/deployment/provider-azure-installer.yaml --namespace security
```

Verify that the pods are running.

```
$ kubectl get daemonset -n security
NAME                                         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR                 AGE
aad-pod-identity-nmi                         3         3         3       3            3           beta.kubernetes.io/os=linux   10m
csi-secrets-store-provider-azure             3         3         3       3            3           beta.kubernetes.io/os=linux   4s
csi-secrets-store-secrets-store-csi-driver   3         3         3       3            3           beta.kubernetes.io/os=linux   112s
 
$ kubectl get pods -n security
NAME                                               READY   STATUS    RESTARTS   AGE
aad-pod-identity-mic-b879b8d44-24m6r               1/1     Running   0          10m
aad-pod-identity-mic-b879b8d44-w65z4               1/1     Running   0          10m
aad-pod-identity-nmi-qdwsj                         1/1     Running   0          10m
aad-pod-identity-nmi-qwgnm                         1/1     Running   0          10m
aad-pod-identity-nmi-sjr5v                         1/1     Running   0          10m
csi-secrets-store-provider-azure-247c4             1/1     Running   0          18s
csi-secrets-store-provider-azure-4prb8             1/1     Running   0          18s
csi-secrets-store-provider-azure-nhtfb             1/1     Running   0          18s
csi-secrets-store-secrets-store-csi-driver-8b9nt   3/3     Running   0          2m6s
csi-secrets-store-secrets-store-csi-driver-grl8v   3/3     Running   0          2m6s
csi-secrets-store-secrets-store-csi-driver-z7hqz   3/3     Running   0          2m6s
```

**Uninstall**

To uninstall/delete the Secrets Store CSI Driver and the Azure Key Vault Provider deployment:

```
$ helm uninstall csi-secrets-store -n security
$ kubectl delete -f https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/deployment/provider-azure-installer.yaml -n security
```

### Validating Secrets Store CSI Driver with Azure Key Vault Provider

This is an **OPTIONAL** set of instructions that can be used to validate that the AAD Pod Identity, Secrets Store CSI Driver and Azure Key Vault Provider components have been correctly installed, and are NOT necessary for the installation of the Secrets Store CSI Driver and Azure Key Vault Provider.

**Create a Namespace**

 Create a namespace to hold the demo components.

```
$ kubectl create ns demo-secrets
```

**Create an Azure KeyVault and Azure Identity**

These steps will create an Azure Key Vault with some secrets, and an Azure Identity that the Secrets Store Azure Key Vault Provider will use to access the secrets in Azure Key Vault.

Set up environment variables

```
$ AKS_NAME=<YOUR_AKS_CLUSTER_NAME>
$ AKS_NODE_RESOURCEGROUP=$(az aks list --query "[?name == '$AKS_NAME'].nodeResourceGroup" -o tsv)
$ KEYVAULT_NAME=<YOUR_GLOBALLY_UNIQUE_KEYVAULT_NAME>
$ KEYVAULT_LOCATION=<YOUR_KEYVAULT_LOCATION>
```

Add an Azure Key Vault instance and then add two secrets to the Azure Key Vault instance.

```
$ az keyvault create --name $KEYVAULT_NAME --resource-group $AKS_NODE_RESOURCEGROUP \
  --location $KEYVAULT_LOCATION

$ az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "StorageAccessKey" --value "bKrvMmwwMDHpKL2XaFtQN3Az6pcjW7mE3xVVUkY2"
$ az keyvault secret set --vault-name $KEYVAULT_NAME \
  --name "ClientSecret" --value "ec422f3b-a4a3-4455-b47c-4bda476174ed"
```

Create an Azure Identity **keyvault-secrets-identity**, assign the Reader role to it in the scope of the Azure Key Vault created, and add Policy to only provide access to the Azure Key Vault secrets.

```
$ az identity create --name keyvault-secrets-identity --resource-group $AKS_NODE_RESOURCEGROUP

$ read AZUREIDENTITY_PRINCIPALID AZUREIDENTITY_CLIENTID <<< $(az identity show \
  -n keyvault-secrets-identity -g $AKS_NODE_RESOURCEGROUP \
  --query '{PrincipalId:principalId,ClientId:clientId}' -o tsv)

$ KEYVAULT_RESOURCEID=$(az keyvault show -n $KEYVAULT_NAME --query "id" -o tsv)
 
# If you get an error with this step, the Azure Identity may not have propagated yet. Wait a few seconds, and try again. 
$ az role assignment create --role Reader --assignee $AZUREIDENTITY_PRINCIPALID \
  --scope $KEYVAULT_RESOURCEID
$ az keyvault set-policy -n $KEYVAULT_NAME --secret-permissions get --spn $AZUREIDENTITY_CLIENTID
```

**Create the AAD Pod Identity AzureIdentity and AzureIdentityBinding resources**

Create the **aadpodidentity.yaml** file with the following contents. This describes the Azure Identity **keyvault-secrets-identity** that you will leverage with the AAD Pod Identity component.

```yaml
# aadpodidentity.yaml
apiVersion: aadpodidentity.k8s.io/v1
kind: AzureIdentity
metadata:
  name: keyvault-secrets-identity
spec:
  type: 0
  ResourceID: {{AZUREIDENTITY_RESOURCEID}}
  ClientID: {{AZUREIDENTITY_CLIENTID}}
```

Configure with appropriate values for your environment and apply to AKS.

```
$ read AZUREIDENTITY_RESOURCEID AZUREIDENTITY_CLIENTID <<< $(az identity show \
  -n keyvault-secrets-identity -g $AKS_NODE_RESOURCEGROUP \
  --query '{ResourceId:id,ClientId:clientId}' -o tsv)

$ cat aadpodidentity.yaml \
  | sed -e s#{{AZUREIDENTITY_RESOURCEID}}#$AZUREIDENTITY_RESOURCEID# \
  | sed -e s/{{AZUREIDENTITY_CLIENTID}}/$AZUREIDENTITY_CLIENTID/ \
  | kubectl apply -n demo-secrets -f -
```

Create the **aadpodidentitybinding.yaml** file with the following contents.

```yaml
# aadpodidentitybinding.yaml
apiVersion: aadpodidentity.k8s.io/v1
kind: AzureIdentityBinding
metadata:
  name: keyvault-secrets-identitybinding
spec:
  AzureIdentity: {{AZUREIDENTITY_NAME}}
  Selector: {{POD_LABEL_SELECTOR}}
```

Substitute appropriate values for your environment into the **aadpodidentitybinding.yaml** file and deploy the workload into AKS. This binds the previously defined Azure Identity **keyvault-secrets-identity** to all pods with the label **aadpodidbinding: keyvault-secrets**.

```
$ cat aadpodidentitybinding.yaml \
  | sed -e s/{{AZUREIDENTITY_NAME}}/keyvault-secrets-identity/ \
  | sed -e s/{{POD_LABEL_SELECTOR}}/keyvault-secrets/ \
  | kubectl apply -n demo-secrets -f -
```

**Create the Secrets Store CSI Driver SecretProviderClass resource**

Create the **secret-provider-class.yaml** file with the following contents. This specifies that the **azure provider** will be used and defines the **secrets** that will be fetched from Azure Key Vault.

```yaml
# secret-provider-class.yaml
apiVersion: secrets-store.csi.x-k8s.io/v1alpha1
kind: SecretProviderClass
metadata:
  name: app-secrets
spec:
  provider: azure
  parameters:
    usePodIdentity: "true"
    keyvaultName: {{KEYVAULT_NAME}}
    objects:  |
      array:
        - |
          objectName: StorageAccessKey
          objectType: secret
          objectVersion: ""
        - |
          objectName: ClientSecret
          objectType: secret
          objectVersion: ""
    tenantId: {{AZURE_TENANTID}}
```

Substitute appropriate values for your environment into the **secret-provider-class.yaml** file and deploy the workload into AKS.

```
$ AZURE_TENANTID=$(az account show --query 'tenantId' -o tsv)

$ cat secret-provider-class.yaml \
  | sed -e s/{{KEYVAULT_NAME}}/$KEYVAULT_NAME/ \
  | sed -e s/{{AZURE_TENANTID}}/$AZURE_TENANTID/ \
  | kubectl apply -n demo-secrets -f -
```

Confirm that the Secret Provider Class is available.

```
$ kubectl get secretproviderclass -n demo-secrets
NAME          AGE
app-secrets   6s
```

**Deploy the demo**

Create the **deployment.yaml** file with the following contents. This will use the Secrets Store CSI Driver with the Azure Provider and mount all the secrets defined in the **app-secrets** SecretProviderClass into the **/mnt/secrets-store** volume in the pod. The **aadpodidbinding: keyvault-secrets** label ensures that the Azure Identity **keyvault-secrets-identity** will be used to access the Azure Key Vault.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secrets-store-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secrets-store
  template:
    metadata:
      labels:
        app: secrets-store
        aadpodidbinding: keyvault-secrets
    spec:
      containers:
      - image: busybox
        name: demo
        args:
        - sleep
        - "86400"
        volumeMounts:
        - name: application-secrets
          mountPath: "/mnt/secrets-store"
          readOnly: true
      volumes:
      - name: application-secrets
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: app-secrets
```

Deploy the **deployment.yaml** file into AKS.

```
$ kubectl apply -f deployment.yaml -n demo-secrets
 
$ kubectl get all -n demo-secrets
NAME                                    READY   STATUS    RESTARTS   AGE
pod/secrets-store-app-b6bcc5547-qscx4   1/1     Running   0          46s

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/secrets-store-app   1/1     1            1           46s

NAME                                          DESIRED   CURRENT   READY   AGE
replicaset.apps/secrets-store-app-b6bcc5547   1         1         1       47s

$ kubectl describe pod -l app=secrets-store -n demo-secrets
Name:         secrets-store-app-b6bcc5547-qscx4
Namespace:    demo-secrets
Priority:     0
Node:         aks-linux-12334636-vmss000002/10.240.0.66
Start Time:   Wed, 15 Apr 2020 23:47:16 +0000
Labels:       aadpodidbinding=keyvault-secrets
              app=secrets-store
              pod-template-hash=b6bcc5547
Annotations:  <none>
Status:       Running
IP:           10.240.0.71
IPs:
  IP:           10.240.0.71
Controlled By:  ReplicaSet/secrets-store-app-b6bcc5547
Containers:
  demo:
    Container ID:  docker://b10e764d0f7d14df9b80096bdf98c4ff0d6283384d627bb0b45c7dd0829bc2af
    Image:         busybox
    Image ID:      docker-pullable://busybox@sha256:89b54451a47954c0422d873d438509dae87d478f1cb5d67fb130072f67ca5d25
    Port:          <none>
    Host Port:     <none>
    Args:
      sleep
      86400
    State:          Running
      Started:      Wed, 15 Apr 2020 23:48:01 +0000
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /mnt/secrets-store from application-secrets (ro)
      /var/run/secrets/kubernetes.io/serviceaccount from default-token-mvhfw (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  application-secrets:
    Type:              CSI (a Container Storage Interface (CSI) volume source)
    Driver:            secrets-store.csi.k8s.io
    FSType:
    ReadOnly:          true
    VolumeAttributes:      secretProviderClass=app-secrets
  default-token-mvhfw:
    Type:        Secret (a volume populated by a Secret)
    SecretName:  default-token-mvhfw
    Optional:    false
QoS Class:       BestEffort
Node-Selectors:  <none>
Tolerations:     node.kubernetes.io/not-ready:NoExecute for 300s
                 node.kubernetes.io/unreachable:NoExecute for 300s
Events:
  Type    Reason     Age   From                                    Message
  ----    ------     ----  ----                                    -------
  Normal  Scheduled  68s   default-scheduler                       Successfully assigned demo-secrets/secrets-store-app-b6bcc5547-qscx4 to aks-linux-12334636-vmss000002
  Normal  Pulling    25s   kubelet, aks-linux-12334636-vmss000002  Pulling image "busybox"
  Normal  Pulled     24s   kubelet, aks-linux-12334636-vmss000002  Successfully pulled image "busybox"
  Normal  Created    24s   kubelet, aks-linux-12334636-vmss000002  Created container demo
  Normal  Started    23s   kubelet, aks-linux-12334636-vmss000002  Started container demo
```

The logs for the various components of the Secrets Store CSI Driver will provide more detail on the fetching and mounting of the secrets.

```
$ kubectl logs -l app=secrets-store-csi-driver --prefix -n security --all-containers
```

The logs for the MIC and NMI components of AAD Pod Identity will provide more detail on the binding of Azure Identities to the **secrets-store-app** pod to fetch the secrets from Azure Key Vault.

```
$ kubectl logs -n security -l app.kubernetes.io/component=mic --prefix
$ kubectl logs -n security -l app.kubernetes.io/component=nmi --prefix
```

Verify that the secrets have been mounted with the values that were set in Azure Key Vault earlier.

```
$ kubectl exec -it $(kubectl get pod -l app=secrets-store -n demo-secrets \
  -o jsonpath='{ .items[0].metadata.name }') -n demo-secrets \
  -- cat /mnt/secrets-store/ClientSecret
ec422f3b-a4a3-4455-b47c-4bda476174ed
 
$ kubectl exec -it $(kubectl get pod -l app=secrets-store -n demo-secrets \
  -o jsonpath='{ .items[0].metadata.name }') -n demo-secrets \
  -- cat /mnt/secrets-store/StorageAccessKey
bKrvMmwwMDHpKL2XaFtQN3Az6pcjW7mE3xVVUkY2
```

**Uninstall**

To uninstall/delete the validation demo run the following. This will leave the Secrets Store CSI Driver and the Azure Key Vault Provider components intact in the security namespace:

```
$ kubectl delete ns demo-secrets
$ az keyvault delete --name $KEYVAULT_NAME --resource-group $AKS_NODE_RESOURCEGROUP
$ az identity delete --name keyvault-secrets-identity --resource-group $AKS_NODE_RESOURCEGROUP
```

