/* TODO
- popular vote
- modernizr support? disable tooltips on touch devices.
- refresh counter
*/

// npm libraries
import d3 from 'd3';
import * as _ from 'underscore';
import textures from 'textures';
import request from 'superagent';
import countdown from './countdown';
import { classify, getParameterByName, buildDataURL, makeTranslate, formatStyle } from './helpers.js';

// D3 formatters
var fmtComma = d3.format(',');
var fmtYearAbbrev = d3.time.format('%y');
var fmtYearFull = d3.time.format('%Y');

// Global vars
var DATA_FILE = 'presidential-national.json';
var DEFAULT_WIDTH = 600;
var MOBILE_THRESHOLD = 480;
var LOAD_INTERVAL = 5000;
var isHP = false;
var isInitialized = false;
var isMobile = false;
var isTouch = Modernizr.touchevents;
var lastUpdated = '';
var electoralData = [];
var colorScale = null;
var countySelector = null;
var districtStates = [ { 'abbr': 'ME', 'votes': 4 },
                       { 'abbr': 'NE', 'votes': 5 } ];
var lastRequestTime = null;
var mapElement = null;
var barElement = null;
var mapWidth = null;
var mapScale = null;
var reloadData = null;
var timestamp = null;
var timestampScreenshot = null;
var lastUpdated = null;
var tooltip = null;
var tDLead = null;
var tRLead = null;
var tILead = null;
var indicator = null;

var exports = module.exports = {};

/*
* Initialize the graphic.
*/
exports.initMap = function(containerWidth) {
    // cache elements
    countySelector = d3.select('#county-selector select');
    mapElement = d3.select('.map svg');
    timestamp = d3.select('.footer .timestamp');
    timestampScreenshot = d3.select('.phantom-footer .timestamp-screenshot');
    tooltip = d3.select('#tooltip');
    indicator = document.querySelector('.update-indicator');
    if (isTouch) {
        d3.select('body').classed('touch', true);
    } else {
        d3.select('body').classed('no-touch', true);
    }

    mapWidth = containerWidth;

    if (getParameterByName('hp')) {
        isHP = true;
        d3.select('body').classed('hp', true);
    }

    // Extract categories from data
    var categories = [];
    var colorRange = [];

    _.each(LEGEND, function(key) {
        categories.push(key['label']);
        colorRange.push(eval(key['color']));
    });

    colorScale = d3.scale.ordinal()
        .domain(categories)
        .range(colorRange);

    // define textures for "leading/ahead"
    tDLead = textures.lines()
        .size(6)
        .strokeWidth(2)
        .stroke(colorScale('D-Ahead'))
        .background(COLORS['gray3']);

    tRLead = textures.lines()
        .size(6)
        .strokeWidth(2)
        .stroke(colorScale('R-Ahead'))
        .background(COLORS['gray3']);

    tILead = textures.lines()
        .size(6)
        .strokeWidth(2)
        .stroke(colorScale('I-Ahead'))
        .background(COLORS['gray3']);

    mapElement.call(tDLead);
    mapElement.call(tRLead);
    mapElement.call(tILead);

    // load data
    loadData();
    setInterval(loadData, LOAD_INTERVAL)
}


/*
 * Load data
 */
var loadData = function() {
    request.get(buildDataURL(DATA_FILE))
        .set('If-Modified-Since', lastRequestTime ? lastRequestTime : '')
        .end(function(err, res) {
            if (res.body) {
                lastRequestTime = new Date().toUTCString();
                electoralData = res.body.results;
                lastUpdated = res.body.last_updated;
                formatData();
            }
            countdown.resultsCountdown(indicator, LOAD_INTERVAL);
        })
}


/*
 * Format data for D3.
 */
