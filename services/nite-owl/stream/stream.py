import oauth2 as oauth
import urllib2 as urllib
import datetime, time, os, sys, json, argparse
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
import dirtools

twitter_keys = os.environ.get("TWITTER_KEYS")

if twitter_keys is None:
    try:
        # fallback to local file
        keys_file = "./private/twitter_keys.json"
        with open(keys_file, 'r') as content:
            twitter_keys = content.read()
    except:
        print "Missing TWITTER_KEYS env var or file %s. Cannot continue." % keys_file
        sys.exit(1) # 1 = stop 'nix | piping, if used


def get_credentials():
    #you'll need to get these by registering for your own twitter developer account
    #i've created multiple access keys to loop through to avoid timeout
    dict_llaves = json.loads(twitter_keys)
    auth_info = []
    for llave in dict_llaves:
        api_key = llave["consumer_key"]
        api_secret = llave["consumer_secret"]
        access_token_key = llave["access_token"]
        access_token_secret = llave["access_secret"]
        oauth_token    = oauth.Token(key=access_token_key, secret=access_token_secret)
        oauth_consumer = oauth.Consumer(key=api_key, secret=api_secret)
        auth_info.append((oauth_token, oauth_consumer))
    return auth_info

def twitterreq(oauth_token, oauth_consumer, url, http_method, parameters, debug=False):
    http_handler  = urllib.HTTPHandler(debuglevel=0)
    https_handler = urllib.HTTPSHandler(debuglevel=0)
    signature_method_hmac_sha1 = oauth.SignatureMethod_HMAC_SHA1()
    req = oauth.Request.from_consumer_and_token(oauth_consumer, token=oauth_token, http_method=http_method, http_url=url, parameters=parameters)
    req.sign_request(signature_method_hmac_sha1, oauth_consumer, oauth_token)
    headers = req.to_header()
    if http_method == "POST":
        encoded_post_data = req.to_postdata()
    else:
        encoded_post_data = None
    url = req.to_url()
    opener = urllib.OpenerDirector()
    opener.add_handler(http_handler)
    opener.add_handler(https_handler)
    res_try_time = datetime.datetime.now()
    if debug:
        print "Try to get response at ", res_try_time
    response = opener.open(url, encoded_post_data, 30)
    return response

def stream_data(response, response_open_time, outdir, debug = False):
    current_block = datetime.datetime.now()
    current_string = str(current_block.date())+"_"+str(current_block.time())+".json"
    outfile = open(outdir+"/stream/"+current_string, "w", 0)
    try:
        for line in response:
            now = datetime.datetime.now()
            if debug:
                print "response at", str(now),
            diff = now - current_block
            if diff.seconds > 180:
                outfile.close()
                response_up_time = now - response_open_time
                os.rename(outdir+"/stream/"+current_string, outdir+"/extract/"+current_string)
                if response_up_time.seconds > 900:
                    return
                current_block = now
                if debug:
                    print "\nNew File:", str(current_block)
                current_string = str(current_block.date())+"_"+str(current_block.time())+".json"
                outfile = open(outdir+"/stream/"+current_string, "w", 0)
                #every 2 hours, close existing connection, open under new key to avoid timeout
            try:
                outfile.write(line.strip()+"\n")
                print line[:100], '...'
            except:
                if debug:
                    print "json load error:", sys.exc_info()[0]
                continue
    except:
        if debug:
            print "No response error"
        time.sleep(20)

def main(args):
    outdir = args.outdir
    coordinates = ','.join(args.coordinates)
    debug = args.debug
    # prep output dirs
    stream_path = outdir + "/stream/"
    extract_path = outdir + "/extract/"

    dirtools.mkdir_p(stream_path)
    dirtools.mkdir_p(extract_path)

    if debug:
        print "Start Streaming"
    auth_info = get_credentials()
    auth_counter = 0

    http_method = "GET"
    url = "https://stream.twitter.com/1.1/statuses/filter.json?stall_warnings=true&locations=" + coordinates
    if debug:
        print "Using url", url
    pars = []
    response = twitterreq(auth_info[auth_counter][0], auth_info[auth_counter][1], url, http_method, pars, debug=debug)
    response_open_time = datetime.datetime.now()
    if debug:
        print "Response open time: ", str(response_open_time)

    while True:
        stream_data(response, response_open_time, outdir, debug)
        if debug:
            print "Exit stream_data"
        response.close()
        if debug:
            print "Closed response"
        b_new_response = False
        while b_new_response == False:
            try:
                auth_counter = (auth_counter+1) % len(auth_info)
                response_open_time = datetime.datetime.now()
                if debug:
                    print "Try new Connection...."
                response = twitterreq(auth_info[auth_counter][0], auth_info[auth_counter][1], url, http_method, pars)
                if debug:
                    print "New connection @", str(response_open_time)
                b_new_response = True
            except:
                if debug:
                    print "*****\nResponse Error @:", response_open_time
                    print "->", sys.exc_info()[0],"\nWait for 30 seconds, try again."
                time.sleep(30)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    # UK: -11.9591 49.637 2.8771 57.863
    parser.add_argument("coordinates", nargs="+", help="southwest/northeast coordinates (LNG LAT): ex. 1 10 2 20")
    parser.add_argument("--outdir", help="Directory where tweet files will be written locally", default="downloads/files")
    parser.add_argument("--debug", help="Verbose logging", action="store_true", default=False)
    args = parser.parse_args()
    main(args)
