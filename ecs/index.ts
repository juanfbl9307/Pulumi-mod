import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import {KeyValuePair} from "@pulumi/awsx/ecs/container";

class ContainerConfig {
    image : string;
    containerPort : number | undefined;
    hostPort : number | undefined;
    envs: [KeyValuePair] | undefined

    constructor(config:pulumi.Config ) {
        this.image = config.require("image");
        this.hostPort = config.getNumber("hostPort");
        this.containerPort = config.getNumber("containerPort");
        this.envs = config.requireObject<[KeyValuePair]>("envs");
    }
}

const clusterConfig = new pulumi.Config("cluster")
const elasticConfig = new ContainerConfig(new pulumi.Config("elastic"))

const ecs_cluster = pulumi.output(aws.ecs.getCluster({
    clusterName: clusterConfig.require("name"),
}));
const elasticEcsTaskDefinition = new awsx.ecs.FargateTaskDefinition("elastic-ecs-task", {
    containers: {
        sampleapp: {
            image: elasticConfig.image
            ,
            portMappings: [{containerPort: elasticConfig.containerPort,
                hostPort: elasticConfig.hostPort,
                protocol: "tcp"}],
            environment: elasticConfig.envs,
        },
    },
});


const elasticEcsService = new aws.ecs.Service("elastic-ecs-service", {
    cluster: ecs_cluster.arn,
    taskDefinition: elasticEcsTaskDefinition.taskDefinition.arn,
    desiredCount: 2,
    launchType :"FARGATE",
}, {
    dependsOn: [elasticEcsTaskDefinition],
});