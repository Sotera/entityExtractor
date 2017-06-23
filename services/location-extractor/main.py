from flask import request, abort, Flask
from json import dumps as jd
from locate import Locate
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))

api_root = os.getenv('API_ROOT', 'http://172.17.0.1:3003/api')
if api_root[-1] != '/':
    api_root += '/'

app = Flask('Location Extraction Service')
geo_threshold = float(os.getenv('GEO_THRESHOLD', '0.0'))
locate = Locate(api_root, '{}geocoder/forward-geo'.format(api_root), geo_threshold)


def set_err(job, msg):
    job['state'] = 'error'
    job['error'] = msg


def err_check(job):
    required = {'text'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))


def process_message(job):
    global api_root
    err_check(job)
    if 'state' in job and job['state'] == 'error':
        return

    job['location'] = locate.get_location(job['text'])
    return jd(job)


@app.route('/extract', methods=['POST'])
def extract():
    if not request.json or not 'text' in request.json:
        abort(400)
    return process_message(request.json), 200


@app.route('/')
def index():
    return 'Server Active.'


if __name__ == '__main__':
    app.run()
# job = {'state': 'new', 'api_root': 'http://172.17.0.1:3003/api',
#           'text': 'New poll: 6 out of 10 Americans support the Paris Agreement. Are you one of them? Join the movement.'}
