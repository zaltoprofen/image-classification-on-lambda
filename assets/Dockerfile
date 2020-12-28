FROM python:3.8-slim

RUN mkdir -p /var/app

WORKDIR /var/app

COPY requirements.txt .

RUN --mount=type=cache,target=/tmp/pip-cache \
    pip install --cache-dir=/tmp/pip-cache -r requirements.txt \
        -f https://download.pytorch.org/whl/torch_stable.html

ADD https://download.pytorch.org/models/vgg16-397923af.pth models/vgg16.pth
RUN chmod 644 models/vgg16.pth

RUN --mount-type=cache,target=/tmp/pip-cache \
    pip install --cache-dir=/tmp/pip-cache awslambdaric

ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/bin/aws-lambda-rie
RUN chmod 755 /usr/bin/aws-lambda-rie

COPY entry.sh /

COPY app.py label.json ./

ENTRYPOINT ["/entry.sh"]

CMD ["app.handler"]
