import unittest
import image_fetcher as fetcher

class ImageFetcherTest(unittest.TestCase):

    # mock download file path
    fetcher.create_file_name = lambda path: '/tmp/mockfilename'

    def test_fetch_image_succeeds(self):
        file_path = fetcher.fetch_image('https://www.instagram.com/p/BJsmWmLDiD3/', '/tmp/')
        self.assertEqual(file_path['image_path'], '/tmp/mockfilename')

    def test_fetch_image_404_response(self):
        file_path = fetcher.fetch_image('https://www.instagram.com/p/bogus/', '/tmp/')
        self.assertIsNone(file_path)

    def test_fetch_image_invalid_domain(self):
        file_path = fetcher.fetch_image('https://www.bogus.com', '/tmp/')
        self.assertIsNone(file_path)

if __name__ == '__main__':
    unittest.main()
