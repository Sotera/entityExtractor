from math import log2
from pyspark.sql import SparkSession
import sys
sys.path.append("/Users/jgartner/projects/xdata/QCR/watchman/services/util")
from sentiment_filters import SentimentFilter

def create_tokens(text, lang, bc_sf):
    return bc_sf.value.tokenize(text, lang)

def create_word_pairs(words, s_join = "_+_"):
    pairs = []
    for i in range(len(words)):
        for ii in range(i+1, len(words)):
            pairs.append(s_join.join(sorted([words[i], words[ii]])))
    return pairs

def calc_PMI(term, term_count, n_v, bc_wc):
    terms = term.split("_+_")
    c1, c2 = (bc_wc.value[terms[0]], bc_wc.value[terms[1]])
    return log2((1.*term_count*n_v)/(1.*c1*c2))

def period_pmi(spk_master="local[*]", mongo_url="mongodb://127.0.0.1/rancor.socialMediaPost", lang='en', min_ts = 0., max_ts = 999999999999):
    # init spark, connect to mongo, get collection
    spk = SparkSession.builder\
        .master(spk_master)\
        .appName("pmi")\
        .config("spark.mongodb.input.uri", mongo_url)\
        .getOrCreate()
    # create dataframe from smp collection, filter to relevant data
    df = spk.read.load(format='com.mongodb.spark.sql')
    df = df[(df['lang']==lang) & (df['timestamp_ms'] > min_ts) & (df['timestamp_ms'] < max_ts)]

    #create sf broadcast variable
    sf = SentimentFilter()
    bc_sf = sc.broadcast(sf)

    #find valid docs, find word counts
    valid_doc = df_en.rdd.map(lambda x: create_tokens(x.text, lang, bc_sf)).filter(lambda x: len(x)>1).cache()
    n_valid = valid_doc.count()
    wc = valid_doc.flatMap(lambda x: [(y,1) for y in x])\
        .reduceByKey(lambda x,y: x+y)\
        .filter(lambda x: x[1]/n_valid>0.0001 and x[1]/n_valid < .13)
    print("{} unique terms, {} valid documents".format(wc.count(), n_valid))
    d_wc = wc.collectAsMap()
    bc_wc = sc.broadcast(d_wc)

    #find word pairs
    wp = df_en.rdd.map(lambda x: [x for x in create_tokens(x.text, lang, bc_sf) if x in bc_wc.value])\
        .flatMap(lambda x: create_word_pairs(x))\
        .map(lambda x: (x,1))\
        .reduceByKey(lambda x,y: x+y)\
        .filter(lambda x: x[1]>20)

    #calculate PMI
    pmi = wp.map(lambda x: (x[0], calc_PMI(x[0], x[1], n_valid, bc_wc)))
    return pmi.sortBy(lambda x: x[1], ascending=False).collectAsDict()

