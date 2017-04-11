## Docker run

```
# run commands from this dir
docker run -d -p 8888:8888 --name pyspark-nb -e GRANT_SUDO=yes -e TINI_SUBREAPER=true --user root --net host --pid host -v `pwd`/nb:/home/jovyan/work/nb sotera/pyspark-mongo-jupyter:1
docker logs -f --tail 100 pyspark-nb
# paste link into ur browser
```

## TODO

* convert to docker-compose
