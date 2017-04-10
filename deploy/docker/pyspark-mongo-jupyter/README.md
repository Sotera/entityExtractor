## Docker run


```
docker run -d -p 8888:8888 --name pyspark-nb -e GRANT_SUDO=yes -e TINI_SUBREAPER=true --user root --net host --pid host sotera/pyspark-mongo-jupyter:1
```

## TODO

* convert to docker-compose
