FROM python:2-onbuild

RUN apt-get update && apt-get install -y \
  vim \
  less

ENV TERM=xterm

CMD ["python", "stream/stream.py", "-11.9591", "49.637", "2.8771", "57.863", "--outdir", "/downloads/tweet/files"]
