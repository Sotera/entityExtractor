import urllib2
import urllib
import uuid
from bs4 import BeautifulSoup
from urlparse import urlparse

req_headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
    'Accept-Encoding': 'none',
    'Accept-Language': 'en-US,en;q=0.8',
    'Connection': 'keep-alive'
}

def fetch_image(url):
    '''
    Parse a social media page's content to find the user-submitted
    image and download it for processing.

    Assumes image is jpeg format.
    '''
    image_path = None

    for domain in SOURCES:
        if domain in url:
            image_url = get_image_url(url)
            if image_url:
                image_path = download_image(image_url)
                break

    return image_path

def get_jpeg_url_from_open_graph_tag(soup):
    '''
    Use FB Open Graph meta tags to get image url.
    '''
    meta_tags = soup.head.find_all('meta')
    matches = [tag for tag in meta_tags if tag.has_attr('property') and tag['property'] == 'og:image']
    if matches:
        return matches[0]['content']

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
            print 'No Image Found'
            return None
    except Exception as e:
        print 'Error: {}'.format(e)

def url_to_soup(url):
    req = urllib2.Request(url, headers=req_headers)
    res = urllib2.build_opener(urllib2.HTTPCookieProcessor).open(req, timeout=4)
    return BeautifulSoup(res.read(), 'html.parser')

def get_page_image_url(url, soup):
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    return SOURCES[domain](soup)

def download_image(image_url):
    if not image_url:
        return None
    image_path = '{}.jpg'.format(uuid.uuid4())
    urllib.urlretrieve(image_url, image_path)
    return image_path


if __name__ == '__main__':
    print fetch_image('https://www.instagram.com/p/BJsmWmLDiD3/')
    print fetch_image('https://twitter.com/SRuhle/status/780407143497367552')
    print fetch_image('https://www.swarmapp.com/c/8Ez3xo3RtcP')
