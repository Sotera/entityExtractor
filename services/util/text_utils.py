import re
import string

'''
Text helpers
'''

punc_pattern = r"[{}]".format(string.punctuation)

def remove_punctuation(text):
    '''
    Remove all punctuation from input
    '''
    return re.sub(punc_pattern, '', text)
