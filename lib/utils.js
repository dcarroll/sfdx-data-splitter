/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root  or https://opensource.org/licenses/BSD-3-Clause
 */

'use strict';

const os = require('os');
const path = require('path');
const util = require('util');
const childProcess = require('child_process');

const Promise = require('bluebird');
const __sfdxdirname = path.dirname(require.resolve('salesforce-alm'));

const logger = require(path.join(__sfdxdirname, 'lib', 'logApi'));

const NS = 'force';

const messages = require(path.join(__dirname, 'messages'))();
const srcDevUtil = require(path.join(__sfdxdirname, 'lib', 'srcDevUtil'));

const cliNamespaceSupported = function() {
    return childProcess.spawnSync('sfdx', ['--version'], { encoding: 'utf8' }).status === 0;
}();

let start;

/**
 * Show the progress spinner if:
 *    - the command is eligible to show progress
 *    - the env var FORCE_SHOW_SPINNER is set
 *    - we are NOT generating json results
 *
 * Optional env vars:
 *    FORCE_SPINNER_TITLE: the title for the spinner that has an optional (%s) location for the spinner
 *    FORCE_SPINNER_STRING: the chars to show in sequence for the spinner, or an integer for built in strings (1-20)
 *    FORCE_SPINNER_DELAY: delay between character changes in ms (uses setInterval, default 60ms)
 *    FORCE_SPINNER_SKIP_CLEAN: set to turn off the spinner trying to clean up then screen when stopping
 * (see https://github.com/helloIAmPau/node-spinner)
 */
const _startSpinner = function(context) {
    const Spinner = require('cli-spinner').Spinner; // eslint-disable-line global-require

    // show spinner if desired and we are not generating json results
    if (context.showProgress && process.env.FORCE_SHOW_SPINNER && !context.json) {
        context.spinner = new Spinner(process.env.FORCE_SPINNER_TITLE || 'Processing... %s');
        if (process.env.FORCE_SPINNER_STRING) {
            const spinnerIdx = parseInt(process.env.FORCE_SPINNER_STRING);
            if (isNaN(spinnerIdx)) {
                context.spinner.setSpinnerString(process.env.FORCE_SPINNER_STRING);
            } else {
                context.spinner.setSpinnerString(spinnerIdx);
            }
        } else {
            context.spinner.setSpinnerString('|/-\\');
        }
        if (process.env.FORCE_SPINNER_DELAY) {
            context.spinner.setSpinnerDelay(parseInt(process.env.FORCE_SPINNER_DELAY));
        }
        context.spinner.start();
    }
};

/**
 * Stop the spinner if it's running.
 */
const _stopSpinner = function(context) {
    try {
        if (context.spinner && context.spinner.isSpinning()) {
            context.spinner.stop(!process.env.FORCE_SPINNER_SKIP_CLEAN);
            delete context.spinner;
        }
    } catch (err) {
        logger.warn(err);
    }
};

/**
 * determines if api mode is enabled.
 * @param context - the cli context (flags)
 * @returns {boolean} true if the api mode is enabled false otherwise.
 * @private
 */
const _isApiMode = function (context) {

    const envVar = process.env.SFDX_CONTENT_TYPE || process.env.FORCE_CONTENT_TYPE;
    // If the environment variable or the command line parameter is indicating api mode.
    return (!util.isNullOrUndefined(envVar) && envVar.toUpperCase() === 'JSON') || context.flags.json === true;

};

/**
 * logs a success message. if the command has a getColumnData function then tabular output is provided.
 * otherwise getHumanSuccessMessage is called returning a styled hash or message string.
 * @private
 * @param command the command object being invoked by the user
 * @param context the cli context
 * @param obj the obj returned by the command execution
 */
const _logSuccess = function(command, context, obj) {
    const _ = require('lodash'); // eslint-disable-line global-require

    if (_isApiMode(context)) {
        logger.logJson({ status: process.exitCode || 0, result: obj });
    }
    else {

        // For tables with no results we will display a simple message "No results found"
        if (Array.isArray(obj) && obj.length < 1) {
            logger.log(messages.getMessage('noResultsFound'));
            return;
        }

        // If the command produces tabular output
        if (_.isFunction(command.getColumnData)) {

            const columnData = command.getColumnData();

            // If the output is an object we are assuming multiple table are being displayed.
            if (_.isPlainObject(columnData)) {
                // Each table
                _.each(columnData, (val, key) => {

                    const rows = _.get(obj, key);
                    if (_.isEmpty(rows)) {
                        // If the rows are empty provide a nice message and a way to customize the message.
                        let message = messages.getMessage('noResultsFound');
                        if (command.getEmptyResultMessage) {
                            const _message = command.getEmptyResultMessage(key);
                            if (!_.isNil(_message)) {
                                message = _message;
                            }
                        }
                        logger.log(message);
                    }
                    else {
                        // One or more row s are available.
                        logger.table(_.get(obj, key), { columns: val });
                        // separate the table by a blank line.
                        logger.log(os.EOL);
                    }
                });
            }
            else {
                // Single output
                logger.table(obj, { columns: columnData });
            }
        }
        else {
            const message = command.getHumanSuccessMessage && command.getHumanSuccessMessage(obj);
            if (!util.isNullOrUndefined(message) && message !== '') {
                logger.log(message);
            }
        }
    }
};

