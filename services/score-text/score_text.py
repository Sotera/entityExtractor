from sklearn.externals import joblib

from pyspark.sql.functions import col, udf

from os import getenv

# model: serialized obj that responds to predict()
model = joblib.load(getenv('MODEL_PATH', '/usr/src/app/regr_rf.pkl'))
# vectorizer: serialized obj that responds to transform()
vectorizer = joblib.load(getenv('VEC_PATH', '/usr/src/app/tfidf_vectorizer.pkl'))

def predict(text):
    vec = vectorizer.transform([text])
    return float(model.predict(vec).tolist()[0])

u_predict = udf(predict)

class Scorer(object):
    def __init__(self, spark):
        self.spark = spark

    def score(self, set_id):
        df = self.spark.read().where(col('set_id') == set_id)

        df = df.withColumn('score', u_predict(df['text']))

        self.spark.write(df)
