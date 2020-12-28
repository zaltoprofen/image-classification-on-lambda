import base64
import binascii
import io
import json
import getpass

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

with open('label.json') as fp:
    labels = json.load(fp)


def load_model():
    global classifier

    classifier = models.vgg16()
    state_dict = torch.load('models/vgg16.pth')
    classifier.load_state_dict(state_dict)
    classifier.eval()


def classify(img, topk=5):
    if not classifier:
        load_model()

    with torch.no_grad():
        tensor = preprocess(img)
        result = torch.softmax(classifier(tensor.unsqueeze(0)), axis=1).numpy()[0]

    top_index = np.argsort(-result)[:topk]
    return [[labels[i], float(result[i])] for i in top_index]


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
