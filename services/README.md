# Watchman Services

### Docker builds

```
# use SERVICE arg to select dir
# MAIN is top-level script
# myscript.py is typically main.py
docker build -t sotera/comedian:<tag> --build-arg SERVICE=comedian --build-arg MAIN=myscript.py .

# for rorschach
# download models from s3 or create new models and place them into a /rorschach/models directory
docker build -f Dockerfile-rorschach # ... same as above

# for Python 3 modules
docker build -f Dockerfile-py3 # ... same as above

# for Dr-Manhattan
docker build -f Dockerfile-dr-manhattan -t sotera/dr-manhattan:1 --build-arg SERVICE=dr-manhattan --build-arg MAIN=create_events_main.py .

docker run --rm sotera/dr-manhattan:2 http://172.17.0.1:3000 <start_time_ms> <end_time_ms>
```
