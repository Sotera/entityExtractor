# Watchman Services

### Docker builds

```
# use SERVICE arg to select dir
# MAIN is top-level script
docker build -t sotera/rorschach:<tag> --build-arg SERVICE=rorschach --build-arg MAIN=myscript.py .

# for Python 3 modules
docker build -f Dockerfile-py3 # ... same as above

# for Node modules
docker build -f Dockerfile-node6 # ... same as above

# for Dr-Manhattan
docker build -f Dockerfile-dr-manhattan -t sotera/dr-manhattan:1 --build-arg SERVICE=dr-manhattan --build-arg MAIN=create_events_main.py .

docker run --rm sotera/dr-manhattan:2 http://172.17.0.1:3000 <start_time_ms> <end_time_ms>
```
