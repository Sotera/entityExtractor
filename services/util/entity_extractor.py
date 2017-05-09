import traceback
from polyglot.text import Text

class EntityExtractor:
    def __init__(self):
        pass

    def extract(self, caption, tag='I-LOC'):
        try:
            text = Text(caption)
            if not tag:
                ll = u' '.join(text.entities)
            else:
                ll = [u' '.join(list(x)) for x in filter(lambda x: x.tag==tag, text.entities)]
            return set(ll)
        except:
            traceback.print_exc()
            return set([])
