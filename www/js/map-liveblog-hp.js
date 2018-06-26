// npm libraries
import electoral from '../js/includes/electoral-totals.js';
import map from '../js/includes/map.js'
import { h, createProjector } from 'maquette';
import request from 'superagent';
import timeago from 'timeago.js';

// global vars
window.pymChild = null;
var isMapInit = false;
var isElectoralInit = false;
var headlineURL = null;
var headlines = null;
var projector = createProjector();
var liveblog = document.querySelector('#liveblog');
var lastRequestTime = null;

/*
* Initialize the graphic.
*/
var onWindowLoaded = function() {
    // init pym and render callback
    window.pymChild = new pym.Child({
        renderCallback: render
    });

    headlineURL = buildHeadlineURL('headline.json');
    projector.append(liveblog, renderMaquette);
    addLiveblogListener();
    getData();
    setInterval(getData, 5000);
}

const addLiveblogListener = function() {
    const domain = parseParentURL();
    liveblog.addEventListener('click', function(e) {
        if(e.target && e.target.nodeName == "A") {
            if (window.pymChild && (domain == 'npr.org' || domain == 'localhost')) {
                pymChild.sendMessage('pjax-navigate', e.target.href);
                e.preventDefault();
                e.stopPropagation();
            } else {
                window.open(e.target.href, '_top');
            }
        }
    });
}


var getData = function() {
    request.get(headlineURL)
        .set('If-Modified-Since', lastRequestTime ? lastRequestTime : '')
        .end(function(err, res) {
            if (res.body) {
                lastRequestTime = new Date().toUTCString();
                headlines = res.body.posts;
            }
            projector.scheduleRender();
            setTimeout(pymChild.sendHeight, 0);
        });
}

var buildHeadlineURL = function(filename) {
    if (document.location.hostname === '127.0.0.1' ||
        document.location.hostname === 'localhost' ||
        document.location.hostname === '0.0.0.0') {
        return document.location.protocol + '//' + document.location.hostname + ':' + document.location.port + '/data/extra_data/' + filename;
    } else {
        return document.location.protocol + '//' + document.location.hostname + '/elections18-liveblog/' + filename;
    }
}

var renderMaquette = function() {
    if (headlines) {
        return h('div.headlines', [
            h('h3', 'Latest From Our Election Live Blog'),
            h('div.list', [
                headlines.map(post => renderHeadline(post))
            ])
        ])
    } else {
        return h('div.headlines')
    }
}

var renderHeadline = function(post) {
    var timeAgo = new timeago().format(post.timestamp)

    return h('h4.headline', {
        key: post.url
    }, [
        h('span.timestamp', timeAgo),
        h('a', {
            href: post.url
        }, post.headline),
        ' ',
    ])
}

/*
 * Render
 */
var render = function(containerWidth) {
    // only run the first time
    if (!isMapInit) {
        map.initMap(containerWidth);
        isMapInit= true;
    // run onresize
    } else {
        map.renderMap(containerWidth);
    }

    if (!isElectoralInit) {
        electoral.initElectoralTotals()
        isElectoralInit = true;
    }
}

var parseParentURL = function() {
    if (!window.pymChild) {
        return null;
    }
    const parentUrl = new URL(window.pymChild.parentUrl, location, true);
    if (parentUrl.hostname == '127.0.0.1') {
        return 'localhost';
    } else {
        return parentUrl.hostname.split('.').slice(-2).join('.');
    }
}


/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
