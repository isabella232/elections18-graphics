// npm libraries
import { h, createProjector } from 'maquette';
import request from 'superagent';
import { buildDataURL } from './helpers.js';

// global vars
let dataURL = null;
let bopDataURL = null;
let lastRequestTime = null;
let lastBopRequestTime = null;
let boardTitle = null;
let resultsData = null;
let bopData = null;
let lastUpdated = null;

const boardWrapper = document.querySelector('.board')
const FIRST_COLUMN_KEYS = ['6:00 PM', '7:00 PM', '7:30 PM', '8:00 PM']
const SECOND_COLUMN_KEYS = ['8:30 PM', '9:00 PM', '10:00 PM', '11:00 PM', '1:00 AM']
const projector = createProjector();
const coloredParties = ['Dem', 'GOP', 'Yes', 'No'];

var exports = module.exports = {};
/*
* Initialize the graphic.
*/
exports.initBigBoard = function(filename, boardName, boardClass) {
    boardTitle = boardName;
    boardWrapper.classList.add(boardClass);

    bopDataURL = buildDataURL('top-level-results.json')
    dataURL = buildDataURL(filename);
    projector.append(boardWrapper, renderMaquette);
    getInitialData();

    setInterval(getBopData, 5000);
    setInterval(getData, 5000);
}

const getInitialData = function() {
    request.get(bopDataURL)
        .set('If-Modified-Since', '')
        .end(function(err, res) {
            if (res.body) {
                bopData = res.body;
                lastBopRequestTime = new Date().toUTCString();
            } else {
                console.warn(err);
            }
            request.get(dataURL)
                .set('If-Modified-Since', '')
                .end(function(err, res) {
                    if (res.body) {
                        lastRequestTime = new Date().toUTCString();
                        resultsData = sortData(res.body.results)
                        lastUpdated = res.body.last_updated
                        projector.scheduleRender();
                    } else {
                        console.warn(err);
                    }
                });
        });
}

const getData = function() {
    request.get(dataURL)
        .set('If-Modified-Since', lastRequestTime ? lastRequestTime : '')
        .end(function(err, res) {
            if (res.body) {
                lastRequestTime = new Date().toUTCString();
                resultsData = sortData(res.body.results)
                lastUpdated = res.body.last_updated
                projector.scheduleRender();
            }
        });
}

const getBopData = function() {
    request.get(bopDataURL)
        .set('If-Modified-Since', lastBopRequestTime ? lastBopRequestTime : '')
        .end(function(err, res) {
            if (res.body) {
                lastBopRequestTime = new Date().toUTCString();
                bopData = res.body;
                projector.scheduleRender();
            }
        });
}

const sortData = function(resultsData) {
    // sort each race
    for (var time in resultsData) {
        for (var race in resultsData[time]) {
            resultsData[time][race].sort(function(a, b) {
                if (a.npr_winner) return -1;
                if (b.npr_winner) return 1;
                return b.votecount - a.votecount;
            })
        }
    }

    return resultsData
}

