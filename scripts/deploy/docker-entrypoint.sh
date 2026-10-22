#!/bin/sh
set -eu
/update-config.sh /public/_app.config.js
exec static-web-server
