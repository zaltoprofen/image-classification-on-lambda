import base64
import decimal
import io
import json
import os
import uuid

import boto3

_bucket = None
_table = None
_queue = None


def get_bucket():
    global _bucket
    if not _bucket:
        bucket_name = os.environ['BUCKET_NAME']
        _bucket = boto3.resource('s3').Bucket(bucket_name)
    return _bucket


def get_table():
    global _table
    if not _table:
        table_name = os.environ['TABLE_NAME']
        _table = boto3.resource('dynamodb').Table(table_name)
    return _table


def get_queue():
    global _queue
    if not _queue:
        queue_url = os.environ['QUEUE_URL']
        _queue = boto3.resource('sqs').Queue(queue_url)
    return _queue


def json_default(o):
    if isinstance(o, decimal.Decimal):
        return float(o)
    raise TypeError()


def create(event, context):
    bucket = get_bucket()
    queue = get_queue()
    table = get_table()

    buffer = io.BytesIO(base64.b64decode(event['body']))
    task_id = str(uuid.uuid4())
    resource = {
        'taskId': task_id,
        'status': 'PENDING',
    }
    table.put_item(Item=resource)
    bucket.upload_fileobj(buffer, task_id)
    queue.send_message(
        MessageBody=json.dumps({
            'taskId': task_id,
            's3Uri': f's3://{bucket.name}/{task_id}'
        })
    )
    return {
        'statusCode': 201,
        'headers': {
            'Location': task_id,
            'Content-Type': 'application/json',
        },
        'body': json.dumps(resource),
    }


def show(event, context):
    task_id = event['pathParameters']['taskId']
    table = get_table()
    item = table.get_item(Key={'taskId': task_id}).get('Item')
    if not item:
        return {
            'statusCode': 404,
            'headers': {
                'Content-Type': 'application/json',
            },
            'body': json.dumps({'message': f'taskId={task_id} is not exists'})
        }
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
        },
        'body': json.dumps(item, default=json_default),
    }
