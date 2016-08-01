FROM python:2-onbuild

RUN apt-get update && apt-get install -y \
  vim \
  less

ENV TERM=xterm

CMD ["python", "extract/extract_images.py", "--outdir", "/downloads/tweet/files"]