/**
 * logs an error message
 * @private
 * @param command the command object being invoked by the user
 * @param context the cli context
 * @param err the error object thrown by the command execution
 */
const _logError = function(command, context, err) {

    const _ = require('lodash'); // eslint-disable-line global-require

    // provide action if instanceurl is incorrect
    if (context.org && context.org.usingAccessToken && _.isNil(err.action)
            && (err.message.match(/Session expired or invalid/) || err.message.match(/Destination URL not reset/))) {
        err.action = messages.getMessage('invalidInstanceUrlForAccessTokenAction');
    }

    // compose final error object
    const error = {
        message: err.rows || err.message,
        status: process.exitCode || 1,
        stack: err.stack,
        name: err.name
    };

    // set action on error
    if (!_.isNil(err.action)) {
        error.action = err.action;
    }

    // log as json, if applicable
    if (_isApiMode(context)) {
        logger.logJsonError(error);
    } else {
        let message = err.message;

        if (_.isFunction(command.getHumanErrorMessage)) {
            const humanMessage = command.getHumanErrorMessage(err);

            if (humanMessage) {
                message = humanMessage;
            }
        }

        // Ensure the message ends in a period.
        message = message.endsWith('.') ? message : message.concat('.');

        // format action, if applicable
        if (!_.isNil(error.action)) {
            // log action, if provided
            const action = {
                message,
                action: error.action
            };
            logger.action(action);
        } else if (err.rows && err.columns) {
            logger.table(err.rows, { columns: err.columns });
        } else {
            logger.error(message);
        }

        // Debug the stack for additional debug information
        logger.error(false, error);
    }
};

// todo: why this only works when loglevel is set?
const _logCommandComplete = (cmdName) => {
    const fileName = 'sfdx-usage.json';
    const totalTime = new Date().getTime() - start;

    logger.info(`DONE! Completed '${cmdName}' in ${totalTime / 1000.0}s`);

    const dayInMilliseconds = 1000 * 60 * 60 * 24;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Get timestamp in seconds, at the start of the fay.
    const timestamp = startOfDay.getTime();

    return srcDevUtil.getGlobalConfig(fileName, {})
    .then(contents => {
        let retPromise = Promise.resolve();
        if (!contents.startTime) {
            contents.startTime = timestamp;
            retPromise = srcDevUtil.saveGlobalConfig(fileName, contents);
        }

        function calcUsage(hubOrg, hubOrgId) {
            const moment = require('moment'); // eslint-disable-line global-require

            const analyticsCmd = childProcess.spawnSync('sfdx', ['analytics'], { encoding: 'utf8' });

            if (analyticsCmd.status === 1) {
                return Promise.resolve();
            }

            let commands;

            try {
                commands = JSON.parse(analyticsCmd.stdout).commands;
            } catch (error) {
                return Promise.resolve();
            }

            const usages = {};

            commands.forEach(command => {
                let version = `${command.version}`;

                if (command.plugin_version) {
                    version = `${version} ${command.plugin_version}`;
                }

                const commandKey = `${command.command}-${version}`;
                const runtime = command.runtime;

                if (!usages[commandKey]) {
                    usages[commandKey] = {
                        commandName: command.command,
                        toolbeltVersion: version,
                        hubOrgId,
                        usageDate: moment(startOfDay).format('YYYYMMDD'),
                        totalExecutions: 0,
                        totalErrors: 0,
                        avgRuntime: 0,
                        minRuntime: runtime,
                        maxRuntime: runtime
                    };
                }

                if (command.status !== 0) {
                    usages[commandKey].totalErrors++;
                }

                // Run an accumalative average, which is ((avg * totalExecution) + newTime) / (totalExecutions + 1)
                usages[commandKey].avgRuntime = Math.round((runtime + (usages[commandKey].avgRuntime * (usages[commandKey].totalExecutions))) / (usages[commandKey].totalExecutions + 1));

                usages[commandKey].totalExecutions++;

                // update minRuntime and maxRuntime
                if (runtime > usages[commandKey].maxRuntime) {
                    usages[commandKey].maxRuntime = runtime;
                } else if (runtime < usages[commandKey].minRuntime) {
                    usages[commandKey].minRuntime = runtime;
                }
            });

            const _ = require('lodash'); // eslint-disable-line global-require

            return logger.logServerUsages(hubOrg, _.values(usages));
        }

        // If it has been past 24 hours, then log the usage for previous day.
        if (now.getTime() - contents.startTime >= dayInMilliseconds) {
            // get hub org
            const Org = require(path.join(__sfdxdirname, 'lib', 'scratchOrgApi')); // eslint-disable-line global-require
            const hubOrg = new Org(undefined, Org.Defaults.DEVHUB);
            let hubOrgId;

            return hubOrg.getConfig()
            .then(config => {
                hubOrgId = config.orgId;
            })
            // Flush usage to server.
            .then(() => calcUsage(hubOrg, hubOrgId))
            .then(() => {
                // Reset time
                contents.startTime = timestamp;
                childProcess.spawnSync('sfdx', ['analytics:clear'], { encoding: 'utf8' });
                return srcDevUtil.saveGlobalConfig(fileName, contents);
            });
        }

        return retPromise;
    })
    .catch(() => { /* We don't want the comand to fail if sending usage fails */ });
};

