#!/bin/bash

## example call
## ./stage.sh -h 1.1.1.1 -s 1490729833207 -e 1490731633206 -i "../../../.ssh/MyKeyFile.pem" -p 27017

REMOTE_DB="rancor"
LOCAL_DB="rancor"

usage="$(basename "$0") [-h] [-i] [-r] [-p] [-s] [-e] -- stage the a local watchman instance from data on a remote instance

where:
    -h  print this text
    -i  path to ssh key file
    -r  remote mongodb host (ip)
    -p  mongodb port on the remote host
    -s  start time in ms
    -e  end time in ms"

iflag=false
rflag=false
pflag=false
sflag=false
eflag=false

while getopts ':hi:r:p:s:e:' option
do
   case $option in
     h) echo "$usage"
        exit
        ;;
     i) KEYFILEPATH=$OPTARG
        iflag=true
        ;;
     r) HOST=$OPTARG
        rflag=true
        ;;
     p) PORT=$OPTARG
        pflag=true
        ;;
     s) STARTTIMEMS=$OPTARG
        sflag=true
        ;;
     e) ENDTIMEMS=$OPTARG
        eflag=true
        ;;
     \?) echo "Unknown option: -$OPTARG" >&2; exit 1;;
     :) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
     *) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
   esac
done
shift $(($OPTIND - 1))

if [ $iflag = false ] || [ $rflag = false ] || [ $pflag = false ] || [ $sflag = false ] || [ $eflag = false ]
then
    echo  "
          ****** ALL FLAGS MUST BE PROVIDED! *****
          "
    echo "$usage"
    exit 1
fi

## add -v to get verbose info to debug ssh connection
ssh -M -S my-ctrl-socket -i $KEYFILEPATH ubuntu@$HOST -L 9999:localhost:$PORT -fnNT
ssh -S my-ctrl-socket -O ubuntu@$HOST

##Query Example
##"{ end_time_ms: 1491244633207}"

## DUMP THE REMOTE SETTING COLLECTION
echo "Dumping '$HOST:$PORT/$REMOTE_DB/setting'..."
echo mongodump --host localhost:9999 --db $REMOTE_DB --collection "setting"
mongodump --host localhost:9999 --db $REMOTE_DB --collection "setting"

## DUMP THE REMOTE SOCIAL MEDIA POST COLLECTION
QUERY_SOCIAL_MEDIA_POST="{'timestamp_ms':{\$gte:$STARTTIMEMS,\$lte:$ENDTIMEMS}}"
echo "Dumping '$HOST:$PORT/$REMOTE_DB/SocialMediaPost'..."
echo mongodump --host localhost:9999 --db $REMOTE_DB --query $QUERY_SOCIAL_MEDIA_POST --collection "socialMediaPost"
mongodump --host localhost:9999 --db $REMOTE_DB --query $QUERY_SOCIAL_MEDIA_POST --collection "socialMediaPost"

## DUMP THE REMOTE POSTS CLUSTER COLLECTION
QUERY_POSTS_CLUSTER="{'start_time_ms':{\$gte:$(expr $STARTTIMEMS - 604800000),\$lte:$STARTTIMEMS}}"
echo "Dumping '$HOST:$PORT/$REMOTE_DB/postsClusters'..."
echo mongodump --host localhost:9999 --db $REMOTE_DB --query $QUERY_POSTS_CLUSTER --collection "postsCluster"
mongodump --host localhost:9999 --db $REMOTE_DB --query $QUERY_POSTS_CLUSTER --collection "postsCluster"

ssh -S my-ctrl-socket -O exit ubuntu@$HOST

## RESTORE DUMP DIRECTORY
echo "Restoring to '$LOCAL_DB'..."
mongorestore --db $LOCAL_DB --drop dump/$REMOTE_DB

## REMOVE DUMP FILES
echo "Removing dump files..."
rm -r dump

## RESET SOCIAL MEDIA POSTS TO "NEW" STATE
## mongo --eval "db=db.getSiblingDB('rancor'); db.socialMediaPost.update({}, {\$set: {state: 'new'}}, {multi: 1})"

echo =============================================================
echo set SYSTEM_START_TIME in your .env file to $STARTTIMEMS
echo set JOBSET_QUERYSPAN_MIN in your .env file to $(expr $(expr $ENDTIMEMS - $STARTTIMEMS + 1) / 60000)
echo =============================================================
echo "Done."
