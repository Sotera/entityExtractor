FROM python:2-onbuild

RUN apt-get update && apt-get install -y \
  vim \
  less

ENV TERM=xterm

CMD ["python", "image_similarity_main.py"]
