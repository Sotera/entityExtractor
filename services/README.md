# Watchman Services

### Docker builds

```
# use SERVICE arg to select dir
# name your top-level script 'main.py'
docker build -t sotera/comedian:<tag> --build-arg SERVICE=comedian .

# for rorschach
# download models from s3 or create new models and place them into a /rorschach/models directory
docker build -f Dockerfile-rorschach # ... same as above

# for Python 3 modules
docker build -f Dockerfile-py3 # ... same as above

# for Polyglot-dependent services (Dr-Manhattan)
docker build -f Dockerfile-polyglot # ... same as above

# for PySpark
docker build -f Dockerfile-pyspark # ... same as above

```