var formatData = function() {
    _.each(electoralData, function(s, i) {
        s = s.sort(function(a, b){
            return d3.descending(a['votecount'], b['votecount']);
        });

        s['winner'] = null;
        s['category'] = null;
        s['category_class'] = null;
        s['has_districts'] = true;

        var districts = null;
        if (_.contains([ 'ME', 'NE' ], i)) {
            s['districts'] = [];
            districts = _.pluck(s, 'reportingunitname');
            districts = d3.set(districts).values()
                .filter(function(dist) {
                    return dist != 'null';
                });
            _.each(districts, function(dist) {
                s['districts'][dist] = [];
                s['districts'][dist]['winner'] = null;
            });

            var stateLevel = s.filter(function(c) {
                return c.level == 'state';
            });

            s['precinctsreporting'] = stateLevel[0]['precinctsreporting'];
            s['precinctsreportingpct'] = stateLevel[0]['precinctsreportingpct'];
            s['precinctstotal'] = stateLevel[0]['precinctstotal'];
            s['electtotal'] = stateLevel[0]['electtotal'];
            s['statename'] = stateLevel[0]['statename'];
        } else {
            s['precinctsreporting'] = s[0]['precinctsreporting'];
            s['precinctsreportingpct'] = s[0]['precinctsreportingpct'];
            s['precinctstotal'] = s[0]['precinctstotal'];
            s['electtotal'] = s[0]['electtotal'];
            s['statename'] = s[0]['statename'];
        };

        _.each(s, function(c) {
            if (!_.contains([ 'Dem', 'GOP' ], c['party'])) {
                c['party'] = 'Ind';
            }
            if (c['npr_winner'] && c['level'] == 'state') {
                s['winner'] = c['party'];
            }
            if (c['level'] == 'district') {
                s['districts'][c['reportingunitname']].push(c);

                if (c['npr_winner']) {
                    s['districts'][c['reportingunitname']]['winner'] = c['party'];
                }
            }
        });

        if (s['statename'] != 'National') {
            if (typeof s[0]['meta'] != 'undefined') {
                s['poll_closing'] = s[0]['meta']['full_poll_closing'] + ' ET';
            } else {
                s['poll_closing'] = null;
            }

            // define which legend category this fits with
            s['category'] = assignCategory(s);
            s['category_class'] = classify(s['category']);
            s['color'] = assignColor(s['category']);

            if (districts) {
                _.each(districts, function(dist, k) {
                    s['districts'][dist]['category'] = assignCategory(s['districts'][dist]);
                    s['districts'][dist]['color'] = assignColor(s['districts'][dist]['category']);
                });
            }
        }
    });

    // update timestamp
    timestamp.html('(as of ' + lastUpdated + ' ET)');
    timestampScreenshot.html(lastUpdated + ' ET');

    // color in the map!
    updateElectoralMap();

    // only do this once
    if (!isInitialized) {
        // position map labels
        positionMapLabels();

        // county selector dropdown
        countySelector.on('change', onCountySelected);

        // disable loading css
        d3.select('#graphic')
            .classed('loading', false);

        resetMap(mapWidth);

        isInitialized = true;
    }
}


/*
 * Assign categories
 */
var assignCategory = function(data) {
    var category = null;

    if (data['winner']) {
        switch(data['winner']) {
            case 'Dem':
                category = colorScale.domain()[0];
                break;
            case 'GOP':
                category = colorScale.domain()[1];
                break;
            case 'Ind':
                category = colorScale.domain()[2];
                break;
        }
    } else if (data[0]['votecount'] > data[1]['votecount']) {
        switch(data[0]['party']) {
            case 'Dem':
                category = colorScale.domain()[3];
                break;
            case 'GOP':
                category = colorScale.domain()[4];
                break;
            case 'Ind':
                category = colorScale.domain()[5];
                break;
        }
    } else if (data[0]['votecount'] > 0) {
        category = colorScale.domain()[6];
    } else {
        category = colorScale.domain()[7];
    }

    return category;
}


/*
 * Assign state color/pattern
 */
var assignColor = function(category) {
    switch(category) {
        case colorScale.domain()[3]:
            return tDLead.url();
            break;
        case colorScale.domain()[4]:
            return tRLead.url();
            break;
        case colorScale.domain()[5]:
            return tILead.url();
            break;
        default:
            return colorScale(category);
            break;
    }
}


