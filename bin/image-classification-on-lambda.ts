#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ImageClassificationOnLambdaStack } from '../lib/image-classification-on-lambda-stack';

const app = new cdk.App();
new ImageClassificationOnLambdaStack(app, 'ImageClassificationOnLambdaStack', {
  functionName: 'vgg16-classify',
});
