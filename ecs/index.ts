import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const clusterName = new pulumi.Config("cluster").require("name")
const myCluster = new awsx.ecs.Cluster(clusterName);

const taskDefinition = new awsx.ecs.EC2TaskDefinition('nginx-task-def', {
    // The network mode is host because the networking of the container is tied directly to the underlying host that's running the container.
    // Note that this brings a lot of problems, but for simplicity we will make it this way. Tipically you would
    // choose bridge mode and use random hostPorts (by setting it to zero on the portMappings) and register it into some
    // target group and then in a Load Balancer.
    networkMode: 'host',
    containers: {
        nginx: {
            image: awsx.ecs.Image.fromDockerBuild('nginx-img', {
                // context is a path to a directory to use for the Docker build context, usually the directory in which the Dockerfile resides
                context: '../'
            }),
            portMappings: [
                // If we wanted random ports on the host machine we would set hostPort to zero
                { hostPort: 80, containerPort: 80 }
            ],
            // Soft Memory reservation for our container
            memoryReservation: 256,
            // Hard Memory reservation for our container. If the container reaches this amout, it is killed
            memory: 256,
            // Health Check configuration
            healthCheck: {
                command: ['CMD-SHELL', 'curl --fail http://localhost || exit 1'],
                interval: 30,
                startPeriod: 5,
                retries: 3,
                timeout: 5,
            },
        },
    },
});

// This CapacityProviderService is a wrapper that allow us to create a service using the cluster's
// capacity provider
const service = new awsx.ecs.CapacityProviderService('nginx-svc', {
    cluster:myCluster, // Our created cluster
    taskDefinition, // The task definition we have just created above
    // Here we use the capacity provider we created some steps ago
    capacityProviderStrategies: [{ capacityProvider: capacityProvider.name, base: 1, weight: 1 }],
    // This allow use to place the tasks using some strategies. In this case it will spread across instances
    orderedPlacementStrategies: [{ type: 'spread', field: 'instanceId' }],
    // Desired number of tasks for this service
    desiredCount: 1,
    // This can be use for zero-downtime deployments. But since we are using the `host` network mode
    // we cannot do it if we only have one machine because it would conflict with the port 80 of the old version (remember that ECS control plane waits for the new launched task to get healthy before start deregistering the old task).
    deploymentMinimumHealthyPercent: 0,
    // We make it 100% to avoid same task in the same machine, therefore avoiding port conflicts
    deploymentMaximumPercent: 100,
});
