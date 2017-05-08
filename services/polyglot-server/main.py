from flask import request, abort, Flask
from json import dumps as jd
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from entity_extractor import EntityExtractor
ent_ext = EntityExtractor()
app = Flask('Polyglot server')


@app.route('/extract', methods=['POST'])
def extract():
    if not request.json or not 'text' in request.json:
        abort(400)
    locs = ent_ext.extract(request.json['text'], tag='I-LOC')
    return jd(list(locs)), 200

@app.route('/')
def index():
    return 'Hello from Flask!'

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
