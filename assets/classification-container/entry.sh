#!/bin/bash
PYTHON=$(which python)

if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
    exec /usr/bin/aws-lambda-rie "$PYTHON" -m awslambdaric $1
else
    exec "$PYTHON" -m awslambdaric $1
fi
