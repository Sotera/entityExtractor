import sys, os, json
from redis_dispatcher import Dispatcher


def validate_job(job):
    if 'archive_url' not in job:
        return 'Missing "archive_url" required field'
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

    ###
    # output = detect(job["archive_url"])
    ###

    job['data'] = json.dumps(output)
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            channels=['genie:threats'])
    dispatcher.start()

# redis integration testing from ur terminal
#redis-cli
#hmset 123 archive_url https://s3.amazonaws.com/watchman/threat-detection-test.zip
#publish 123
# wait for job to finish then
#hmgetall 123