/*
 * Render the graphic.
 */
exports.renderMap = function(containerWidth) {
    resetMap(containerWidth);
}

var resetMap = function(containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // adjust map measurements
    mapWidth = containerWidth;
    mapElement.attr('width', mapWidth)
        .attr('height', function() {
                var s = d3.select(this);
                var viewBox = s.attr('viewBox').split(' ');
                return Math.floor(mapWidth * viewBox[3] / viewBox[2]);
            });

    // reset map scale (relevant to tooltip positioning)
    mapScale = mapWidth / 720;

    // color in the map!
    updateElectoralMap();

    // redraw bar chart
    updateBarChart({
        container: '#bar-chart',
        width: mapWidth,
        data: electoralData['US']
    });

    // render legend
    renderLegend();

    // Update iframe
    if (window.pymChild) {
        window.pymChild.sendHeight();
    }
}


/*
 * Draw legend
 */
var renderLegend = function() {
    var containerElement = d3.select('.map');
    containerElement.select('.legend').remove();

    var legendWidth = 75;
    var legendHeight = 125;

    if (isMobile) {
        legendWidth = 300;
        legendHeight = 45;
    }

    var legendElement = containerElement.append('svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('class', 'legend');

    legendElement.call(tDLead);
    legendElement.call(tRLead);
    legendElement.call(tILead);

    var blockSize = 13;
    var blockGap = 2;
    var blockTextGap = 6;
    var col = 0;
    var row = 0;
    _.each(colorScale.domain(), function(d, i) {
        var xPos = 0;
        var yPos = ((blockSize + blockGap) * i);
        if (isMobile) {
            xPos = (legendWidth / 4) * col;
            yPos = ((blockSize + blockGap) * row);
            row++;
            if (row == 3) {
                row = 0;
                col++;
            }
        }

        var l = legendElement.append('g')
            .attr('class', classify(d))
            .attr('transform', 'translate(' + xPos + ',' + yPos + ')');
        l.append('rect')
            .attr('x', 0)
            .attr('width', blockSize)
            .attr('y', 0)
            .attr('height', blockSize)
            .attr('fill', function() {
                var f = colorScale(d)
                switch(i) {
                    case 3:
                        f = tDLead.url();
                        break;
                    case 4:
                        f = tRLead.url();
                        break;
                    case 5:
                        f = tILead.url();
                        break;
                }
                return f;
            });
        l.append('text')
            .text(d)
            .attr('x', (blockSize + blockTextGap))
            .attr('y', 0)
            .attr('dy', (blockSize / 2) + 4);
    });
};

/*
 * Draw pop vote bar chart
 */
var updateBarChart = function(config) {
    var charts = [ 0, 1, 2, 3, 4 ];
    var barChartData = [];
    _.each(charts, function(d) {
        if (config['data'][d]['npr_electwon'] > 0 || config['data'][d]['last'] == 'Clinton' || config['data'][d]['last'] == 'Trump') {
            barChartData.push({ 'last': config['data'][d]['last'], 'votecount': config['data'][d]['votecount'], 'votepct': (config['data'][d]['votepct'] * 100) });
        }
    })

    /*
     * Setup
     */
    var labelColumn = 'last';
    var valueColumn = 'votepct';

    var barHeight = 16;
    var barGap = 2;
    var labelWidth = 50;
    var labelMargin = 6;
    var valueGap = 6;

    var margins = {
        top: 0,
        right: 150,
        bottom: 0,
        left: (labelWidth + labelMargin)
    };

    if (isMobile) {
        margins['right'] = 130;
    }

    var ticksX = 4;
    var roundTicksFactor = 10;

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = ((barHeight + barGap) * barChartData.length);

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    containerElement.append('h3')
        .text('National Popular Vote');

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom'])
        .append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    /*
     * Create D3 scale objects.
     */
    var min = d3.min(barChartData, function(d) {
        return Math.floor(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
    });

    if (min > 0) {
        min = 0;
    }

    var max = d3.max(barChartData, function(d) {
        return Math.ceil(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
    })

    var xScale = d3.scale.linear()
        .domain([min, max])
        .range([0, chartWidth]);

    /*
     * Create D3 axes.
     */
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d.toFixed(0) + '%';
        });

    /*
     * Render axes to chart.
     */
    // chartElement.append('g')
    //     .attr('class', 'x axis')
    //     .attr('transform', makeTranslate(0, chartHeight))
    //     .call(xAxis);

    /*
     * Render grid to chart.
     */
    var xAxisGrid = function() {
        return xAxis;
    };

    // chartElement.append('g')
    //     .attr('class', 'x grid')
    //     .attr('transform', makeTranslate(0, chartHeight))
    //     .call(xAxisGrid()
    //         .tickSize(-chartHeight, 0, 0)
    //         .tickFormat('')
    //     );

    /*
     * Render bars to chart.
     */
    chartElement.append('g')
        .attr('class', 'bars')
        .selectAll('rect')
        .data(barChartData)
        .enter()
        .append('rect')
            .attr('x', function(d) {
                if (d[valueColumn] >= 0) {
                    return xScale(0);
                }

                return xScale(d[valueColumn]);
            })
            .attr('width', function(d) {
                return Math.abs(xScale(0) - xScale(d[valueColumn]));
            })
            .attr('y', function(d, i) {
                return i * (barHeight + barGap);
            })
            .attr('height', barHeight)
            .attr('class', function(d, i) {
                return 'bar-' + i + ' ' + classify(d[labelColumn]);
            });

    /*
     * Render 0-line.
     */
    if (min < 0) {
        chartElement.append('line')
            .attr('class', 'zero-line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', chartHeight);
    }

    /*
     * Render bar labels.
     */
    chartWrapper.append('ul')
        .attr('class', 'labels')
        .attr('style', formatStyle({
            'width': labelWidth + 'px',
            'top': margins['top'] + 'px',
            'left': '0'
        }))
        .selectAll('li')
        .data(barChartData)
        .enter()
        .append('li')
            .attr('style', function(d, i) {
                return formatStyle({
                    'width': labelWidth + 'px',
                    'height': barHeight + 'px',
                    'left': '0px',
                    'top': (i * (barHeight + barGap)) + 'px;'
                });
            })
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .append('span')
                .text(function(d) {
                    return d[labelColumn];
                });

    /*
     * Render bar values.
     */
    chartElement.append('g')
        .attr('class', 'value')
        .selectAll('text')
        .data(barChartData)
        .enter()
        .append('text')
            .text(function(d) {
                return d[valueColumn].toFixed(1) + '% (' + fmtComma(d['votecount']) + ' votes)';
            })
            .attr('x', function(d) {
                return xScale(d[valueColumn]);
            })
            .attr('y', function(d, i) {
                return i * (barHeight + barGap);
            })
            .attr('dx', function(d) {
                var xStart = xScale(d[valueColumn]);
                var textWidth = this.getComputedTextLength()
                d3.select(this).classed('out', true)
                return valueGap;
            })
            .attr('dy', (barHeight / 2) + 3)
}


/*
 * Update the electoral map
 */
var updateElectoralMap = function() {
    _.each(electoralData, function(d,i) {
        var st = i;
        if (st != 'US') {
            var stBox = mapElement.select('.' + classify(st));

            if (electoralData[st]['districts']) {
                var distData = electoralData[st]['districts'];
                switch(st) {
                    case 'ME':
                        stBox.select('.me-1 rect')
                            .attr('fill', distData['District 1']['color']);
                        stBox.select('.me-2 rect')
                            .attr('fill', distData['District 2']['color']);
                        stBox.select('.me-3 rect')
                            .attr('fill', distData['At Large']['color']);
                        stBox.select('.me-4 rect')
                            .attr('fill', distData['At Large']['color']);
                        break;
                    case 'NE':
                        stBox.select('.ne-2 rect')
                            .attr('fill', distData['District 1']['color']);
                        stBox.select('.ne-3 rect')
                            .attr('fill', distData['District 2']['color']);
                        stBox.select('.ne-5 rect')
                            .attr('fill', distData['District 3']['color']);
                        stBox.select('.ne-1 rect')
                            .attr('fill', distData['At Large']['color']);
                        stBox.select('.ne-4 rect')
                            .attr('fill', distData['At Large']['color']);
                        break;
                }
            } else {
                if (_.contains([ 'D-Ahead', 'I-Ahead', 'R-Ahead' ], electoralData[st]['category'])) {
                    stBox.classed('ahead', true);
                } else {
                    stBox.classed('ahead', false);
                }
                stBox.select('rect')
                    .attr('fill', electoralData[st]['color']);
            }

            // tooltips
            if (!isTouch) {
                stBox.on('mouseover', onStateMouseover);
                stBox.on('mouseout', onStateMouseout);
                stBox.on('click', onStateClick);
            } else {
                stBox.on('mouseover', undefined);
                stBox.on('mouseout', undefined);
                stBox.attr('xlink:href', null);
            }

            // show electoral votes on desktop; hide on small screens
            var stLabel = stBox.selectAll('text.state-abbr');
            if (stLabel[0][0] != null && st != 'ME' && st != 'NE') {
                if (!isMobile) {
                    stLabel.attr('dy', -5);
                    stBox.selectAll('.votes')
                        .classed('active', true);
                } else {
                    stLabel.attr('dy', 0);
                    stBox.selectAll('.votes')
                        .classed('active', false);
                }
            }
        }
    });

    _.each(districtStates, function(d,i) {
        var stBox = mapElement.select('.' + classify(d['abbr']));
        var stLabel = stBox.select('text');
        if (!isMobile) {
            stLabel.text(d['abbr'] + ' (' + d['votes'] + ')');
        } else {
            stLabel.text(d['abbr']);
        }
    });
}


/*
 * Tooltips / mouseovers
 */
var onStateMouseover = function() {
    // d3.event.preventDefault();
    var t = d3.select(this);
    var coords = d3.mouse(this);
    var st = t[0][0].getAttribute('class').split(' ')[0].toUpperCase();
    var stateData = electoralData[st];
    var ttWidth = 150;

    // define tooltip text
    var ttText = '';
    ttText += '<h3>' + stateData['statename'] + ' <span>(' + stateData['electtotal'] + ')</span></h3>';
    if (stateData['category'] == colorScale.domain()[7]) {
        if (stateData['poll_closing']) {
            ttText += '<p class="poll-closing">Polls close at ' + stateData['poll_closing'] + '</p>';
        } else {
            ttText += '<p class="poll-closing">No data available.</p>';
        }
    } else {
        ttText += '<table>';
        _.each(electoralData[st], function(c, k) {
            if (c['level'] == 'state') {
                ttText += '<tr>';
                ttText += '<td><b class="' + classify(c['party']) +  '"></b>' + c['last'];
                if (c['npr_winner']) {
                    ttText += '<i class="icon icon-ok"></i>';
                }
                ttText += '</td>';
                // ttText += '<td class="amt">' + fmtComma(c['votecount']) + '</td>';
                ttText += '<td class="amt">' + (c['votepct'] * 100).toFixed(1) + '%</td>';
                ttText += '</tr>';
            }
        });
        ttText += '</table>';
        ttText += '<p class="precincts">' + formatPrecinctsReporting(stateData['precinctsreportingpct'], stateData['precinctsreporting'], stateData['precinctstotal']) + '% reporting</p>';
    }

    // position the tooltip
    tooltip.html(ttText)
        .attr('style', function() {
            var leftPos = (coords[0] * mapScale) + 5;
            if (leftPos + ttWidth > mapWidth) {
                leftPos = leftPos - ttWidth;
            }
            var topPos = ((coords[1] * mapScale) + 5)

            if (document.querySelector('.headlines')) {
                var headlinesHeight = document.querySelector('.headlines').offsetHeight;
                topPos += headlinesHeight;
            }

            var s = '';
            s += 'left: ' + leftPos + 'px; ';
            s += 'top: ' + topPos + 'px;';
            return s;
        })
        .classed('active', true);

    // highlight the active state box
    t.classed('active', true);
}

var formatPrecinctsReporting = function(pct, reporting, total) {
    var pctFormatted = (pct * 100).toFixed(1);
    if (pctFormatted == 0 && reporting > 0) {
        return '<0.1';
    } else if (pctFormatted == 100 && reporting < total) {
        return '>99.9';
    } else if (pctFormatted == 100 && reporting == total) {
        return 100;
    } else {
        return pctFormatted;
    }
}

var onStateMouseout = function() {
    // d3.event.preventDefault();
    var t = d3.select(this);
    t.classed('active', false);
    tooltip.classed('active', false);
}

var onStateClick = function() {
    const domain = parseParentURL();
    var t = d3.select(this);
    var st = t[0][0].getAttribute('class').split(' ')[0].toUpperCase();
    var url = COUNTY_DATA[st]['url'];

    if (pymChild && (domain == 'npr.org' || domain == 'localhost')) {
        pymChild.sendMessage('pjax-navigate', url);
    } else {
        window.open(url, '_top');
    }
}


/*
 * Position map labels
 */
var positionMapLabels = function() {
    _.each(electoralData, function(d,i) {
        var stBox = mapElement.select('.' + classify(i));
        var stRect = stBox.select('rect');
        var stLabel = stBox.select('text');

        if (stLabel[0][0] != null && i != 'ME' && i != 'NE') {
            if (d['electtotal'] < 6) {
                stLabel.classed('small', true);
            }

            stLabel.attr('x', function() {
                    var boxX = Number(stRect.attr('x'));
                    var boxWidth = Number(stRect.attr('width'));

                    return (boxX + (boxWidth / 2));
                })
                .attr('y', function() {
                    var boxY = Number(stRect.attr('y'));
                    var boxHeight = Number(stRect.attr('height'));
                    var labelBbox = stLabel[0][0].getBBox();

                    return (boxY + (boxHeight / 2) + (labelBbox.height / 3));
                })
                .classed('state-abbr', true);

            // add # of electoral votes (and text shadow)
            _.each([ 'votes shadow', 'votes' ], function(cls) {
                stBox.append('text')
                    .attr('class', cls)
                    .text(d['electtotal'])
                    .attr('x', stLabel.attr('x'))
                    .attr('y', Number(stLabel.attr('y')) + 5);
            });

            // add state label text shadow
            stBox.append('text')
                .attr('class', stLabel.attr('class') + ' shadow')
                .text(stLabel.text())
                .attr('x', stLabel.attr('x'))
                .attr('y', stLabel.attr('y'))
                .attr('dy', stLabel.attr('dy'));

            stLabel.moveToFront();
        }
    });

    // address the states w/ districts
    _.each(districtStates, function(d,i) {
        var stBox = mapElement.select('.' + classify(d['abbr']));
        stBox.select('.votes').remove();
        var stLabel = stBox.select('text')
            .classed('small', true);
    });
}


/*
 * county selector dropdown
 */
var onCountySelected = function() {
    const domain = parseParentURL();
    var url = d3.select(this).property('value');
    if (pymChild && (domain == 'npr.org' || domain == 'localhost')) {
        pymChild.sendMessage('pjax-navigate', url);
    } else {
        window.open(url, '_top');
    }
}


// helper functions
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};

var parseParentURL = function() {
    if (!pymChild) {
        return null;
    }
    const parentUrl = new URL(window.pymChild.parentUrl, location, true);
    if (parentUrl.hostname == '127.0.0.1') {
        return 'localhost';
    } else {
        return parentUrl.hostname.split('.').slice(-2).join('.');
    }
}
