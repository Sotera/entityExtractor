#!/bin/bash

## example call
## ./clone.sh -h 1.1.1.1 -i "../../../.ssh/MyKeyFile.pem" -p 27017 -l 1234

## assume we are using rancor...cause we are
REMOTE_DB="rancor"
LOCAL_DB="rancor"

usage="$(basename "$0") [-h] [-i] [-r] [-p] [-l] -- stage the a local watchman instance from data on a remote instance

where:
    -h  print this text
    -i  path to ssh key file
    -r  remote mongodb host (ip)
    -p  mongodb port on the remote host
    -l  local tunnel port (a free one to use for the tunnel)"

i_flag=false
r_flag=false
p_flag=false
l_flag=false

while getopts ':hi:r:p:l:' option
do
   case ${option} in
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
     \?) echo "Unknown option: -$OPTARG" >&2; exit 1;;
     :) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
     *) echo "Unimplemented option: -$OPTARG" >&2; exit 1;;
   esac
done
shift $(($OPTIND - 1))

if [ ${i_flag} = false ] || [ ${r_flag} = false ] || [ ${p_flag} = false ] || [ ${l_flag} = false ]
then
    echo  "
****** ALL FLAGS MUST BE PROVIDED! *****"
    if [ ${i_flag} = false ]
    then
      echo "*** missing -i"
    fi
    if [ ${r_flag} = false ]
    then
      echo "*** missing -r"
    fi
    if [ ${p_flag} = false ]
    then
      echo "*** missing -p"
    fi
    if [ ${l_flag} = false ]
    then
      echo "*** missing -l"
    fi
    echo
    echo "$usage"
    exit 1
fi

## add -v to get verbose info to debug ssh connection
ssh -M -S my-ctrl-socket -i ${KEY_FILE_PATH} ubuntu@${HOST} -L ${TUNNEL_PORT}:localhost:${PORT} -fnNT
ssh -S my-ctrl-socket -O ubuntu@${HOST}

##Query Example
##"{ end_time_ms: 1491244633207}"

## DUMP THE REMOTE SETTING COLLECTION
echo "Dumping '$HOST:$PORT/$REMOTE_DB'..."
echo mongodump --host localhost:${TUNNEL_PORT} --db ${REMOTE_DB}
mongodump --host localhost:${TUNNEL_PORT} --db ${REMOTE_DB}

ssh -S my-ctrl-socket -O exit ubuntu@${HOST}

## RESTORE DUMP DIRECTORY
echo "Restoring to '$LOCAL_DB'..."
mongorestore --db ${LOCAL_DB} --drop dump/${REMOTE_DB}

## REMOVE DUMP FILES
echo "Removing dump files..."
rm -r dump

echo "Done."
