# Rorschach - Vectorizes Tweets Based on text sentiment

As a part of the watchmen QCR pipeline, we take tweets in and vectorize them in a streaming fashion.  The Rorschach module is
responsible for creating text sentiment vectors for incoming messages.  It uses a gensim word2vec model trained on Twitter data, 
and weights words in a sentence using tf-idf weighting.

## Models
The models directory stores trained models for a given language.  The format will always be [month][day]_[language], and is stored as a single json file.
 
 
## Test
To test, we have built this module into a docker container which has pretrained models for English and Arabic.
The module is designed to act as a rest function which recieves messages on a redis channel.  To start, you'll need docker installed:
https://www.docker.com/, and an account on dockerhub: https://hub.docker.com/.  You'll also need redis installed so you can
use the command line interface: http://redis.io/download

To make networking a bit easier we add the 
following line to our /etc/hosts file:
192.168.99.100 redis   redis

This ip address is the default ip of the docker machine.  After that, it's just about getting and spinning up the correct
images:

```
#Get the needed images
docker pull sotera/rorschach
docker pull redis

#Start Redis, forward the machines port
docker run --name watchmen-redis -p 6379:6379 -d redis  

#Start Rorschach, link to running Redis instance
docker run --name watchmen-rorschach --link watchmen-redis:redis -d sotera/rorschach`
```

At this point, you may want to check that the images are running (docker ps, you should see the two instances).
If everything is working alright, you can then connect to your redis cli, and write some test messages:

```
$ redis-cli -h 192.168.99.100
192.168.99.100:6379> hmset 1 txt "this is message that will test our ability to make a vector" lang en state new
OK
192.168.99.100:6379> hgetall 1
1) "txt"
2) "This is a message that will test our ability to make a vector"
3) "state"
4) "new"
5) "lang"
6) "en"
7) "data"
8) "[0, 0, ...]
192.168.99.100:6379> publish genie:feature_txt 1
(integer) 1
192.168.99.100:6379> hgetall 1
1) "txt"
2) "This is a message that will test our ability to make a vector"
3) "state"
4) "processed"
5) "lang"
6) "en"
7) "data"
8) "[8.513836312797196, -38.80932086268254, ...]
```