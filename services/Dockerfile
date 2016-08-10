FROM python:2.7

# docker build-time args
ARG SERVICE
ARG MAIN=main.py

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app


COPY $SERVICE/requirements.txt .
RUN pip install --upgrade pip
# numpy required in falconn setup.py (better way to handle install deps?)
RUN pip install numpy
RUN pip install --no-cache-dir -r requirements.txt

COPY $SERVICE .
# create consistent top-level filename
COPY $SERVICE/$MAIN docker_main.py
# match project dir structure to satisfy imports
COPY util /usr/src/util

RUN apt-get update && apt-get install -y \
  vim \
  less \
  nano

ENV TERM=xterm

CMD ["python", "-u", "docker_main.py"]
