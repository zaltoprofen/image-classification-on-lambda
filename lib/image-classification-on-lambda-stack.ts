import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as logs from '@aws-cdk/aws-logs';

interface ImageClassificationOnLambdaStackProps extends cdk.StackProps {
  functionName?: string;
}

export class ImageClassificationOnLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: ImageClassificationOnLambdaStackProps) {
    super(scope, id, props);

    const func = new lambda.DockerImageFunction(this, 'ClassificationFunction', {
      functionName: props?.functionName,
      code: lambda.DockerImageCode.fromImageAsset('assets'),
      logRetention: logs.RetentionDays.ONE_DAY,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.DISABLED,
    });

    const api = new apigw.RestApi(this, 'ClassificationApi', {
      binaryMediaTypes: ['*/*'],
      deploy: false,
    });
    api.root.addMethod('POST', new apigw.LambdaIntegration(func));
    const deployment = new apigw.Deployment(this, 'Deployment', {
      api: api,
    });
    const stage = new apigw.Stage(this, 'Stage', {
      deployment,
      stageName: 'prod',
      tracingEnabled: false,
    });

    new cdk.CfnOutput(this, 'ClassificationApiEndpoint', {
      value: stage.urlForPath()
    });
  }
}
