FROM ubuntu:14.04

USER root

# Install git, bc and dependencies
RUN apt-get update --fix-missing && apt-get install -y \
  wget \
  bzip2 \
  ca-certificates \
  sudo \
  git \
  bc \
  vim \
  procps \
  curl \
  libglib2.0-0 \
  libxext6 \
  libsm6 \
  libxrender1 \
  libatlas-base-dev \
  libatlas-dev \
  libboost-all-dev \
  libopencv-dev \
  libprotobuf-dev \
  libgoogle-glog-dev \
  libgflags-dev \
  protobuf-compiler \
  libhdf5-dev \
  libleveldb-dev \
  liblmdb-dev \
  libsnappy-dev

RUN echo 'export PATH=/opt/conda/bin:$PATH' > /etc/profile.d/conda.sh && \
  wget --quiet --no-check-certificate https://repo.continuum.io/archive/Anaconda2-2.4.1-Linux-x86_64.sh && \
  /bin/bash Anaconda2-2.4.1-Linux-x86_64.sh -b -p /opt/conda && \
  rm Anaconda2-2.4.1-Linux-x86_64.sh

ENV PATH /opt/conda/bin:$PATH
RUN export PYTHONPATH=/home/caffe-user/caffe/python/:$PYTHONPATH
RUN conda install -c https://conda.anaconda.org/memex elasticsearch-py && \
  conda install -c https://conda.anaconda.org/anaconda protobuf

RUN useradd -ms /bin/bash caffe-user && echo "caffe-user:caffe-user" | chpasswd && adduser caffe-user sudo
RUN chown -R caffe-user:caffe-user /usr/local

# Clone Caffe repo and move into it
RUN cd /home/caffe-user && git clone https://github.com/BVLC/caffe.git && cd caffe && \
# just pull a preconfigured Makefile.config from our repo...cheating a little here
  wget --quiet https://raw.githubusercontent.com/Sotera/social-sandbox/event_detection/firmament/caffe/Makefile.config && \
# Make
  make -j"$(nproc)" all

# Make Python Wrapper
RUN cd /home/caffe-user/caffe && \
  make pycaffe && \
  make distribute

RUN cd /home/caffe-user/caffe/models/bvlc_reference_caffenet && \
wget --quiet http://dl.caffe.berkeleyvision.org/bvlc_reference_caffenet.caffemodel

WORKDIR /home/caffe-user/

RUN mkdir app
COPY *.py app/

RUN chown -R caffe-user:caffe-user /home/caffe-user

USER caffe-user

RUN export CAFFE_ROOT=/home/caffe-user/caffe/

RUN export PYTHONPATH=/home/caffe-user/caffe/python:$PYTHONPATH

ENTRYPOINT ["python", "app/caffe_redis_client.py"]
