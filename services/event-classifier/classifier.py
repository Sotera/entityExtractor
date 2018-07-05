from sklearn.externals import joblib
import pyspark.sql.functions as F
from pyspark.sql.types import *
from os import getenv
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from mongo_spark_client import Client as SparkClient

IMG_MIN = 3 # min image count

# model: serialized obj that responds to predict()
# TODO: broadcast to cluster?
model = joblib.load(getenv('MODEL_PATH', '/usr/src/app/bagging_clf.pkl'))

class Classifier(object):
    def __init__(self):
        self.spark = SparkClient(master='localhost[*]')

    # event_ids: comma-separated ids, like "123,456,789"
    def run(self, event_ids):
        event_ids = event_ids.replace(' ', '').split(',')

        self.spark.collection = 'event'

        orig_events = self.spark.read()\
        .where(F.col('_id').isin(event_ids))

        events = orig_events\
        .select('_id', 'name', 'of_interest', 'location',
            'keywords', 'hashtags', 'image_urls',
            F.explode('cluster_ids').alias('cluster_id'))

        #### F.size() triggers an action (vs. transform)
        #### so lets filter it by cluster_ids right away.
        cluster_ids = list(events.toPandas()['cluster_id'].values)
        clusters = self._readPostsClusters(cluster_ids)

        events_clusters = events.join(clusters,
            events['cluster_id'] == clusters['_id'])

        events_posts_cnt = events_clusters\
        .groupby(events['_id'])\
        .agg(F.sum('posts_cnt').alias('all_posts_cnt'))

        agg_events1 = events_clusters\
        .groupby(events['_id'],
            'of_interest', 'data_type', 'location', 'keywords',
            'hashtags', 'image_urls')\
        .agg(F.sum('posts_cnt').alias('dt_posts_cnt'))

        agg_events2 = agg_events1\
        .join(events_posts_cnt, agg_events1['_id'] == events_posts_cnt['_id'])\
        .drop(events_posts_cnt['_id'])\
        .withColumn('text_wt',
            F.when(agg_events1['data_type'] == 'text',
                F.col('dt_posts_cnt')/F.col('all_posts_cnt')).otherwise(0))\
        .withColumn('image_wt',
            F.when(agg_events1['data_type'] == 'image',
                F.col('dt_posts_cnt')/F.col('all_posts_cnt')).otherwise(0))\
        .withColumn('hashtag_wt',
            F.when(agg_events1['data_type'] == 'hashtag',
                F.col('dt_posts_cnt')/F.col('all_posts_cnt')).otherwise(0))

        agg_events3 = agg_events2\
        .groupby('_id', 'of_interest', 'location', 'keywords', 'hashtags',
            'image_urls')\
        .agg(F.sum('all_posts_cnt'), F.sum('text_wt'), F.sum('image_wt'),
            F.sum('hashtag_wt'))

        df_classify = agg_events3\
        .withColumn('tmp_classify', (
            u_classify(
                F.col('hashtags'), F.col('location'), F.col('sum(hashtag_wt)'),
                F.col('sum(text_wt)'), F.col('sum(image_wt)'))).cast('boolean')
            )\
        .drop('of_interest')\
        .drop('sum(text_wt)')\
        .drop('sum(image_wt)')\
        .drop('sum(hashtag_wt)')\
        .drop('sum(all_posts_cnt)')\
        .drop('location')\
        .drop('keywords')\
        .drop('hashtags')\
        .drop('image_urls')\
        .withColumnRenamed('tmp_classify', 'of_interest')

        df_final = df_classify\
        .join(orig_events, df_classify['_id'] == orig_events['_id'])\
        .drop(df_classify['_id'])\
        .drop(orig_events['of_interest'])

        df_final.show()

        self.spark.write(df_final)

    def _readPostsClusters(self, cluster_ids):
        # change collection temporarily for this query
        self.spark.collection = 'postsCluster'

        #### F.size() triggers an action (vs. transform)
        #### so lets filter it by cluster_ids right away.
        clusters = self.spark.read()\
        .select('_id', 'similar_ids', 'data_type',
            F.size('similar_ids').alias('posts_cnt'))\
        .where(F.col('_id').isin(cluster_ids))

        ### Reset to event
        self.spark.collection = 'event'

        return clusters

def classify(hashtags, locations, hashtag_wt, text_wt, image_wt):
    X = [[hashtag_wt, text_wt, image_wt, score_ht(hashtags),
        score_loc(locations)]]
    pred = model.predict(X)
    return str(pred[0])

u_classify = F.udf(classify)

def score_loc(locations):
    if not (locations and len(locations)): return 0
    if not locations[0]: return 0
    top_wt = float(locations[0].weight)
    tot = sum(map(lambda loc: float(loc.weight), locations))
    if not tot: return 0
    return top_wt/tot

def score_ht(hashtags):
    if not (hashtags and len(hashtags)): return 0
    top_wt = int(hashtags[0][1])
    tot = sum(map(lambda k: int(k[1]), hashtags))
    if not tot: return 0
    return top_wt/tot

def score_img(urls):
    if not (urls and len(urls)): return 0
    if len(urls) >= IMG_MIN:
        return 1
    else:
        return 0

