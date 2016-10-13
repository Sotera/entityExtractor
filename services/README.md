# Watchman Services

### Docker builds

```
# use SERVICE arg to select dir
# MAIN is top-level script
docker build -t sotera/rorschach:<tag> --build-arg SERVICE=rorschach --build-arg MAIN=myscript.py .

# for Python 3 modules
docker build -f Dockerfile-py3 # ... same as above
```
