import json, urllib2, os, time, argparse, sys
from bs4 import BeautifulSoup
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
import dirtools

def url_to_soup(url):
    hdr = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
        'Accept-Encoding': 'none',
        'Accept-Language': 'en-US,en;q=0.8',
        'Connection': 'keep-alive'
    }
    req = urllib2.Request(url, headers=hdr)
    res = urllib2.build_opener(urllib2.HTTPCookieProcessor).open(req, timeout=4)
    return BeautifulSoup(res.read(), "html.parser")

def get_instagram_page_image(soup):
    l_meta = soup.head.find_all('meta')
    for m in l_meta:
        if m.has_attr('content'):
            ind = m['content'].find('jpg')
            if ind != -1:
                return m['content'][:ind+3]
    return None

def get_file_images(file_path):
    tmp_file_path = file_path.replace('/extract', '/tmp')
    finished_file_path = file_path.replace('/extract', '')
    infile = open(file_path, 'r')
    # move to diff location while writing
    outfile = open(tmp_file_path, 'w')
    n_i, n_t, n_err = 0, 0, 0
    for line in infile:
        try:
            data = json.loads(line)
            img_url = None
            if data['source'].find('instagram') != -1:
                for url in data['entities']['urls']:
                    try:
                        soup = url_to_soup(url['expanded_url'])
                        img_url = get_instagram_page_image(soup)
                        n_i += 1
                    except:
                        n_err += 1
            if img_url != None:
                print img_url
                outfile.write(line[:-2]+', "instagram":{"img_url":"'+img_url+'"}'+line[-2:])
            else:
                outfile.write(line)
        except:
            print json.dumps(line)
            break
    outfile.close()
    os.rename(tmp_file_path, finished_file_path)
    print 'Errors:', n_err
    print 'Images from twitter:', n_t
    print 'Images from instagram:', n_i

def main(args):
    outdir = args.outdir
    debug = args.debug

    # prep output dirs
    extract_path = outdir + "/extract/"
    tmp_path = outdir + "/tmp/"

    dirtools.mkdir_p(extract_path)
    dirtools.mkdir_p(tmp_path)

    n_sleep = 0
    while n_sleep<60:
        num_files = len(os.listdir(extract_path))
        print "%d files found to process..." % (num_files)
        if num_files > 0:
            n_sleep = 0
            files = sorted(os.listdir(extract_path), key=lambda x: os.stat(os.path.join(extract_path, x)).st_mtime)
            for f in files:
                start_time = time.time()
                file_path = extract_path + f
                print "Processing file:", file_path
                get_file_images(file_path)
                try:
                    os.remove(file_path)
                except:
                    print "Error deleting file: " + file_path
                if debug:
                    print "Finished in", time.time() - start_time, "seconds"
        else:
            wait = 5 * 60 # 5 mins
            time.sleep(wait)
            print "sleeping for %d mins..." % wait
            n_sleep += 1
            if n_sleep > 5:
                print "There have been no files to analyze for", n_sleep*5, "minutes, the twitter stream may be down"
    print "No new files for 3 hours, shutting down."



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--outdir", help="Directory where tweet files will be written locally", default="downloads/files")
    parser.add_argument("--debug", help="Verbose logging", action="store_true", default=False)
    args = parser.parse_args()
    main(args)
