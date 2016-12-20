#!/usr/bin/env python3
import sys, os, json
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from image_fetcher import fetch_image


def validate_job(job):
    if 'urls' not in job:
        return 'Missing "urls" required field'
    return None

def process_message(key, job):
    if not job:
        print('No Valid Job.')
        return

    error = validate_job(job)
    if error:
        print('Error in Job : {}'.format(error))
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    # local file path
    image_path = None
    # parsed, orig image url from page url
    image_url = None

    job_urls = job['urls'].split(',')

    for url in job_urls:
        if not url: continue

        # /downloads should be in shared volume
        image_info = fetch_image(url, download_path='/downloads/image-fetcher/')
        if image_info:
            image_path = image_info['image_path']
            image_url = image_info['image_url']

        # once found, break loop
        if image_path:
            break

    if not image_path:
        job['state'] = 'processed'
        job['data'] = []
        return

    data = {
        'path': image_path,
        'url': image_url
    }
    job['data'] = json.dumps(data)
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:fetch_image'])
    dispatcher.start()