const renderMaquette = function() {
    if (!resultsData) {
        return h('div.results-wrapper', 'Loading...')
    }

    let numberOfRaces = 0;

    let times = [];
    for (let time in resultsData) {
        times.push(time);
        const group = resultsData[time];
        numberOfRaces += Object.keys(group).length;
    }

    const sortedTimes = times.sort(function(a, b) {
        var aHour = parseInt(a.split(':')[0]);
        var bHour = parseInt(b.split(':')[0]);

        if (a.slice(-4) === 'a.m.') return 1;
        if (b.slice(-4) === 'a.m.') return -1;
        if (aHour === bHour && a.indexOf('30') !== -1) return 1;
        if (aHour === bHour && b.indexOf('30') !== -1) return -1;
        else return aHour - bHour;
    });

    let sortedRacesPerTime = {};

    for (let time in resultsData) {
        let sortedRaces = Object.keys(resultsData[time]).sort(function(a,b) {
            const aResult = resultsData[time][a][0];
            const bResult = resultsData[time][b][0];
            const as = determineSortKey(aResult);
            const bs = determineSortKey(bResult);

            const aState = as.substring(0,2);
            const bState = bs.substring(0,2);

            // if we pulled a number off something
            if (aState === bState && as.length > 2 && bs.length > 2) {
                const aID = as.split('-')[1];
                const bID = bs.split('-')[1];
                if (parseInt(aID) && parseInt(bID)) {
                    if (parseInt(aID) < parseInt(bID)) {
                        return -1;
                    }
                    if (parseInt(aID) > parseInt(bID)) {
                        return 1;
                    }
                }
            }

            if (as < bs) return -1;
            if (as > bs) return 1;
            return 0;
        });

        sortedRacesPerTime[time] = sortedRaces;
    }

    const breakingIndex = Math.ceil(numberOfRaces / 2)
    let raceIndex = 0;
    let firstColumn = {};
    let secondColumn = {};
    let selectedColumn = firstColumn

    sortedTimes.forEach(function(time) {
        const group = resultsData[time];
        sortedRacesPerTime[time].map(function(id) {
            raceIndex += 1

            if (!selectedColumn[time]) {
                selectedColumn[time] = [];
            }
            selectedColumn[time].push(group[id])

            if (raceIndex === breakingIndex) {
                selectedColumn = secondColumn
            }
        });
    });

    let duplicates = diffArrays(Object.keys(firstColumn), Object.keys(secondColumn));

    setTimeout(pymChild.sendHeight, 0);

    return h('div.results-wrapper', [
        h('div.results-header', [
            h('h1', boardTitle),
            bopData ? renderLeaderboard() : ''
        ]),
        h('div.results', {
            classes: {
                'dupe-second-column-header': duplicates.length > 0
            }
        }, [
            renderResultsColumn(firstColumn, 'first'),
            renderResultsColumn(secondColumn, 'last')
        ]),
        h('div.footer', [
          h('p', ['Source: AP ', h('span', [
              '(as of ',
              lastUpdated,
              ' ET)'
          ])
        ])
      ])
    ]);
}

const renderLeaderboard = function() {
    if (boardTitle.indexOf('House') !== -1) {
        var bop = bopData['house_bop'];
        return renderCongressBOP(bop);
    } else if (boardTitle.indexOf('Senate') !== -1) {
        var bop = bopData['senate_bop'];
        return renderCongressBOP(bop);
    }
    else {
        return h('div.leaderboard', '');
    }
}

const renderCongressBOP = function(bop) {
    const demSeats = bop['Dem']['seats'];
    const gopSeats = bop['GOP']['seats'];
    const indSeats = bop['Other']['seats'];

    const demPickups = bop['Dem']['pickups'];
    const gopPickups = bop['GOP']['pickups'];
    const indPickups = bop['Other']['pickups'];

    const demExpected = demSeats + bop['Dem']['expected'];
    const gopExpected = gopSeats + bop['GOP']['expected'];
    const indExpected = indSeats + bop['Other']['expected'];

    const demNeed = bop['Dem']['needed'];
    const gopNeed = bop['GOP']['needed'];

    const uncalledRaces = bop['uncalled_races']

    return h('div.leaderboard', [
        h('div.results-header-group.dem', [
            h('h2.party', [ 'Dem.: ' + demSeats ]),
            h('p.detail', [
                'Net gains: ',
                h('span.change.party', demPickups > 0 ? '+' + demPickups : demPickups),
                h('br'),
                'Need: ',
                h('span.needed.party', demNeed)
            ])
        ]),
        h('div.results-header-group.gop', [
            h('h2.party', 'GOP: ' + gopSeats),
            h('p.detail', [
                'Net gains: ',
                h('span.change.party', gopPickups > 0 ? '+' + gopPickups : gopPickups),
                h('br'),
                'Need: ',
                h('span.needed.party', gopNeed)
            ])
        ]),
        h('div.results-header-group.other', [
            h('h2.party', 'Ind.: ' + indSeats),
            h('p.detail', [
                'Net gains: ',
                h('span.change.party', indPickups > 0 ? '+' + indPickups : indPickups)
            ]),
        ]),
        h('div.results-header-group.not-called', [
            h('h2.party', [
                'Not Yet',
                h('br'),
                'Called: ' + uncalledRaces
            ])
        ])
    ]);
}

