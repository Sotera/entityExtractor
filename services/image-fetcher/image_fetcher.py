import sys, os
import urllib.request, urllib.error, urllib.parse, urllib.request, urllib.parse, urllib.error
import uuid
import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from dirtools import mkdir_p

req_headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
    'Accept-Encoding': 'none',
    'Accept-Language': 'en-US,en;q=0.8',
    'Connection': 'keep-alive'
}

def fetch_image(url, download_path='./'):
    '''
    Parse a social media page's content to find the user-submitted
    image and download it for processing.

    Assumes image is jpeg format.

    download_path: local dir path, ex. /path/to/downloads/
    returns: dict with keys: image_path, image_url
    '''
    mkdir_p(download_path)
    image_path = None
    image_url = None

    for domain in SOURCES:
        if domain in url:
            image_url = get_image_url(url)
            if image_url:
                image_path = download_image(image_url, path=download_path)
                break

    if image_path and image_url:
        return {
            'image_path': image_path,
            'image_url': image_url
        }

def get_jpeg_url_from_open_graph_tag(soup):
    '''
    Use FB Open Graph meta tags to get image url.
    '''
    meta_tags = soup.head.find_all('meta')
    matches = [tag for tag in meta_tags if tag.has_attr('property') and tag['property'] == 'og:image']
    if len(matches):
        og_image = matches[0]['content']
        # skip if looks like user profile images
        if not re.search('/profile', og_image, re.IGNORECASE):
            return og_image

# map domains to html parser functions
SOURCES = {
    'instagram.com': get_jpeg_url_from_open_graph_tag,
    'twitter.com': get_jpeg_url_from_open_graph_tag
}

def get_image_url(url):
    image_url = None

    try:
        soup = url_to_soup(url)
        image_url = get_page_image_url(url=url, soup=soup)

        if image_url:
            return image_url
        else:
            print('No Image Found')
            return None
    except Exception as e:
        print('Error: {}'.format(e))

def url_to_soup(url):
    req = urllib.request.Request(url, headers=req_headers)
    res = urllib.request.build_opener(urllib.request.HTTPCookieProcessor).open(req, timeout=4)
    return BeautifulSoup(res.read(), 'html.parser')

def get_page_image_url(url, soup):
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    return SOURCES[domain](soup)

def download_image(image_url, path='./'):
    if not image_url:
        return None
    image_path = create_file_name(path)
    urllib.request.urlretrieve(image_url, image_path)
    return image_path

def create_file_name(path):
    return '{}{}.jpg'.format(path, uuid.uuid4())

if __name__ == '__main__':
    print(fetch_image('https://www.instagram.com/p/BJsmWmLDiD3/'))
    print(fetch_image('https://twitter.com/Abizy_m/status/775762443817607170'))
    print(fetch_image('https://www.swarmapp.com/c/8Ez3xo3RtcP'))
