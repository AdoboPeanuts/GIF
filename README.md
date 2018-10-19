# DIP Platform

###### Documentation
![documentation-badge](https://img.shields.io/badge/Documentation-58.51%25%20%2879%2F135%29-yellow.svg)

###### Test coverage summary

Module         | % Stmts       | % Branch      | % Funcs       | % Lines
-------------- | --------------| --------------| --------------| --------------
estore_contracts.v1.0.0 | - | - | - | -
@etherisc/etherisc_flight_delay_api.v0.1.1 | 1.98% (2/101) | 0% (0/28) | 3.23% (1/31) | 2.3% (2/87)
@etherisc/etherisc_flight_delay_ui.v0.1.1 | 35% (14/40) | 0% (0/4) | 28.57% (4/14) | 38.89% (14/36)
@etherisc/dip_artifacts_storage.v1.0.0 | - | - | - | -
@etherisc/dip_contracts.v1.0.0 | - | - | - | -
@etherisc/dip_ethereum_client.v0.1.1 | - | - | - | -
@etherisc/dip_event_listener.v0.1.0 | 36.3% (49/135) | 38.89% (7/18) | 40.74% (11/27) | 37.6% (47/125)
@etherisc/dip_event_logging.v0.2.0 | 40.63% (13/32) | 75% (3/4) | 54.55% (6/11) | 40.63% (13/32)
@etherisc/dip_fiat_payment_gateway.v0.1.1 | - | - | - | -
@etherisc/dip_fiat_payout_gateway.v0.1.1 | - | - | - | -
@etherisc/dip_pdf_generator.v1.0.1 | - | - | - | -
@etherisc/dip_policy_storage.v0.1.1 | 51.28% (80/156) | 41.67% (5/12) | 41.46% (17/41) | 55.56% (80/144)
@etherisc/microservice.v0.3.2 | - | - | - | -
[endOfCoverageTable]: #



* [Contribution guidelines](CONTRIBUTION.md)
* [License](LICENSE)

## Setup environments

### A. Setup local development environment
1. Install [Docker](https://docs.docker.com/install/#supported-platforms).
2. Install [NodeJS](https://nodejs.org/en/). NodeJs version should be >=6 && <10.
3. `npm install` to install package dependencies
4. `npm run bootstrap` to install dependencies for Lerna packages
5. `npm run dev:services:run` to run Docker Compose with RabbitMQ and PostreSQL
6. `npm run migrate` to run migrations.
7. `npm run dev` to start applications.
8. `npm login` login into npm account with access to @etherisc organization private packages.
9. `npm run publish` to update NPM packages

### B. Setup local development e2e test environment
1. Install [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/). Make sure `kubectl` is the latest version.
2. Run Minikube:

    `minikube start` will start Minikube
    
    `minikube ip` will return local Minikube IP
    
    `minikube dashboard` will open Minikube dashboard for local Kubernetes cluster
    
    `minikube delete` will delete Minikube cluster

    Note that the IP is new each time you restart minikube. You can get it at any time by running `minikube ip`.
    Keep it handy for all other ports we'll potentially expose later on in the process.
3. `npm install` to install package dependencies

4. `npm run bootstrap` to install dependencies for Lerna packages

5. `NPM_TOKEN=<token> npm run deploy:minikube` to deploy to Minikube

#### Notes
- By navigating to a `<minikubeip>:31672` in your browser you can open RabbitMQ's management plugin. The default administrative credentials are `guest/guest`.

- `etherisc_flight_delay_ui` is available on `<minikubeip>:80`.

- `postgresql` is available on `<minikubeip>:30032`. Connections string `postgresql://dipadmin:dippassword@postgres:5432/dip`.

- To check whether the pods were created:

`kubectl get pods --show-labels`

`kubectl describe pod <pod name>`

`kubectl logs <pod name>`

- For the front-end services, the deployments should ideally be accompanied by services exposing node-ports outward. 
But to forward the ports so deployment port interfaces are available from your local environment, run:

`kubectl port-forward deployment/< DEPLOYMENT NAME> 8080:8080 8081:8081`

Final param is a list of space-delimetered port pairs going local:minikube.
    
    
### C. Setup local development environment for deployment to GKE clusters
1. Install and set up [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
2. Install and initialize [Google Cloud SDK](https://cloud.google.com/sdk/docs/quickstarts)
3. Create account / login to [Google Cloud Platform Console](https://console.cloud.google.com)
4. In GCP dashboard navigate to Kubernetes Engine > Clusters and create new cluster
5. Click "connect" button and run proposed command
6. `npm install` to install package dependencies
7. `npm run bootstrap` to install dependencies for Lerna packages
8. `gcloud auth configure-docker --quiet` to authorize to Google Registry
9. If you deploy first time run `npm run deploy:gke:secret <name>` to generate and deploy secrets for `minio`, `pg-connection` and `chain`
10. `GCLOUD_PROJECT_ID=<project name> GCLOUD_CLUSTER=<cluster name> GCLOUD_ZONE=<cluster zone> NPM_TOKEN=<token> npm run deploy:gke` to deploy to GKE cluster

### D. Setup deployment to GKE clusters from Bitbucket Pipelines CI

#### Setup Google Cloud
1. Create account / login to [Google Cloud Platform Console](https://console.cloud.google.com)
2. Select or create a GCP project ([manage resources page](https://console.cloud.google.com/cloud-resource-manager))
3. Make sure that billing is enabled for your project ([learn how](https://cloud.google.com/billing/docs/how-to/modify-project))
4. Enable the App Engine Admin API ([enable APIs](https://console.cloud.google.com/flows/enableapi?apiid=appengine))

#### Create Kubernetes cluster
1. In GCP dashboard navigate to Kubernetes Engine > Clusters
2. Create new cluster
3. If you deploy first time run `npm run deploy:gke:secret <name>` to generate and deploy secrets for `minio`, `pg-connection` and `chain`

#### Create authorization credentials for Bitbucket
Create an App Engine service account and API key. Bitbucket needs this information to deploy to App Engine.

1. In the Google Cloud Platform Console, go to the [Credentials](https://console.cloud.google.com/apis/credentials) page.

2. Click Create credentials > Service account key.

3. In the next page select Compute Engine default service account in the Service account dropdown.

4. Click the Create button. A copy of the JSON file downloads to your computer. (This is your JSON credential file)

#### Configure the environment variables required by the pipeline script
Open up your terminal and browse to the location of your JSON credential file from earlier. Then run the command below to encode your file in base64 format. Copy the output of the command to your clipboard.

`base64 <your-credentials-file.json>`

Go to your repository settings in Bitbucket and navigate to Pipelines > Environment variables. Create a new variable named GCLOUD_API_KEYFILE and paste the encoded service account credentials in it.

Add another variable called GCLOUD_PROJECT_ID and set the value to the key of your Google Cloud project that you created in the first step `your-project-name`.

Add GCLOUD_CLUSTER, GCLOUD_ZONE variables to specify your GKE cluster.

Use custom commands specified in bitbucket-pipelines.yml to deploy info Kubernetes cluster.
