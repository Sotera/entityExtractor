import pyspark.sql.functions as F
from pyspark.sql.types import *
import sys, os, json
from datetime import datetime
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from mongo_spark_client import Client as SparkClient
from tokenizer import pres_tokenize
import courier
import fasttext

class Model(object):
    def __init__(self):
        db_host = os.getenv('DB_HOST', 'mongo')
        db_port = os.getenv('DB_PORT', 27017)
        uri = 'mongodb://{}:{}'.format(db_host, db_port)
        print('db conf', uri)
        self.spark = SparkClient(uri=uri, master='localhost[*]',
            collection='socialMediaPost')

    # TODO: use start, end times
    def train(self, start_time=1, end_time=1):
        df = self.query_labelled_posts(start_time, end_time)

        df_hash = df.rdd

        hashtags = df_hash\
        .flatMap(lambda x: x.hashtags)\
        .map(lambda x: (x.lower(), 1))\
        .reduceByKey(lambda x, y: x+y)\
        .sortBy(lambda x: x[1]).collect()

        # chop the long tail
        hashtags = list(filter(lambda x: x[1] > 2, sorted(hashtags, key=lambda x: x[1], reverse=1)))

        # get top x%
        top_hashtags = hashtags[: int(len(hashtags) * .02)]
        keep = [x for x in top_hashtags if x[0]
            not in ['breaking', 'news', 'breakingnews', 'foxnews']]
        labels = list(map(lambda x: x[0], keep))
        self.labels = labels
        bc_labels = self.spark.sparkContext.broadcast(labels)

        all_hash = df_hash\
        .filter(lambda x: len(set(map(lambda x: x.lower(), x.hashtags)) & set(bc_labels.value)))\
        .map(lambda x: (list(set(map(lambda x: x.lower(), x.hashtags)) & set(bc_labels.value)), x.text))

        tweets = all_hash.collect()

        fo = open('tweet_data_train.txt', 'w')
        fo2 = open('tweet_data_test.txt', 'w')
        i = 0
        for tweet in tweets:
            tokens = pres_tokenize(tweet[1], 'en', 1)
        #     print(tokens)
            i+=1
            if i%5==0:
                for htag in tweet[0]:
                    _=fo2.write("__label__{} ".format(htag))
                _=fo2.write("{}\n".format(" ".join(tokens)))
            else:
                for htag in tweet[0]:
                    _=fo.write("__label__{} ".format(htag))
                _=fo.write("{}\n".format(" ".join(tokens)))

        # __label__trump __label__maga __label__politics thetwet .. text
        fo.close()
        fo2.close()

        self.classifier = fasttext.supervised('tweet_data_train.txt', 'model', epoch=35)

        self.analyze('tweet_data_test.txt')

        return self.classifier

    def predict(self, start_time=1, end_time=1, kafka_url='print', kafka_topic='print'):
        df_posts = self.query_unlabelled_posts(start_time, end_time)\
        .withColumn('fasttext_in', u_clean_text(F.col('text')))

        def ft_model(text):
            try:
                pred = self.classifier.predict_proba([text])[0][0]
                topics = dict(
                    topic=pred[0],
                    weight=pred[1]
                )
                return json.dumps(topics)
            except:
                return ''

        # fasttext clf doesn't play nicely with spark so collect erthing
        # and apply in pandas.
        df_ft = df_posts.toPandas()
        df_ft['ft_topics'] = df_ft['fasttext_in'].apply(ft_model)

        df_ft2 = self.spark.spark.createDataFrame(df_ft)
        df_ft2 = df_ft2.select('*',
            F.json_tuple(df_ft2.ft_topics, 'topic', 'weight').alias('topic', 'weight')
        )

        df_ft2 = df_ft2.where(df_ft2.weight > 0.6)

        df_ft3 = df_ft2.select('*', F.explode('campaigns').alias('camp_id'))

        df_topics=df_ft3\
        .groupby('topic', 'camp_id')\
        .agg(
            F.collect_list('post_id').alias('post_ids'),
            F.collect_set('primary_image_url').alias('image_urls'),
            F.count('post_id').alias('cnt_post_ids'),
            F.collect_list('hashtags').alias('all_hashtags'),
            F.mean('weight').alias('avg_weight')
        )\
        .sort('cnt_post_ids', ascending=False)

        # def add_hashtags(_):
        #     return self.labels

        # u_add_hashtags = F.udf(add_hashtags, ArrayType(StringType()))

        df_topics = df_topics\
        .withColumn('hashtags', u_flatten('all_hashtags'))\
        .drop('all_hashtags')
        # .withColumn('top_hashtags', u_add_hashtags('topic')) # hack to add literal array for each row

        df_topics = df_topics\
        .withColumn('_post_ids', u_trunc_array('post_ids'))\
        .withColumn('_image_urls', u_trunc_array('image_urls'))

        df_topics = df_topics\
        .drop('post_ids')\
        .drop('image_urls')\
        .withColumnRenamed('_post_ids', 'post_ids')\
        .withColumnRenamed('_image_urls', 'image_urls')

        df_topics = df_topics.select('*',
            F.lit(datetime.now()).alias('created'),
            F.lit(start_time).alias('start_time'),
            F.lit(end_time).alias('end_time')
        )

        # TODO: output format
        topics = list(map(lambda s: json.loads(s), df_topics.toJSON().collect()))
        print('topics count:', len(topics))
        courier.deliver(topics, kafka_url, kafka_topic)

        self.save(df_topics)

        self.spark.stop()

    def analyze(self, test_file):
        result = self.classifier.test(test_file)
        print('########################################')
        print('############ MODEL ANALYSIS ############')
        print('P@1:', result.precision)
        print('R@1:', result.recall)
        print('Number of examples:', result.nexamples)
        print('########################################')

    def save(self, df):
        self.spark.collection = 'topic'
        self.spark.write(df)

    # posts used to train.
    def query_labelled_posts(self, start_time=1, end_time=1):
        df = self.query_posts(start_time, end_time)

        df_retweets = df\
        .where('featurizer == "hashtag"')\
        .where('broadcast_post_id is not null')

        df_no_retweets = df\
        .where('featurizer == "hashtag"')\
        .where('broadcast_post_id == "null" or broadcast_post_id is null')

        # use 1 retweet as stand-in for original tweet
        df_retweets = df_retweets.dropDuplicates(['broadcast_post_id'])

        return df_retweets.union(df_no_retweets)

    # posts used in predictions.
    def query_unlabelled_posts(self, start_time=1, end_time=1):
        df = self.query_posts(start_time, end_time)\
        .where('featurizer = "image"') # for primary_image_url in ui

        return df

    # base posts query.
    def query_posts(self, start_time=1, end_time=1):
        self.spark.collection = 'socialMediaPost'
        df = self.spark.read()\
        .select(['_id', 'text', 'featurizer', 'broadcast_post_id', 'campaigns',
            'hashtags', 'lang',  'post_id', 'timestamp_ms', 'primary_image_url'])\
        .where('lang = "en"')

        return df


def clean_text(txt):
    return ' '.join(pres_tokenize(txt, 'en'))

u_clean_text = F.udf(clean_text)

def flatten(l):
    flat_list = [item for sublist in l for item in sublist]
    return list(set(flat_list))

u_flatten = F.udf(flatten, ArrayType(StringType()))

def trunc_array(arr):
    return arr[:1000]

u_trunc_array = F.udf(trunc_array, ArrayType(StringType()))

