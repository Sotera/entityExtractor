FROM python:2.7

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    vim \
    less \
    nano \
    libicu-dev

COPY rorschach/requirements.txt .
RUN pip install --upgrade pip
RUN pip install numpy
RUN pip install -U git+https://github.com/aboSamoor/polyglot.git@master
RUN pip install --no-cache-dir -r requirements.txt

COPY rorschach .

# match project dir structure to satisfy imports
COPY util /usr/src/util

ENV TERM=xterm

CMD ["python", "-u", "apply_word2vec.py", "-englishModel", "Aug09_en", "-arabicModel", "Aug09_ar", "-modelPath", "./models/"]