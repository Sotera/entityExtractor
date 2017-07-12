import pyspark.sql.functions as F
from os import getenv
import sys, os, json
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from mongo_spark_client import Client as SparkClient
from tokenizer import pres_tokenize
import courier
import fasttext

class Model(object):
    def __init__(self):
        self.spark = SparkClient(uri='mongodb://mongo:27017',
            master='localhost[*]', collection='socialMediaPost')

    # TODO: use start, end times
    def train(self, start_time=1, end_time=1):
        df = self.collect_hashtag_posts(start_time, end_time)

        df_hash = df.rdd

        df_hash.map(lambda x: (len(x.hashtags), 1))\
        .reduceByKey(lambda x, y: x+y)\
        .sortBy(lambda x: x[0]).collect()

        df_single_hash = df.rdd.filter(lambda x: len(x.hashtags)==1)
        df_single_hash = df_single_hash.filter(lambda x: not_a_retweet(x))

        hashtags = df_single_hash.map(lambda x: (x.hashtags[0], 1)).reduceByKey(lambda x, y: x+y).sortBy(lambda x: x[1]).collect()

        labels = list(map(lambda x: x[0], hashtags[-50:]))
        bc_labels = self.spark.sparkContext.broadcast(labels)
        self.labels = labels

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

    def predict(self, start_time=1, end_time=1, kafka_url='print', kafka_topic='print'):
        # use same query as trainer
        df = self.collect_hashtag_posts(start_time, end_time)

        df_posts = df\
        .withColumn('fasttext_in', u_tokenize_all(F.col('text')))

        def ft_model(text):
            try:
                pred = self.classifier.predict_proba([text])[0][0]
                topics = dict(
                        topic=list(self.labels)[int(pred[0])-1],
                        weight=pred[1]
                    )
                return json.dumps(topics)
            except:
                return ''

        # fasttext clf doesn't play nicely with spark so collect erthing
        # and apply in pandas.
        df_ft = df_posts.toPandas()
        df_ft['ft_topics'] = df_ft['fasttext_in'].apply(ft_model)

        df_campaign = self.spark.spark.createDataFrame(df_ft)

        df_campaign2 = df_campaign.select([F.explode('campaigns').alias('each_camp'), '*'])

        df_campaign3 = df_campaign2\
        .groupby('each_camp')\
        .agg(
            F.collect_list('ft_topics').alias('all_topics')
        )

        df_campaign4=df_campaign3\
        .withColumn('sorted_topics', u_sort_topics(F.col('all_topics')))\
        .withColumn('start_time', F.lit(start_time))\
        .withColumn('end_time', F.lit(end_time))

        df_campaign4 = df_campaign4.drop('all_topics')

        df_campaign4.show()

        # TODO: output format
        topics = df_campaign4.toPandas().to_dict()
        courier.deliver(topics, kafka_url, kafka_topic)

        self.save(df_campaign4)

        self.spark.stop()

    def save(self, df):
        self.spark.collection = 'topic'
        self.spark.write(df)

    def collect_hashtag_posts(self, start_time=1, end_time=1):
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

        # use 1 retweet as stand-in for original tweet
        df_retweets = df_retweets.dropDuplicates(['broadcast_post_id'])

        return df_retweets.union(df_no_retweets)


def not_a_retweet(tweet):
    try:
        return not (tweet.broadcast_post_id and tweet.broadcast_post_id != 'null')
    except:
        return False

def tokenize_all(txt):
    return ' '.join(pres_tokenize(txt, 'en'))

u_tokenize_all = F.udf(tokenize_all)

def load(s):
    try:
        return json.loads(s)
    except:
        return {'weight':0, 'topic': 'BOGUS'}

def sort_topics(arr):
    arr = map(lambda s: load(s), arr)

    agg = dict()
    # {a: [10, 20], b: [10]}

    for item in arr:
        topic = item['topic']
        if topic in agg:
            agg[topic].append(item['weight'])
        else:
            agg[topic] = [item['weight']]

    avgs = {}
    for topic, weights in agg.items():
        avgs[topic] = sum(weights)/len(weights)

    sort_by_avg = sorted(avgs.items(), key=lambda item: item[1], reverse=1)
    return json.dumps(sort_by_avg)


u_sort_topics = F.udf(sort_topics)
