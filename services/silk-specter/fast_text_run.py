import pyspark.sql.functions as F
from os import getenv
import sys, os, json
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from mongo_spark_client import Client as SparkClient
from tokenizer import pres_tokenize

class Runner(object):
    def __init__(self):
        self.spark = SparkClient(uri='mongodb://mongo:27017',
            master='localhost[*]')

    def run(self, clf, start_time=1, end_time=1):
        self.spark.collection = 'socialMediaPost'

        df_posts = self.spark.read()\
        .select(['_id', 'text', 'featurizer', 'broadcast_post_id', 'campaigns', 'hashtags', 'lang', 'post_id', 'timestamp_ms'])\
        .where('featurizer = "text"')\
        .where('lang = "en"')\
        .limit(1000)\
        .withColumn('fasttext_in', u_tokenize_all(F.col('text')))


        def ft_model(text):
            try:
                pred = clf.predict_proba([text])[0][0]
                topics = dict(
                        topic=list(labels)[int(pred[0])-1],
                        weight=pred[1]
                    )
                return json.dumps(topics)
            except:
                return ''

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
        .withColumn('sorted_topics', u_sort_topics(F.col('all_topics')))

        df_campaign4.show()

def tokenize_all(txt):
    return ' '.join(pres_tokenize(txt, 'en'))

u_tokenize_all = F.udf(tokenize_all)

def load(s):
    try:
        return json.loads(s)
    except:
        return {'weight':0, 'topic': 'BOGUS'}

def sort_topics(arr):
    arr = list(set(arr)) # obj is a str so we can use set() to compare for dupes
    arr.sort(key=lambda s: load(s)['weight'], reverse=1)
    return arr[:5]

u_sort_topics = F.udf(sort_topics)
