FROM python:2-onbuild

RUN apt-get update && apt-get install -y \
  vim \
  less \
  nano

ENV TERM=xterm

CMD ["python", "apply_english_word2vec.py"]
