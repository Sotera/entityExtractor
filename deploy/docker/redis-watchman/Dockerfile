FROM redis:3.0
# add ur own redis.conf to current dir (not committed for security)
COPY redis.conf /usr/local/etc/redis/redis.conf
CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]