// @todo We can solve this with an env variable.
const _exit = (cmdContext = {}) => {
    let softExit;

    try {
        const Config = require(path.join(__sfdxdirname, 'lib', 'configApi')).Config; // eslint-disable-line global-require
        softExit = cmdContext.softExit || process.env.SOFT_EXIT || new Config().getAppConfig().softExit;
    }
    catch (e) {
        // We are handling SyntaxError's in other places but 'new Config().getAppConfig' can throw a secondary syntax error
        if (e.name !== 'InvalidProjectWorkspace' && e.name !== 'SyntaxError' && e.name !== 'InvalidJsonCasing') {
            throw e;
        }
    }

    const _ = require('lodash'); // eslint-disable-line global-require

    // For unit testing we want soft exits; i.e., no process.exit()
    if (_.isNil(softExit)) {
        // give logs a little extra time flush logs to file.
        // exit normally when loglevel===error (default) so that
        // most invocations don't incur this tax.
        // https://github.com/trentm/node-bunyan/issues/95
        if (logger.isError()) {
            process.exit(process.exitCode); // eslint-disable-line no-process-exit
        } else {
            const wait = process.env.SFDX_LOG_WRITE_WAIT || 1000;
            setTimeout(() => process.exit(process.exitCode), wait); // eslint-disable-line no-process-exit
        }
    }
};

// several ways to get at command name given invocation context, eg cmd-line, test, API
const _determineCommandName = (command, context, defaultName = 'n/a') => {
    let name = context.cmd;
    if (!name) {
        if (context.command) {
            name = `${NS}:${context.command.topic}:${context.command.command}`;
        } else if (command && command.constructor) {
            name = command.constructor.name;
        } else {
            name = defaultName;
        }
    }

    return name;
};

/**
 * helper that invokes command objects in a common abstract way
 * @param command - the instance of the command object
 * @param context - the cli context
 * @param stdin - a map of stdin attributes.
 * @returns {Promise}
 * @private
 */
const _execCommand = function(command, context, stdin) {
    const cmdName = _determineCommandName(command, context);

    // Still need to set the log level for toolbelt promise chain.
    logger.setLevel(context.flags.loglevel || process.env.SFDX_LOG_LEVEL);
    logger.debug(`Invoking '${cmdName}' on username '${context.org ? context.org.getName() : 'n/a'}' with parameters: ${context.flags ? JSON.stringify(context.flags) : 'n/a'}`);

    // Reset process.exitCode since during testing we only soft exit.
    process.exitCode = undefined;

    let fixedContext;
    // First lets check if the command can do something with a scratch org.
    // Wrap in a promise since command.validate can throw, and we want it to
    // be part of the promise chain.
    return Promise.resolve()
        .then(() => {
            if (util.isFunction(command.validate)) {
                return command.validate(context);
            }
            return context;
        })
        .then((_fixedContext) => {
            fixedContext = _fixedContext;

            // ScratchOrgs require a workspace.
            if (!context.requiresWorkspace) {
                return Promise.resolve();
            }

            if (util.isFunction(context.org) && !fixedContext.json) {
                return context.org.getConfig();
            }

            return Promise.resolve();
        })

        // If it can do something with a scratch org display a pre execute message.
        .then((orgData) => {
            if (!util.isNullOrUndefined(orgData) && command.getPreExecuteMessage){
                // Only display the pre exec command when --json is not specified.
                logger.log(`${command.getPreExecuteMessage(orgData)}${os.EOL}`);
            }
            return Promise.resolve();
        })

        .then(() => _startSpinner(context))

        // Actually execute the command
        .then(() => command.execute(fixedContext || context, stdin))

        // The command completed successfully so display some results.
        .then((obj) => {
            _stopSpinner(context);
            _logSuccess(command, context, obj);

            // log before exit
            return _logCommandComplete(cmdName, context).then(() => obj);
        })
        .then((obj) => {
            _exit(context);
            return obj;
        })

        // The command had issues so display some error information.
        .catch((err) => {
            _stopSpinner(context);

            _logError(command, context, err);

            const Force = require(path.join(__sfdxdirname, 'lib', 'force')); // eslint-disable-line global-require

            // Log before exit. Log the error on the server
            // some commands do not create a Force instance - so providing one if not present
            return _logCommandComplete(cmdName, context, err)
                .then(() => logger.logServerError(err, command.force || new Force(), context))
                .finally(() => {
                    process.exitCode = 1;
                    return _exit(context);
                });
        })

        .finally(() => {
            _stopSpinner(context);
        });
};

