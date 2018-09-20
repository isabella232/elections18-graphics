import URL from 'url-parse';

import { isLocalhost } from './helpers.js';

const parseParentURL = function () {
  if (!pymChild) {
    return null;
  }
  const parentUrl = new URL(window.pymChild.parentUrl, document.location, true);
  if (isLocalhost(parentUrl.hostname)) {
    return 'localhost';
  } else {
    return parentUrl.hostname.split('.').slice(-2).join('.');
  }
};

const updateMenuParent = function (e) {
  // Update iframe
  if (pymChild) {
    setTimeout(pymChild.sendHeight, 0);
  }
};

const followNavLink = function (e) {
  const domain = parseParentURL();
  if (
    e.target.tagName === 'A' &&
    e.target !== e.currentTarget &&
    pymChild &&
    (domain === 'npr.org' || domain === 'localhost')
  ) {
    pymChild.sendMessage('pjax-navigate', e.target.href);
    e.preventDefault();
    e.stopPropagation();
  }
};

const setNavBarHandlers = () => {
  var resultsMenuButton = document.querySelector('.small-screen-nav-label');
  var resultsMenu = document.querySelector('.menu');
  resultsMenuButton.addEventListener('click', updateMenuParent);
  resultsMenu.addEventListener('click', followNavLink);

  var stateMenuButton = document.querySelector('.state-nav-label');
  var stateMenu = document.querySelector('.state-nav');
  stateMenu.addEventListener('click', followNavLink);
  stateMenuButton.addEventListener('click', updateMenuParent);
};

// Set the handlers when this module is imported for its side-effects
setNavBarHandlers();
export {
  parseParentURL
};
