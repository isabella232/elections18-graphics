#!/usr/bin/env python

import app_config
import copytext
import boto
import logging
import shutil

from boto.s3.connection import OrdinaryCallingFormat
from fabric.api import local, task

logging.basicConfig(format=app_config.LOG_FORMAT)
logger = logging.getLogger(__name__)
logger.setLevel(app_config.LOG_LEVEL)

"""
Utilities used by multiple commands.
"""

from fabric.api import prompt

def confirm(message):
    """
    Verify a users intentions.
    """
    answer = prompt(message, default="Not at all")

    if answer.lower() not in ('y', 'yes', 'buzz off', 'screw you'):
        exit()


def get_bucket(bucket_name):
    """
    Established a connection and gets s3 bucket
    """

    if '.' in bucket_name:
        s3 = boto.connect_s3(calling_format=OrdinaryCallingFormat())
    else:
        s3 = boto.connect_s3()

    return s3.get_bucket(bucket_name)

@task
def install_font(force='true'):
    """
    Install font
    """
    print 'Installing font'
    if force != 'true':
        try:
            with open('www/css/icon/npr-app-template.css') and open('www/css/font/npr-app-template.svg'):
                logger.info('Font installed, skipping.')
                return
        except IOError:
            pass

    local('node_modules/fontello-cli/bin/fontello-cli install --config fontello/config.json --css www/css/icon --font www/css/font/')


@task
def open_font():
    """
    Open font in Fontello GUI in your browser
    """
    local('node_modules/fontello-cli/bin/fontello-cli open --config fontello/config.json')


@task
def create_state_overridecss():
    """
    Make all state override css files etc/overridestates-board/rendered
    """
    navbar = copytext.Copy(app_config.NAVBAR_PATH)
    ids = [str(int(float(row['seamusid']))) for row in navbar['states']]
    for id in ids:
        shutil.copyfile('etc/overridecss-states/_statepages.css', 'etc/overridecss-states/rendered/id{0}.css'.format(id))


@task
def create_board_overridecss():
    """
    Make all board override css files in etc/overridecss-board/rendered
    """
    navbar = copytext.Copy(app_config.NAVBAR_PATH)
    ids = [str(int(float(row['seamusid']))) for row in navbar['nav']]
    for id in ids:
        shutil.copyfile('etc/overridecss-boards/_boards.css', 'etc/overridecss-boards/rendered/id{0}.css'.format(id))
