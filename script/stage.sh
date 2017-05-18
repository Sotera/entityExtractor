#!/bin/bash

## example call
## ./stage.sh -h 1.1.1.1 -s 1490729833207 -e 1490731633206 -i "../../../.ssh/MyKeyFile.pem" -p 27017 -l 1234

## assume we are using rancor...cause we are
REMOTE_DB="rancor"
LOCAL_DB="rancor"

usage="$(basename "$0") [-h] [-i] [-r] [-p] [-l] [-s] [-e] -- stage the a local watchman instance from data on a remote instance

where:
    -h  print this text
    -i  path to ssh key file
    -r  remote mongodb host (ip)
    -p  mongodb port on the remote host
    -l  local tunnel port (a free one to use for the tunnel)
    -s  start time in ms
    -e  end time in ms"

i_flag=false
r_flag=false
p_flag=false
s_flag=false
e_flag=false
l_flag=false

while getopts ':hi:r:p:l:s:e:' option
do
   case $option in
     h) echo "$usage"
        exit
        ;;
     i) KEY_FILE_PATH=$OPTARG
        i_flag=true
        ;;
     r) HOST=$OPTARG
        r_flag=true
        ;;
     p) PORT=$OPTARG
        p_flag=true
        ;;
     l) TUNNEL_PORT=$OPTARG
             l_flag=true
             ;;
     s) START_TIME_MS=$OPTARG
        s_flag=true
        ;;
     e) END_TIME_MS=$OPTARG
        e_flag=true
        ;;
     \?) echo "Unknown option: -$OPTARG" >&2; exit 1;;
     :) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
     *) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
   esac
done
shift $(($OPTIND - 1))

if [ $i_flag = false ] || [ $r_flag = false ] || [ $p_flag = false ] || [ $l_flag = false ] || [ $s_flag = false ] || [ $e_flag = false ]
then
    echo  "
****** ALL FLAGS MUST BE PROVIDED! *****"
    if [ $i_flag = false ]
    then
      echo "*** missing -i"
    fi
    if [ $r_flag = false ]
    then
      echo "*** missing -r"
    fi
    if [ $p_flag = false ]
    then
      echo "*** missing -p"
    fi
    if [ $l_flag = false ]
    then
      echo "*** missing -l"
    fi
    if [ $s_flag = false ]
    then
      echo "*** missing -s"
    fi
    if [ $e_flag = false ]
    then
      echo "*** missing -e"
    fi
    echo
    echo "$usage"
    exit 1
fi

## add -v to get verbose info to debug ssh connection
ssh -M -S my-ctrl-socket -i $KEY_FILE_PATH ubuntu@$HOST -L $TUNNEL_PORT:localhost:$PORT -fnNT
ssh -S my-ctrl-socket -O ubuntu@$HOST

##Query Example
##"{ end_time_ms: 1491244633207}"

## DUMP THE REMOTE SETTING COLLECTION
echo "Dumping '$HOST:$PORT/$REMOTE_DB/setting'..."
echo mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --collection "setting"
mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --collection "setting"

## DUMP THE REMOTE SOCIAL MEDIA POST COLLECTION
QUERY_SOCIAL_MEDIA_POST="{'timestamp_ms':{\$gte:$START_TIME_MS,\$lte:$END_TIME_MS}}"
echo "Dumping '$HOST:$PORT/$REMOTE_DB/SocialMediaPost'..."
echo mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --query $QUERY_SOCIAL_MEDIA_POST --collection "socialMediaPost"
mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --query $QUERY_SOCIAL_MEDIA_POST --collection "socialMediaPost"

## DUMP THE REMOTE POSTS CLUSTER COLLECTION
QUERY_POSTS_CLUSTER="{'start_time_ms':{\$gte:$(expr $START_TIME_MS - 604800000),\$lte:$START_TIME_MS}}"
echo "Dumping '$HOST:$PORT/$REMOTE_DB/postsClusters'..."
echo mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --query $QUERY_POSTS_CLUSTER --collection "postsCluster"
mongodump --host localhost:$TUNNEL_PORT --db $REMOTE_DB --query $QUERY_POSTS_CLUSTER --collection "postsCluster"

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
echo set SYSTEM_START_TIME in your .env file to $START_TIME_MS
echo set JOBSET_QUERYSPAN_MIN in your .env file to $(expr $(expr $END_TIME_MS - $START_TIME_MS + 1) / 60000)
echo =============================================================
echo "Done."
