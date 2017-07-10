from pyspark.sql import SparkSession

mongo_fmt = 'com.mongodb.spark.sql'

class Client(object):
    '''
    Read + Write to mongodb using mongo-spark connector
    '''
    def __init__(self, master='local[*]', uri='mongodb://mongo:27017',
        db='rancor', collection=None):

        self.spark = SparkSession.builder.master(master).getOrCreate()
        self.sparkContext = self.spark.sparkContext
        self.mongo_uri = dict(uri=uri, database=db, collection=collection)

    def read(self):
        return self.spark.read.load(format=mongo_fmt, **self.mongo_uri)

    def write(self, df, mode='append'):
        df.write.format(mongo_fmt).mode(mode).options(**self.mongo_uri).save()

    def stop(self):
        self.spark.stop()

    # getters/setters
    @property
    def collection(self):
        return self.mongo_uri['collection']

    @collection.setter
    def collection(self, val):
        self.mongo_uri['collection'] = val
