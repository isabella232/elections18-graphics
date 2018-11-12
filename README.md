Copyright 2018 NPR.  All rights reserved.  No part of these materials may be reproduced, modified, stored in a retrieval system, or retransmitted, in any form or by any means, electronic, mechanical or otherwise, without prior written permission from NPR.

(Want to use this code? Send an email to nprapps@npr.org!)


Elections 2018 Graphics
========================

* [What is this?](#what-is-this)
* [Assumptions](#assumptions)
* [What's in here?](#whats-in-here)
* [Bootstrap the project](#bootstrap-the-project)
* [Hide project secrets](#hide-project-secrets)
* [Save media assets](#save-media-assets)
* [Add a page to the site](#add-a-page-to-the-site)
* [Run the project](#run-the-project)
* [COPY configuration](#copy-configuration)
* [COPY editing](#copy-editing)
* [Open Linked Google Spreadsheet](#open-linked-google-spreadsheet)
* [Generating custom font](#generating-custom-font)
* [Arbitrary Google Docs](#arbitrary-google-docs)
* [Deploy to S3](#deploy-to-s3)

What is this?
-------------

Contains code for all graphics related to the 2018 General Election results.

[This](https://docs.google.com/drawings/d/1k0Z4Le_vpt5NIF6_BnXyApkum5dLUOFQhRV43bN7Rmo) is a graphical summary of how each component interacts, between the three repositories involved in the experience:

![](https://user-images.githubusercontent.com/4959135/48366425-e01a8380-e67b-11e8-8922-7e5eb9da2f79.png)

Assumptions
-----------

The following things are assumed to be true in this documentation.

* You are running OSX.
* You are using Python 2.7. (Probably the version that came OSX.)
* You have [virtualenv](https://pypi.python.org/pypi/virtualenv) and [virtualenvwrapper](https://pypi.python.org/pypi/virtualenvwrapper) installed and working.
* You have NPR's AWS credentials stored as environment variables locally.

For more details on the technology stack used with the app-template, see our [development environment blog post](http://blog.apps.npr.org/2013/06/06/how-to-setup-a-developers-environment.html).

What's in here?
---------------

The project contains the following folders and important files:

* ``data`` -- Data files, such as those used to generate HTML.
* ``fabfile`` -- [Fabric](http://docs.fabfile.org/en/latest/) commands for automating setup, deployment, data processing, etc.
* ``etc`` -- Miscellaneous scripts and metadata for project bootstrapping.
* ``less`` -- [LESS](http://lesscss.org/) files, will be compiled to CSS and concatenated for deployment.
* ``templates`` -- HTML ([Jinja2](http://jinja.pocoo.org/docs/)) templates, to be compiled locally.
* ``tests`` -- Python unit tests.
* ``www`` -- Static and compiled assets to be deployed. (a.k.a. "the output")
* ``www/assets`` -- A symlink to an S3 bucket containing binary assets (images, audio).
* ``www/live-data`` -- "Live" data deployed to S3 via cron jobs or other mechanisms. (Not deployed with the rest of the project.)
* ``www/test`` -- Javascript tests and supporting files.
* ``app.py`` -- A [Flask](http://flask.pocoo.org/) app for rendering the project locally.
* ``app_config.py`` -- Global project configuration for scripts, deployment, etc.
* ``render_utils.py`` -- Code supporting template rendering.
* ``requirements.txt`` -- Python requirements.
* ``static.py`` -- Static Flask views used in both ``app.py`` and ``public_app.py``.

Bootstrap the project
---------------------

Bootstrap the project using:

```
cd elections18-graphics
mkvirtualenv elections18-graphics --python="$(which python2)"
pip install -r requirements.txt
npm install
fab text.update
```

**Problems installing requirements?** You may need to run the pip command as ``ARCHFLAGS=-Wno-error=unused-command-line-argument-hard-error-in-future pip install -r requirements.txt`` to work around an issue with OSX.

Hide project secrets
--------------------

Project secrets should **never** be stored in ``app_config.py`` or anywhere else in the repository. They will be leaked to the client if you do. Instead, always store passwords, keys, etc. in environment variables and document that they are needed here in the README.

Any environment variable that starts with ``$PROJECT_SLUG_`` will be automatically loaded when ``app_config.get_secrets()`` is called.

Save media assets
-----------------

Large media assets (images, videos, audio) are synced with an Amazon S3 bucket specified in ``app_config.ASSETS_S3_BUCKET`` in a folder with the name of the project. (This bucket should not be the same as any of your ``app_config.PRODUCTION_S3_BUCKETS`` or ``app_config.STAGING_S3_BUCKETS``.) This allows everyone who works on the project to access these assets without storing them in the repo, giving us faster clone times and the ability to open source our work.

Syncing these assets requires running a couple different commands at the right times. When you create new assets or make changes to current assets that need to get uploaded to the server, run ```fab assets.sync```. This will do a few things:

* If there is an asset on S3 that does not exist on your local filesystem it will be downloaded.
* If there is an asset on that exists on your local filesystem but not on S3, you will be prompted to either upload (type "u") OR delete (type "d") your local copy.
* You can also upload all local files (type "la") or delete all local files (type "da"). Type "c" to cancel if you aren't sure what to do.
* If both you and the server have an asset and they are the same, it will be skipped.
* If both you and the server have an asset and they are different, you will be prompted to take either the remote version (type "r") or the local version (type "l").
* You can also take all remote versions (type "ra") or all local versions (type "la"). Type "c" to cancel if you aren't sure what to do.

Unfortunantely, there is no automatic way to know when a file has been intentionally deleted from the server or your local directory. When you want to simultaneously remove a file from the server and your local environment (i.e. it is not needed in the project any longer), run ```fab assets.rm:"www/assets/file_name_here.jpg"```

Adding a graphic
-------------------------

Run `fab add_graphic:slug`.

This will generate:

* a Jinja template at `templates/graphics/{{ slug }}.html`
* a JavaScript file at `www/js/{{ slug }}.js`
* a LESS file at `less/{{ slug }}.less`

And trigger the webpack build once to generate the necessary rendered files.

### Notes on editing the javascript and the markup

* The javascript's `h()` function is a [hyperscript function call](https://github.com/hyperhype/hyperscript).
* [Jinja template language documentation](http://jinja.pocoo.org/docs/2.10/templates/)


Elements hidden based on context
--------------------------------

Certain elements of components are hidden based on what host the graphic is loaded by (specifically, member station websites vs NPR.org). On member stations, the top-level navigation bar is hidden, to prevent users from being taken away from the member station websites. On NPR.org, the NPR footer is hidden, since it's redunant with the main NPR.org footer.


Managing Javascript Dependencies
---------------------------------

To manage JS dependencies, we use `npm`. To install a new JS library that will be used in client-side code, run `npm install --save name-of-library`. Then, in the JS file for the particular graphic you are developing, use ES6 imports to get the library in your file; for example, to import superagent and make it available as `request`:

```
import request from 'superagent';

// yr graphic

request.get(URL)
    .set('If-Modified-Since', lastRequestTime)
    .end(function(err, res) {
        // callback code
    });
```

If you need to add libraries to the build process (webpack, babel, etc.), you install the same way except you use `npm install --save-dev name-of-library`.


Run the project
---------------

A flask app is used to run the project locally. It will automatically recompile templates and assets on demand. This command also turns webpack into watch mode.

```
workon $PROJECT_SLUG
fab app
```

Visit [localhost:8000](http://localhost:8000) in your browser.

To load the project using a different port, run `fab app:$PORT_NUMBER` (for example `fab app:1111`). (You might want to do this if you're already using port 8000 locally for anther project and need to switch between them.)


### iTerm2 shortcut

If you use [iTerm2](https://www.iterm2.com/) as your terminal app, [you can use this AppleScript](https://github.com/nprapps/elections18-graphics/blob/master/etc/iterm_elections18graphics.scpt) to launch this in a two-paned terminal window. The right pane runs the webserver. The left pane lets you do your command line work. You can make an alias to launch this in your `~/.bash_profile`:

```
alias elexgfx="osascript ~/src/elections18-graphics/etc/iterm_elections18graphics.scpt"
```


COPY configuration
------------------

This app uses a Google Spreadsheet for a simple key/value store that provides an editing workflow.

To access the Google doc, you'll need to create a Google API project via the [Google developer console](http://console.developers.google.com).

Enable the Drive API for your project and create a "web application" client ID.

For the redirect URIs use:

* `http://localhost:8000/authenticate/`
* `http://127.0.0.1:8000/authenticate`
* `http://localhost:8888/authenticate/`
* `http://127.0.0.1:8888/authenticate`

For the Javascript origins use:

* `http://localhost:8000`
* `http://127.0.0.1:8000`
* `http://localhost:8888`
* `http://127.0.0.1:8888`

You'll also need to set some environment variables:

```
export GOOGLE_OAUTH_CLIENT_ID="something-something.apps.googleusercontent.com"
export GOOGLE_OAUTH_CONSUMER_SECRET="bIgLonGStringOfCharacT3rs"
export AUTHOMATIC_SALT="jAmOnYourKeyBoaRd"
```

Note that `AUTHOMATIC_SALT` can be set to any random string. It's just cryptographic salt for the authentication library we use.

Once set up, run `fab app` and visit `http://localhost:8000` in your browser. If authentication is not configured, you'll be asked to allow the application for read-only access to Google drive, the account profile, and offline access on behalf of one of your Google accounts. This should be a one-time operation across all app-template projects.

It is possible to grant access to other accounts on a per-project basis by changing `GOOGLE_OAUTH_CREDENTIALS_PATH` in `app_config.py`.


COPY editing
------------

View the [sample copy spreadsheet](https://docs.google.com/spreadsheet/pub?key=1Rs2qSw00DYECHummasktOa6zLfrifusJWh-uP-GFgvc#gid=0).

This document is specified in ``app_config`` with the variable ``COPY_GOOGLE_DOC_KEY``. To use your own spreadsheet, change this value to reflect your document's key. (The long string of random looking characters in your Google Docs URL. For example: ``1DiE0j6vcCm55Dyj_sV5OJYoNXRRhn_Pjsndba7dVljo``)

A few things to note:

* If there is a column called ``key``, there is expected to be a column called ``value`` and rows will be accessed in templates as key/value pairs
* Rows may also be accessed in templates by row index using iterators (see below)
* You may have any number of worksheets
* This document must be "published to the web" using Google Docs' interface

The app template is outfitted with a few ``fab`` utility functions that make pulling changes and updating your local data easy.

To update the latest document, simply run:

```
fab text.update
```

Note: ``text.update`` runs automatically whenever ``fab render`` is called.

At the template level, Jinja maintains a ``COPY`` object that you can use to access your values in the templates. Using our example sheet, to use the ``byline`` key in ``templates/index.html``:

```
{{ COPY.attribution.byline }}
```

More generally, you can access anything defined in your Google Doc like so:

```
{{ COPY.sheet_name.key_name }}
```

You may also access rows using iterators. In this case, the column headers of the spreadsheet become keys and the row cells values. For example:

```
{% for row in COPY.sheet_name %}
{{ row.column_one_header }}
{{ row.column_two_header }}
{% endfor %}
```

When naming keys in the COPY document, please attempt to group them by common prefixes and order them by appearance on the page. For instance:

```
title
byline
about_header
about_body
about_url
download_label
download_url
```

Open Linked Google Spreadsheet
------------------------------
Want to edit/view the app's linked google spreadsheet, we got you covered.

We have created a simple Fabric task ```spreadsheet```. It will try to find and open the app's linked google spreadsheet on your default browser.

```
fab spreadsheet
```

If you are working with other arbitraty google docs that are not involved with the COPY rig you can pass a key as a parameter to have that spreadsheet opened instead on your browser

```
fab spreadsheet:$GOOGLE_DOC_KEY
```

For example:

```
fab spreadsheet:12_F0yhsXEPN1w3GOlQB4_NKGadXiRLOa9l-HQu5jSL8
// Will open 270 project number-crunching spreadsheet
```


Generating custom font
----------------------

This project uses a custom font build powered by [Fontello](http://fontello.com)
If the font does not exist, it will be created when running `fab update`.
To force generation of the custom font, run:

```
fab utils.install_font:true
```

Editing the font is a little tricky -- you have to use the Fontello web gui.
To open the gui with your font configuration, run:

```
fab utils.open_font
```

Now edit the font, download the font pack, copy the new config.json into this
project's `fontello` directory, and run `fab utils.install_font:true` again.


Compile static assets
---------------------

Compile LESS to CSS, compile javascript templates to Javascript and minify all assets:

```
workon elections18-graphics
fab render
```

(This is done automatically whenever you deploy to S3.)

Deploy to S3
------------

```
fab staging master deploy
```

Analytics
---------

The Google Analytics events tracked in this application are:

|Category|Action|Label|Value|
|--------|------|-----|-----|
|elections18-graphics|switch-state-tab|${which view selected}-via-${element used to navigate}||
|elections18-graphics|county-sort-click|metric||
|elections18-graphics|finished-graphic|embed slug||
