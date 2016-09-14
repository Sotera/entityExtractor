import unittest
from redis_dispatcher import Worker
from mock import Mock

class RedisDispatcherTest(unittest.TestCase):

    def setUp(self):
        self.redis = Mock()
        self.worker = Worker(self.redis)

    def test_redis_mocks(self):
        self.redis.hgetall.return_value = {'a': 1}
        self.redis.hmset.return_value = 1

        self.assertEqual(self.worker.send.hgetall(), {'a': 1})
        self.assertEqual(self.worker.send.hmset(), 1)

    def test_run_with_missing_job(self):
        self.redis.hgetall.return_value = None
        self.assertIsNone(self.worker.run(dict(data=1)))

    def test_run_with_existing_job(self):
        self.redis.hgetall.return_value = dict(state='new')
        self.assertIsNone(self.worker.run(dict(data=1)))

    def test_run_clear_last_job_values(self):
        last_job = dict(error='some error msg',
            state='new', data='some data')
        self.redis.hgetall.return_value = last_job
        self.worker.run(dict(data=1))

        self.assertEqual(None, last_job.get('error'))
        self.assertEqual(None, last_job.get('data'))

    def test_run_job_is_processing(self):
        new_job = dict(state='new')
        self.redis.hgetall.return_value = new_job
        self.worker.run(dict(data=1))

        self.assertEqual(new_job['state'], 'processing')

    def test_run_call_process_func(self):
        key, mock_func = 1, Mock()
        self.redis.hgetall.return_value = dict(state='new')
        self.worker.run(dict(data=key), process_func=mock_func)

        mock_func.assert_called_once_with(key, {'state': 'processing'})


if __name__ == '__main__':
    unittest.main()
