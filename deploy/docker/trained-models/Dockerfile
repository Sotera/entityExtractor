FROM debian:jessie
RUN mkdir -p /models/neuraltalk2
# u must add neuraltalk2/models dir before building
COPY neuraltalk2/models /models/neuraltalk2
RUN chmod -R 666 /models
VOLUME /models

CMD ["/usr/bin/tail", "-f", "/dev/null"]