/**
 * All commands are wrapped in an outter command. The command allows us to run pre-command filters. The filters do things
 * like standardize elements, functionality, and validation across all commands.
 * Note: The "this" contains the command context
 * @param cliContext - the cli context provided by heroku.
 * @returns {command}
 * @private
 */
const _commandPreFilter = function(cliContext) {
    logger.setCommandName(_determineCommandName(undefined, cliContext, null));

    // beginning of plugin execution
    start = new Date().getTime();

    try {
        const indexPreFilters = require(path.join(__sfdxdirname, 'lib', 'indexPreFilters')); // eslint-disable-line global-require
        indexPreFilters.validateProjectDir(this.commandContext, _logError, messages);

        if (_isApiMode(cliContext)) {
            cliContext.flags.json = true;
        }

        logger.setHumanConsumable(!cliContext.flags.json && !cliContext.flags.quiet);
    }
    catch (e) {
        logger.error(e.message);
        // Debug the stack for additional debug information
        logger.info(e);

        // REVIEWME: why exit?
        process.exit(1);// eslint-disable-line no-process-exit
    }

    // need to get the showProgress flag from the static "command" definition object into the context
    cliContext.showProgress = this.commandContext.showProgress;

    if (this.commandContext.schema && cliContext.flags.configinfo) {
        const schemaPath = path.join(__sfdxdirname, 'schemas', this.commandContext.schema.name);
        const SchemaValidator = require(path.join(__sfdxdirname, 'lib', 'schema', 'schemaValidator')); // eslint-disable-line global-require
        return new SchemaValidator(logger, schemaPath)
            .loadSchema()
            .then(schema => {
                if (cliContext.flags.json) {
                    return _logSuccess(this, cliContext, schema);
                }
                const SchemaPrinter = require(path.join(__sfdxdirname, 'lib', 'schema', 'schemaPrinter')); // eslint-disable-line global-require
                return new SchemaPrinter(schema).print();
            });
    }

    let promise = Promise.resolve();
    const Org = require(path.join(__sfdxdirname, 'lib', 'scratchOrgApi')); // eslint-disable-line global-require

    // set the desired org
    if (this.commandContext.supportsTargetUsername
            || this.commandContext.supportsTargetDevHubUsername) {
        const orgType = this.commandContext.orgType;
        const username = !orgType || orgType === Org.Defaults.USERNAME ?
            cliContext.flags.targetusername : cliContext.flags.targetdevhubusername;

        promise = Org.create(username, orgType)
            .then(org => { cliContext.org = org; });
    }

    return promise
        .then(() => this.command(cliContext))
        .catch((err) => {
            _logError({}, cliContext, err);
            process.exitCode = 1;
            _exit(cliContext);
        });
};

/**
 * Setting the log level needs to also occur before the command registry is built. The registry has a dependency on an Org,
 * which in turn has a dependency on force. Force does not have any dependency on the UI and thus can't set the level
 * based on the user's selection.
 */
const loglevelIndex = process.argv.indexOf('--loglevel');

try {
    if (loglevelIndex > 0) {
        logger.init(process.argv[loglevelIndex + 1]);
    }
    else {
        // setup file logging w/ env loglevel (default, if
        // not set); can be reset by --loglevel param
        logger.init(process.env.SFDX_LOG_LEVEL);
    }
}
catch (error) {
    logger.error(error);
    process.exit(1); // eslint-disable-line no-process-exit
}




exports.executeCommand = _execCommand;
exports.logger = logger;
