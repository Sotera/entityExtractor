import numpy as np
import copy

def dot_comparison(e1, e2, normed=True, key='hashtags'):
    lt1, lt2 = e1[key], e2[key]
    w1 = dict(lt1)
    w2 = dict(lt2)
    words = copy.copy(w1.keys())
    words.extend(w2.keys())
    words = list(set(words))
    v1, v2 = [], []
    for w in words:
        v1.append(float(w1[w])) if w in w1 else v1.append(0.)
        v2.append(float(w2[w])) if w in w2 else v2.append(0.)
    v1, v2 = np.array(v1), np.array(v2)
    if normed is True:
        v1, v2 = v1/sum(v1), v2/sum(v2)
    return np.dot(v1, v2)