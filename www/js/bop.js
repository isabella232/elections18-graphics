// Babel 7's `"useBuiltIns: "usage"` will automatically insert polyfills
// https://babeljs.io/docs/en/next/babel-preset-env#usebuiltins

// npm libraries
import { initBop, renderBop } from '../js/includes/bop.js';

// global vars
window.pymChild = null;
var isBopInit = false;

/*
* Initialize the graphic.
*/
var onWindowLoaded = function () {
  // init pym and render callback
  window.pymChild = new pym.Child({
    renderCallback: render
  });

  // pymChild.onMessage('on-screen', function(bucket) {
  //     ANALYTICS.trackEvent('on-screen', bucket);
  // });
  // pymChild.onMessage('scroll-depth', function(data) {
  //     data = JSON.parse(data);
  //     ANALYTICS.trackEvent('scroll-depth', data.percent, data.seconds);
  // });
};

/*
 * Render
 */
var render = function (containerWidth) {
  // only run the first time
  if (!isBopInit) {
    initBop(containerWidth);
    isBopInit = true;
  // run onresize
  } else {
    renderBop(containerWidth);
  }
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
