'use strict';

const path = require('path');

const messages = require(path.join(__dirname, '..', '..', 'lib', 'messages'))();

module.exports = function () {
    return {
        name: 'data',
        description: messages.getMessage('mainTopicDescriptionHelp', [], 'data'),
        longDescription:  messages.getMessage('mainTopicLongDescriptionHelp', [], 'data')
    };
};