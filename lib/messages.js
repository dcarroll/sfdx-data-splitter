// TODO - externalize util
const util = require('util');

const TARGET_USERNAME_PARAM = 'targetusername';

const messages = {
    default: {
        en_US: {
            // errors
            // help
            displayCommandDataSplitHelp: 'Break up large data files into file with 200 or less records'
        }
    },

    data: {
        en_US: {
            name:'data',
            mainTopicDescriptionHelp: 'Utility for manipulating data',
            mainTopicLongDescriptionHelp: 'Utility for manipulating data'
        }
    },

    data_split: {
      en_US: {
            help: "Split data files that have more than 200 records into smaller bits",
            description: "Split large data files into smaller ones",
            longDescription: "Split large data files into smaller ones",
            GeneralError: "A general error for the Data split command.",
            dataSplitFileNotFound: "Could not find specified file"
      }

    }

 };

const _getLocale = function() {
    return 'en_US';
};

module.exports = function(locale = _getLocale()) {
    return {
        getMessage(label, args, bundle = 'default') {

            const bundleLocale = messages[bundle][locale];

            if (util.isNullOrUndefined(bundleLocale)) {
                return null;
            }

            if (util.isNullOrUndefined(bundleLocale[label])) {
                throw new Error(util.format(bundleLocale.UndefinedLocalizationLabel, bundle, label, locale));
            }

            if (util.isNullOrUndefined(args)) {
                return bundleLocale[label];
            } else {
                const everyone = [].concat(bundleLocale[label], args);
                return util.format(...everyone);
            }
        },

        getLocale() {
            return _getLocale();
        },

        get targetusername() {
            return TARGET_USERNAME_PARAM;
        }
    };
};
