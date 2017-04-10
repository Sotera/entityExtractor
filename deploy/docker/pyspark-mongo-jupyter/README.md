## Docker run

```
docker run -d -p 8888:8888 --name pyspark-nb -e GRANT_SUDO=yes -e TINI_SUBREAPER=true --user root --net host --pid host sotera/pyspark-mongo-jupyter:1
docker logs -f --tail 100 pyspark-nb
# paste link into ur browser
```

## TODO

* convert to docker-compose
