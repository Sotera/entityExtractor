#!flask/bin/python
from flask import request
from flask import abort
from flask import Flask, jsonify
import json
from sentiment_filters import SentimentFilter
sf = SentimentFilter()
app = Flask(__name__)


@app.route('/extract', methods=['POST'])
def extract():
    if not request.json or not 'text' in request.json:
        abort(400)
    locs = sf.extract_loc(request.json['text'])
    return json.dumps(list(locs)),200

@app.route('/')
def index():
    return "Hello, World!"

if __name__ == '__main__':
    app.run(debug=True)
