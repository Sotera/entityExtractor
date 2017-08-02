FROM sotera/pyspark-mongo-jupyter:5
# from https://github.com/jupyter/docker-stacks/blob/master/pyspark-notebook/Dockerfile

ENV TERM=xterm

# docker build-time args
ARG SERVICE
ARG MAIN=main.py

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# pyspark-mongo-jupyter uses anaconda for py2/3.
# maybe we should use that instead of pip install
# here, but will leave for now.
COPY $SERVICE/requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY $SERVICE .
# create consistent top-level filename
COPY $SERVICE/$MAIN main.py
# match project dir structure to satisfy imports
COPY util /usr/src/util

# entrypoint is tini
CMD ["start.sh", "/usr/local/spark/bin/spark-submit", "--packages", "org.mongodb.spark:mongo-spark-connector_2.11:2.0.0", "main.py"]
