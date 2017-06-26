'use strict'

const path = require('path');
const datasplit = require('./commands/data/data_split.js');
const dataTopic = require('./commands/data/data.js');

(function () {
  'use strict';

  exports.topics = [dataTopic()];

  exports.namespace = {
    name: 'djc',
    description: 'data commands the djc namespace'
  };

  exports.commands = [datasplit];

}());