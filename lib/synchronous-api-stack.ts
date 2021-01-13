import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as logs from '@aws-cdk/aws-logs';

interface ImageClassificationOnLambdaStackProps extends cdk.StackProps {
  functionName?: string;
  provisionedConcurrency?: number;
  xRayTracingEnabled?: boolean;
}

export class SynchronousApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: ImageClassificationOnLambdaStackProps) {
    super(scope, id, props);

    const api = new apigw.RestApi(this, 'SynchronousApi', {
      binaryMediaTypes: ['*/*'],
      deploy: false,
    });

    const func = new lambda.DockerImageFunction(this, 'ClassificationFunction', {
      functionName: props?.functionName,
      code: lambda.DockerImageCode.fromImageAsset('assets/classification-container'),
      logRetention: logs.RetentionDays.ONE_DAY,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.DISABLED,
      currentVersionOptions: {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }
    });

    const live = func.currentVersion.addAlias('live', {
      provisionedConcurrentExecutions: props?.provisionedConcurrency,
    });
    api.root.addMethod('POST', new apigw.LambdaIntegration(live));

    const deployment = new apigw.Deployment(this, 'Deployment', {
      api: api,
    });
    const stage = new apigw.Stage(this, 'Stage', {
      deployment,
      stageName: 'prod',
      tracingEnabled: props?.xRayTracingEnabled,
    });

    new cdk.CfnOutput(this, 'ClassificationApiEndpoint', {
      value: stage.urlForPath()
    });
  }
}
