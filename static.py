#!/usr/bin/env python

import json
from mimetypes import guess_type
import os
import subprocess

from flask import abort, make_response

import app_config
import copytext
from flask import Blueprint
from render_utils import BetterJSONEncoder, flatten_app_config

static = Blueprint('static', __name__)

# Render JST templates on-demand
@static.route('/js/templates.js')
def _templates_js():
    r = subprocess.check_output(["node_modules/universal-jst/bin/jst.js", "--template", "underscore", "jst"])

    return make_response(r, 200, { 'Content-Type': 'application/javascript' })

# Render LESS files on-demand
@static.route('/less/<string:filename>')
def _less(filename):
    if not os.path.exists('less/%s' % filename):
        abort(404)

    r = subprocess.check_output(["node_modules/less/bin/lessc", "less/%s" % filename])

    return make_response(r, 200, { 'Content-Type': 'text/css' })

# Render application configuration
@static.route('/js/includes/app_config.js')
def _app_config_js():
    config = flatten_app_config()
    js = 'const appConfig = ' + json.dumps(config, cls=BetterJSONEncoder) + ';\nexport default appConfig;\n'

    return make_response(js, 200, { 'Content-Type': 'application/javascript' })

# Render copytext
# Split each sheet into its own file, to improve tree-shaking
@static.route('/js/includes/copy.bop.js')
def _copy_bop_js():
    copy_object = copytext.Copy(app_config.COPY_PATH)._serialize()
    copy = 'const copy = {};\nexport default copy;\n'.format(json.dumps(copy_object['bop']))
    return make_response(copy, 200, { 'Content-Type': 'application/javascript' })
@static.route('/js/includes/copy.content.js')
def _copy_content_js():
    copy_object = copytext.Copy(app_config.COPY_PATH)._serialize()
    copy = 'const copy = {};\nexport default copy;\n'.format(json.dumps(copy_object['content']))
    return make_response(copy, 200, { 'Content-Type': 'application/javascript' })

# Server arbitrary static files on-demand
@static.route('/<path:path>')
def _static(path):
    try:
        with open('www/%s' % path) as f:
            return make_response(f.read(), 200, { 'Content-Type': guess_type(path)[0] })
    except IOError:
        abort(404)
