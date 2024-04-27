# Jared Rosenlund, Michael Hutchings, Adam Ross, Ryan Ward
# Section 2 Group 1
# This page uses certbot to secure our domain name with https

#!/usr/bin/env bash
# Place in .platform/hooks/postdeploy directory
sudo certbot -n -d cathyscookbook.is404.net --nginx --agree-tos --email hutchmj@byu.edu