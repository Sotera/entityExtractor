import re
import traceback
# from polyglot.text import Text
from stop_words import get_stop_words
from nltk.tokenize import TweetTokenizer
# from polyglot.text import Text

tknzr = TweetTokenizer()

class SentimentFilter:
    def __init__(self):
        self.good_langs = ['en', 'ar', 'ru']
        black_list = ['rt', 'amp']
        self.stop = {'ar':set(get_stop_words('ar') + black_list), 'en':set(map(lambda x: re.sub('[^\w\s]', '', x, flags=re.UNICODE) ,get_stop_words('en')+black_list))}


    def which_languages(self):
        return self.good_langs

    def is_special(self, word):
        if not word: return True
        if word[0]=='#' or word[0]=='@' or word[-1]=='#' or word[-1]=='@':
            return True
        return word.isdigit()

    def is_url(self, word):
        if len(word) > 4 and (word[:4] == 'http' or word[:3] == 'www'):
            return True
        return False

    def is_scoreable(self, caption, lang, b_filter_url=True, b_filter_special=True):
        all_words = filter(lambda x: self.is_url(x) is False,
                           self.tokenize(caption, lang, b_filter_url=b_filter_url, b_filter_special=b_filter_special)
                          )
        if len(all_words) > 2:
            return True
        return False

    def tokenize(self, caption, lang, b_filter_url=True, b_filter_special=True, b_remove_stop=True, b_unique=True):
        caption = re.sub('[\s]', ' ', caption.lower(), flags=re.UNICODE)
        if lang=='en':
            caption = re.sub('[^\w\s@#]','',caption,flags=re.UNICODE)
            tokens = filter(lambda x: len(x) > 2, caption.strip().split(' '))
            if b_filter_special:
                tokens = filter(lambda x: self.is_special(x) is not True, tokens)
            if b_filter_url:
                tokens = filter(lambda x: self.is_url(x) is not True, tokens)
            if b_remove_stop:
                tokens = filter(lambda x: x not in self.stop[lang], tokens)
            if b_unique:
                return list(set(tokens))
            return tokens
        elif lang=='ar' or lang=='ru':
            try:
                if b_filter_special:
                    caption = ' '.join(filter(lambda x: self.is_special(x)==False, caption.split(' ')))
                tokens = filter(lambda x: len(x)>1, tknzr.tokenize(caption))
                if b_filter_url:
                    tokens = filter(lambda x: self.is_url(x) is not True, tokens)
                if b_remove_stop:
                    tokens = filter(lambda x: x not in self.stop[lang], tokens)
                if b_unique:
                    return list(set(tokens))
                return tokens
            except:
                traceback.print_exc()
                return []
        else:
            return []


    def pres_tokenize(self, caption, lang):
        if lang=='en':
            caption = re.sub('[\s]',' ',caption.lower(),flags=re.UNICODE)
            caption = re.sub('[#]', ' #',caption,flags=re.UNICODE)
            return filter(lambda x: x!='', caption.strip().split(' '))
        elif lang=='ar':
            try:
                caption = re.sub('[#]', ' #',caption,flags=re.UNICODE)
                return filter(lambda x: len(x)>1, Text(caption).words)
            except:
                traceback.print_exc()
                return []
        else:
            return []

    def extract_loc(self, caption):
        try:
            text = Text(caption)
            ll = [u' '.join(list(x)) for x in filter(lambda x: x.tag=='I-LOC', text.entities)]
            return set(ll)
        except:
            traceback.print_exc()
            return set([])