const renderResultsColumn = function(column, orderClass) {
    const className = 'column ' + orderClass;
    if (resultsData) {
        return h('div', {
            key: orderClass,
            class: className
        }, [
            Object.keys(column).map(key => renderResultsTable(key, column))
        ])
    } else {
        return h('div', {
            key: 'init'
        });
    }
}

const renderResultsTable = function(key, column) {
    if (column.hasOwnProperty(key)) {
        var races = column[key];
    }

    if (races) {
        return [
            h('h2.poll-closing-group', h('span.time', key + ' ET')),
            h('table.races', [
                races.map(race => renderRace(race))
            ])
        ]
    } else {
        return '';
    }
}

const renderRace = function(race) {
    const results = determineResults(race);
    const result1 = results[0];
    const result2 = results[1];

    if (result1['npr_winner']) {
        var winningResult = result1;
    } else if (result2['npr_winner']) {
        var winningResult = result2;
    }

    if (winningResult) {
        var called = true;
    }

    if (winningResult && result1['meta']['current_party'] && winningResult['party'] !== result1['meta']['current_party']) {
        var change = true
    }

    if ((result1['votecount'] > 0 || result2['votecount'] > 0) || called)  {
        var reporting = true;
    }

    return h('tr', {
        key: result1['last'],
        classes: {
            'called': called,
            'party-change': change,
            'reporting': reporting
        }
    }, [
        h('td.pickup', {
            classes: {
                'winner': winningResult,
                'dem': winningResult && winningResult['party'] === 'Dem',
                'gop': winningResult && winningResult['party'] === 'GOP',
                'ind': winningResult && winningResult['party'] === 'Ind'
            }
        }, [
            insertRunoffImage(race)
        ]),
        h('td.state', {
            classes: {
                'winner': winningResult,
                'dem': winningResult && winningResult['party'] === 'Dem',
                'gop': winningResult && winningResult['party'] === 'GOP',
                'ind': winningResult && coloredParties.indexOf(winningResult['party']) < 0
            }
        }, [
            decideLabel(result1)
        ]),
        h('td.results-status', [
            calculatePrecinctsReporting(result1['precinctsreportingpct'])
        ]),
        h('td.candidate', {
            classes: {
                'winner': result1['npr_winner'],
                'dem': result1['party'] === 'Dem',
                'gop': result1['party'] === 'GOP',
                'yes': result1['party'] === 'Yes',
                'no': result1['party'] === 'No',
                'other': coloredParties.indexOf(result1['party']) < 0,
                'incumbent': result1['incumbent']
            }
        }, [
            h('span.fname', [
                result1['first'] ? result1['first'] + ' ' : ''
            ]),
            h('span.lname', [
                result1['last'],
                insertIncumbentIcon(result1['incumbent'])
            ])
        ]),
        h('td.candidate-total', {
            classes: {
                'winner': result1['npr_winner'],
                'dem': result1['party'] === 'Dem',
                'gop': result1['party'] === 'GOP',
                'yes': result1['party'] === 'Yes',
                'no': result1['party'] === 'No',
                'other': coloredParties.indexOf(result1['party']) < 0
            }
        }, [
            h('span.candidate-total-wrapper', {
                updateAnimation: onUpdateAnimation
            }, [
                Math.round(result1['votepct'] * 100)
            ])
        ]),
        h('td.candidate-total-spacer'),
        h('td.candidate-total', {
            classes: {
                'winner': result2['npr_winner'],
                'dem': result2['party'] === 'Dem',
                'gop': result2['party'] === 'GOP',
                'yes': result2['party'] === 'Yes',
                'no': result2['party'] === 'No',
                'other': coloredParties.indexOf(result2['party']) < 0
            }
        }, [
            h('span.candidate-total-wrapper', {
                updateAnimation: onUpdateAnimation
            }, [
                result2 ? Math.round(result2['votepct'] * 100) : 0
            ])
        ]),
        h('td.candidate', {
            classes: {
                'winner': result2['npr_winner'],
                'dem': result2['party'] === 'Dem',
                'gop': result2['party'] === 'GOP',
                'yes': result2['party'] === 'Yes',
                'no': result2['party'] === 'No',
                'other': coloredParties.indexOf(result2['party']) < 0,
                'incumbent': result2['incumbent']
            }
        }, [
            h('span.fname', [
                result2 ? result2['first'] : ''
            ]),
            ' ',
            h('span.lname', [
                result2 ? result2['last'] : '',
                insertIncumbentIcon(result2['incumbent'])
            ])
        ])
    ])
}

