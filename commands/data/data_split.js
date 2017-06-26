 'use strict';

// Node
const path = require('path');

// Local
const messages = require(path.join(__dirname, '..', '..', 'lib', 'messages'))();
const Data = require(path.join(__dirname, '..', '..', 'lib', 'data', 'dataApi.js')); // eslint-disable-line global-require
const utils = require(path.join(__dirname, '..', '..', 'lib', 'utils.js'));
const logger = utils.logger;

(function () {
    'use strict';

    module.exports = {
        command: 'split',
        topic: 'data',
        description: messages.getMessage('description', [], 'data_split'),
        longDescription: messages.getMessage('longDescription', [], 'data_split'),
        help: messages.getMessage('help', [], 'data_split'),
        requiresWorkspace: false,
        flags: [
            {
                name: "dataplan",
                char: "f",
                description: "The data plan that needs to be broken up",
                hasValue: true,
                required: true
            }
        ],
        // TODO - put all possible attributes in here behind comments

        run (context) {
            const data = new Data();
            //return utils.executeCommand(data.split, context);

            return utils.executeCommand({
                execute: execContext =>
                    data.split(execContext)
                    .then(() => {
                        logger.styledHeader(logger.color.blue('Files Split'));
                        return true;
                    }),
                getHumanErrorMessage: () => '',
                getHumanSuccessMessage: () => ''
            }, context);
        }

        

    };
}());
