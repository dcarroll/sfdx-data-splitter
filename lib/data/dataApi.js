'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const messages = require(path.join(__dirname, '..', 'messages'))();
const pluginError = require(path.join(__dirname, '..', 'pluginError'));
let temparray = [];

// Private helper functions
const _validateFile = (path) => {
    return fs.existsSync(path);
};

const _writeFile = (name, contents) => {
    var fs = require('fs');
    fs.writeFile(name, contents, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file was saved!\n" + name);
    }); 
};

const _writeDataFile = (datafolder, recordData) => {
    _writeFile(path.join(datafolder, recordData.fileName), JSON.stringify(recordData.data, null, 4));
    temparray.push(recordData.fileName);
};

const _breakupDataFile = (datafolder, f) => {
    let records = require(path.join(datafolder, f)).records;
    if (records.length <= 200) {
        temparray.push(f);
        return
    }
    let i,j;
    const chunk = 200;
    temparray = [];
    for (i=0,j=records.length; i<j; i+=chunk) {
        const fname = path.basename(f).split('.');
        _writeDataFile(datafolder, 
            { "data": 
                { "records":records.slice(i,i+chunk)  }, 
            "fileName": fname[0] + i + '.' + fname[1] 
            }
        );
    }
}

const _splitFiles = (context) => {
    const filepath = path.resolve(process.cwd(), context.flags.dataplan);
    const datafolder = path.dirname(filepath);
    if (!_validateFile(filepath)) {
            throw pluginError(messages.getMessage('dataSplitFileNotFound', [], 'data_split'));
        //process.exit(1);
    }
    let plan = require(filepath);
    _.forEach(plan, function(p) {
        _.forEach(p.files, function(f) {
            _breakupDataFile(datafolder, f);
            console.log(f);
        });
        p.files = temparray;
        _writeFile(filepath, JSON.stringify(plan, null, 4));
    });
}
/**
 * Describe the utility of your plugin *
 */
class Data {
    /**
     * Public members of the Data class
     * @yourParam {type} description
     * @returns {Promise}.
     */

    split(context) {
        let promise = Promise.resolve(_splitFiles(context));
        return promise;
    }

    getHumanErrorMessage(){ 
        return 'Your plugin ran into an error.'
    }
    getHumanSuccessMessage() {
        return 'Your plugin ran successfully!'
    };

    /**
     * Other public methods in your plugin
     * @param {string} param desc
     * @param {string} param desc
     * @returns {Promise} result value
     */
    // TODO - write your own method
    // delete(alias, group = Alias.Groups.ORGS) {
    //     return Alias.set(alias, undefined, group);
    // }

}

module.exports = Data;

