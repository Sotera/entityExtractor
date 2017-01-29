import re
import traceback
from polyglot.text import Text

class SentimentFilter:
    def __init__(self):
        self.good_langs = ['en']

    def which_languages(self):
        return self.good_langs

    def is_scoreable(self, caption, lang):
        all_words = self.tokenize(caption, lang)
        scorable_words = 0
        for word in all_words:
            if word[0] == '@':
                continue
            if len(word)>4:
                if word[:4] == 'http' or word.find('.com')!=-1:
                    continue
            scorable_words += 1
        if scorable_words >2:
            return True
        return False


    def tokenize(self, caption, lang):
        if lang=='en':
            caption = re.sub('[\s#]',' ',caption.lower(),flags=re.UNICODE)
            caption = re.sub('[^\w\s@]','',caption,flags=re.UNICODE)
            return filter(lambda x: x!='', caption.strip().split(' '))
        elif lang=='ar':
            try:
                return filter(lambda x: len(x)>1, Text(caption).words)
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

