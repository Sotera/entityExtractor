import pyspark.sql.functions as F
from os import getenv
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from mongo_spark_client import Client as SparkClient
from tokenizer import pres_tokenize
import fasttext

class Trainer(object):
    def __init__(self):
        self.spark = SparkClient(uri='mongodb://mongo:27017',
            master='localhost[*]')

        self.classifier = None

    def train(self, start_time=1, end_time=1):
        self.spark.collection = 'socialMediaPost'

        # TODO: use start, end times
        df = self.spark.read()\
        .select(['_id', 'text', 'featurizer', 'broadcast_post_id', 'campaigns',
            'hashtags', 'lang', 'post_id', 'timestamp_ms'])\
        .where('lang = "en"')

        df_retweets = df\
        .where('featurizer == "hashtag"')\
        .where('broadcast_post_id is not null')

        df_no_retweets = df\
        .where('featurizer == "hashtag"')\
        .where('broadcast_post_id == "null" or broadcast_post_id is null')

        df_retweets = df_retweets.dropDuplicates(['broadcast_post_id'])

        df_hash = df_retweets.union(df_no_retweets)

        df_hash = df_hash.rdd

        df_hash.map(lambda x: (len(x.hashtags), 1))\
        .reduceByKey(lambda x, y: x+y)\
        .sortBy(lambda x: x[0]).collect()

        df_single_hash = df.rdd.filter(lambda x: len(x.hashtags)==1)
        df_single_hash = df_single_hash.filter(lambda x: not_a_retweet(x))

        hashtags = df_single_hash.map(lambda x: (x.hashtags[0], 1)).reduceByKey(lambda x, y: x+y).sortBy(lambda x: x[1]).collect()

        labels = list(map(lambda x: x[0], hashtags[-50:]))
        bc_labels = self.spark.sparkContext.broadcast(labels)


        all_hash = df_single_hash\
        .filter(lambda x: x.hashtags[0] in bc_labels.value)\
        .map(lambda x: {'label':x.hashtags[0], 'text':x.text})

        tweets = all_hash.collect()

        d_labels = {}
        ind = 1
        for k in list(labels):
            d_labels[k] = ind
            ind += 1


        fo = open('tweet_data_train.txt', 'w')
        fo2 = open('tweet_data_test.txt', 'w')
        i = 0
        for tweet in tweets:
            i+=1
            if i%10==0:
                fo2.write("__label__{} , {}\n"\
                .format(
                    d_labels[tweet["label"]], " ".join(
                    pres_tokenize(tweet["text"], 'en')))
                )
            else:
                fo.write("__label__{} , {}\n"\
                .format(
                    d_labels[tweet["label"]], " ".join(
                    pres_tokenize(tweet["text"], 'en')))
                )

        fo.close()
        fo2.close()

        self.classifier = fasttext.supervised('tweet_data_train.txt', 'model')
        return self.classifier

def not_a_retweet(tweet):
    try:
        return not (tweet.broadcast_post_id and tweet.broadcast_post_id != 'null')
    except:
        return False
