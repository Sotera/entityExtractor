# modified from util/sentiment_filters.py

import re, traceback

def is_special(word):
    if not word: return True
    if word[0]=='#' or word[0]=='@' or word[-1]=='#' or word[-1]=='@':
        return True
    return word.isdigit()

def is_url(word):
    if len(word) > 4 and (word[:4] == 'http' or word[:3] == 'www'):
        return True
    return False

def pres_tokenize(caption, lang, b_filter_special=True, b_filter_url=True):
    if lang=='en':
        caption = re.sub('^rt ',' ', caption.lower(), flags=re.UNICODE)
        caption = re.sub('[\s]',' ', caption, flags=re.UNICODE)
        caption = re.sub('[^\w\s#]','',caption, flags=re.UNICODE)
        caption = list(filter(lambda x: x!='', caption.strip().split(' ')))
        tokens = caption
        if b_filter_special:
            tokens = filter(lambda x: is_special(x) is not True, tokens)
        if b_filter_url:
            tokens = filter(lambda x: is_url(x) is not True, tokens)
        return tokens
    elif lang=='ar':
        try:
            caption = re.sub('[#]', ' ',caption, flags=re.UNICODE)
            return list(filter(lambda x: len(x)>1, Text(caption).words))
        except:
            traceback.print_exc()
            return []
    else:
        return []
