#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SynchronousApiStack } from '../lib/synchronous-api-stack';
import { AsynchronousApiStack } from '../lib/asynchronous-api-stack';

const app = new cdk.App();
new SynchronousApiStack(app, 'SynchronousApiStack');
new AsynchronousApiStack(app, 'AsynchronousApiStack');