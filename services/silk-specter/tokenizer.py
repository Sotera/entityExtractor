# modified from util/sentiment_filters.py

import re, traceback

def pres_tokenize(caption, lang):
    if lang=='en':
        caption = re.sub('[\s]',' ', caption.lower(),flags=re.UNICODE)
        caption = re.sub('[^\w\s#]','',caption,flags=re.UNICODE)
        caption = list(filter(lambda x: x!='', caption.strip().split(' ')))
        return list(filter(lambda x: x[0]!="#", caption))
    elif lang=='ar':
        try:
            caption = re.sub('[#]', ' ',caption,flags=re.UNICODE)
            return list(filter(lambda x: len(x)>1, Text(caption).words))
        except:
            traceback.print_exc()
            return []
    else:
        return []