const determineResults = function(race) {
    let result1;
    let result2;
    if (race[0]['precinctsreportingpct'] <= 0) {
        var loopArr = race;
    } else {
        var loopArr = [race[0], race[1]];
    }

    for (var i = 0; i < loopArr.length ; i++) {
        var result = loopArr[i];
        if ((result['party'] === 'Dem' || result['party'] === 'Yes') && !result1) {
            result1 = result;
        } else if (result['party'] === 'GOP' || result['party'] === 'No' && !result2) {
            result2 = result;
        }

        if (result1 && result2) {
            break;
        }
    }

    // handle the case where there are two GOP results to show
    if (!result1 && race[0] !== result2) {
        result1 = race[0]
    } else if (!result1 && race[0] !== result1) {
        result1 = race[1]
    }

    if (!result2) {
        result2 = race[1];
    }

    // if we have the same party, ensure we order by votepct
    if (result1['party'] === result2['party']) {
        var sortedResults = [result1, result2].sort(function(a, b) {
            return b['votepct'] - a['votepct'];
        })
    } else {
        var sortedResults = [result1, result2];
    }

    return sortedResults;
}

const calculatePrecinctsReporting = function(pct) {
    if (0 < pct && pct < 0.005) {
        return '<1'
    } else if (0.995 < pct && pct < 1) {
        return '>99';
    } else {
        return Math.round(pct * 100);
    }
}

const decideLabel = function(race) {
    if (race['officename'] == 'U.S. House') {
        return race['statepostal'] + '-' + race['seatnum'];
    } else if (race['is_ballot_measure'] === true) {
        return race['statepostal'] + '-' + race['seatname'];
    } else {
        return race['statepostal'];
    }
}

const insertRunoffImage = function(race) {
    let runoff = false;
    race.forEach(function(result) {
        if (result['runoff'] === true) {
            runoff = true;
        }
    });

    if (runoff) {
        return h('img.img-responsive', {
            src: '../assets/runoff.svg'
        })
    } else {
        return ''
    }
}

const insertIncumbentIcon = function(incumbency) {
    if (incumbency) {
        return h('i.icon-incumbent', { })
        // return h('img.img-responsive', {
        //     src: '../assets/incumbent.svg'
        // })
    } else {
        return ''
    }
}

const findGOPResult = function(result) {
    return result.party === 'GOP';
}

const findDemResult = function(result) {
    return result.party === 'Dem';
}

const onUpdateAnimation = function(domNode, properties, previousProperties) {
    const parent = domNode.parentNode;

    // add class to the parent row
    const parentRow = domNode.parentNode.parentNode;
    parentRow.classList.add('updated');

    let party = '';
    if (parent.classList.contains('dem')) {
        party = 'dem';
    } else if (parent.classList.contains('gop')) {
        party = 'gop';
    } else if (parent.classList.contains('yes')) {
        party = 'yes';
    } else if (parent.classList.contains('no')) {
        party = 'no';
    }
    const sibling = domNode.parentNode.parentNode.querySelector('.candidate.' + party)

    // add class to the affected cells
    parent.classList.add('lighten');
    sibling.classList.add('lighten');

    setTimeout(function() {
        parentRow.classList.remove('updated');
        parent.classList.remove('lighten');
        sibling.classList.remove('lighten');
    }, 2000);
}

const determineSortKey = function(result) {
    if (result.officename === 'U.S. Senate') {
        return result.statepostal;
    } else if (result.officename === 'Governor') {
        return result.statepostal;
    } else if (result.officename === 'U.S. House') {
        return result.statepostal + '-' + result.seatnum;
    } else if (result.is_ballot_measure) {
        return result.statepostal + '-' + result.seatname.split(' - ')[0];
    }
}

const diffArrays = function(arr1, arr2) {
    var ret = [];
    for(var i in arr1) {
        if(arr2.indexOf( arr1[i] ) > -1){
            ret.push( arr1[i] );
        }
    }
    return ret;
};
