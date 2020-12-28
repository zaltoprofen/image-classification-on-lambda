# Image Classification on AWS Lambda

Implementation by Lambda container images runtime

## Deployment

1. `npm install`
1. `npx cdk deploy`
    - Note down the `ImageClassificationOnLambdaStack.ClassificationApiEndpoint` value.

## Image classification

``` bash
curl https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/ \
    --data-binary @/path/to/image.jpg
```

### Limitation
- Image size: (approx.) 4.5 MiB
- Request timeout: 29 sec

## Clean up

```bash
cdk destroy
aws ecr delete-repository --repository-name=aws-cdk/assets  # optional
```