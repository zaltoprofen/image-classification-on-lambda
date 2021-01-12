import base64
import binascii
import decimal
import getpass
import io
import json
import os
from urllib.parse import urlparse

import boto3
import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from torchvision import models

preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.ToTensor(),
    transforms.Normalize(mean=[.485, .456, .406],
                         std=[.229, .224, .225])
])

classifier = None
_table = None
_s3 = None

with open('label.json') as fp:
    labels = json.load(fp)


def load_model():
    global classifier

    classifier = models.vgg16()
    state_dict = torch.load('models/vgg16.pth')
    classifier.load_state_dict(state_dict)
    classifier.eval()


def get_table():
    global _table
    if not _table:
        _table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])
    return _table


def get_s3_client():
    global _s3
    if not _s3:
        _s3 = boto3.client('s3')
    return _s3


def classify(img, topk=5):
    if not classifier:
        load_model()

    with torch.no_grad():
        tensor = preprocess(img)
        result = torch.softmax(classifier(tensor.unsqueeze(0)), axis=1).numpy()[0]

    top_index = np.argsort(-result)[:topk]
    return [{'label': labels[i], 'confidence': float(result[i])} for i in top_index]


def handler(event, context):
    try:
        img_fp = io.BytesIO(base64.b64decode(event['body']))
    except binascii.Error:
        return {
            'statusCode': 400,
            'body': json.dumps({'message': 'cannot decode body'}),
        }
    try:
        img = Image.open(img_fp).convert('RGB')
    except:
        return {
            'statusCode': 400,
            'body': json.dumps({'message': 'cannot decode image'})
        }
    result = classify(img)
    return {
        'statusCode': 200,
        'body': json.dumps(result),
    }


def report_error(task_id, message=None):
    table = get_table()
    update = {
        'status': {'Value': 'ERROR'},
    }
    if message:
        update['message'] = {'Value': message}
    table.update_item(
        Key={'taskId': task_id},
        AttributeUpdates=update,
    )


def update_task(task_id, status, result=None):
    table = get_table()
    update = {
        'status': {'Value': status},
    }
    if result:
        update['result'] = {'Value': result}
    table.update_item(
        Key={'taskId': task_id},
        AttributeUpdates=update,
    )


def classification_task(event, context):
    s3 = get_s3_client()
    for record in event['Records']:
        message = json.loads(record['body'])
        task_id = message['taskId']
        update_task(task_id, 'DOING')
        s3_uri = message['s3Uri']
        o = urlparse(s3_uri)
        bucket_name, key = o.netloc, o.path.lstrip('/')
        with io.BytesIO() as buf:
            s3.download_fileobj(bucket_name, key, buf)
            buf.seek(0)
            try:
                img = Image.open(buf).convert('RGB')
            except:
                report_error(task_id, 'invalid file format')
                return
        result = classify(img)
        result = [{
            'label': r['label'],
            'confidence': decimal.Decimal(r['confidence']),
        } for r in result]
        update_task(task_id, 'DONE', result)
