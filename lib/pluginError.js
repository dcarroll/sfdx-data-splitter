const path = require('path');

const _ = require('lodash');

const messages = require(path.join(__dirname, 'messages'))();

// Hash of error keys to error names
const PluginErrors = {
    dataSplitFileNotFound: 'InvalidDataImport',
    sourcePushFailed : 'DeployFailed'
};

/*
 *  Error generator for all ALM errors.
 *  @param key {String} - The error message key.  Used to get the error message text via messages.getMessage()
 *                        and the error name from ALMErrors.
 *  @param tokens {String|Array} - The tokens for the error message.
 *  @returns {Error} - The appropriate Error based on provided key and tokens.
 */
const PluginError = (errorKey, errorTokens, actionKey, actionTokens) => {

    const error = new Error();

    const _updateError = function(key, tokens, attribute) {
        if (_.isString(key)) {
            error[attribute] = messages.getMessage(key, tokens);
        }
        else {
            error[attribute] = messages.getMessage(key.keyName, tokens, key.bundle);
        }
    };

    _updateError(errorKey, errorTokens, 'message');

    if (!_.isNil(actionKey)) {
        _updateError(actionKey, actionTokens, 'action');
    }

    const key = _.isString(errorKey) ? errorKey : errorKey.keyName;
    error.name = PluginErrors[key] || key;

    return error;
};

module.exports = PluginError;
