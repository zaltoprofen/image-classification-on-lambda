import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as es from '@aws-cdk/aws-lambda-event-sources';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { LambdaIntegration } from '@aws-cdk/aws-apigateway';

interface ImageClassificationOnLambdaStackProps extends cdk.StackProps {
  functionName?: string;
  provisionedConcurrency?: number;
  xRayTracingEnabled?: boolean;
}

export class ImageClassificationOnLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: ImageClassificationOnLambdaStackProps) {
    super(scope, id, props);

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

    const api = new apigw.RestApi(this, 'ClassificationApi', {
      binaryMediaTypes: ['*/*'],
      deploy: false,
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

    const tasks = api.root.addResource('tasks');
    const tasksCode = lambda.Code.fromAsset('assets/tasks');
    const bucket = new s3.Bucket(this, 'ImageBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{expiration: cdk.Duration.days(30)}]
    });
    const taskQueue = new sqs.Queue(this, 'TaskQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
    });
    const table = new dynamodb.Table(this, 'TaskTable', {
      partitionKey: {name: 'taskId', type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const createTask = new lambda.Function(this, 'CreateTask', {
      code: tasksCode,
      handler: 'handlers.create',
      runtime: lambda.Runtime.PYTHON_3_8,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        'BUCKET_NAME': bucket.bucketName,
        'QUEUE_URL': taskQueue.queueUrl,
        'TABLE_NAME': table.tableName,
      },
    });
    bucket.grantWrite(createTask);
    taskQueue.grantSendMessages(createTask);
    table.grantReadWriteData(createTask);
    tasks.addMethod('POST', new apigw.LambdaIntegration(createTask));

    const taskWorker = new lambda.DockerImageFunction(this, 'TaskWorker', {
      code: lambda.DockerImageCode.fromImageAsset('assets/classification-container', {
        entrypoint: ['/entry.sh'],  // workaround: https://github.com/aws/aws-cdk/issues/11984
        cmd: ['app.classification_task'],
      }),
      memorySize: 2048,
      logRetention: logs.RetentionDays.ONE_DAY,
      timeout: cdk.Duration.minutes(1),
      environment: {
        'TABLE_NAME': table.tableName,
      },
      events: [
        new es.SqsEventSource(taskQueue, {
          batchSize: 1,
        }),
      ],
    });
    table.grantReadWriteData(taskWorker);
    bucket.grantRead(taskWorker);

    const showTask = new lambda.Function(this, 'ShowTask', {
      code: tasksCode,
      handler: 'handlers.show',
      runtime: lambda.Runtime.PYTHON_3_8,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        'TABLE_NAME': table.tableName,
      },
    });
    table.grantReadData(showTask);
    tasks.addResource('{taskId}').addMethod('GET', new LambdaIntegration(showTask));

    new cdk.CfnOutput(this, 'ClassificationApiEndpoint', {
      value: stage.urlForPath()
    });
  }
}
