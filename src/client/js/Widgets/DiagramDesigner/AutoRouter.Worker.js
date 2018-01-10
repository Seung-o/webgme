/*globals require,importScripts*/
// This is the code for using the autorouter as a web worker.

importScripts('/common/lib/requirejs/require.js');

var worker = this,
    window = {},  //jshint ignore: line
    WebGMEGlobal = {gmeConfig: {}},
    respondToAll = false,
    msgQueue = [];

/**
 * Start the worker. This is done after the relevant config has been received.
 *
 * @return {undefined}
 */
var startWorker = function() {
    'use strict';

    // Queue any messages received while loading the dependencies
    worker.onmessage = function(msg) {
        msgQueue.push(msg);
    };

    require({
        baseUrl: '.',
        paths: {
            client: '/client',
            underscore: '../../../bower_components/underscore/underscore-min',
            debug: '/common/lib/debug/debug',
            AutoRouterActionApplier: '../../../lib/autorouter/action-applier' // create a map file for debugging
        },
        shim: {
            debug: {
                exports: 'window.debug'
            }
        }
    },
    [
        'AutoRouterActionApplier',
        'client/logger',
        'underscore'
    ],
    function(
        ActionApplier,
        Logger,
        _
    ) {

        var AutoRouterWorker = function() {
            // Add recording actions?
            this.logger = Logger.create('gme:Widgets:DiagramDesigner:AutoRouter:Worker', WebGMEGlobal.gmeConfig.client.log);
            this._recordActions = true;
            this.init();

            this.respondTo = {
                getPathPoints: true,
                setBox: true,
                setPath: true
            };
        };

        AutoRouterWorker.prototype.handleMessage = function(msg) {
            this.logger.debug('Received:', msg.data);

            this._handleMessage(msg.data);
        };

        AutoRouterWorker.prototype._handleMessage = function(msg) {
            var response,
                action = msg[0],
                result;

            response = [action, msg[1].slice()];  // Copy the input args

            // If routing async, decorate the request
            if (action === 'routeAsync') {
                // Send getPathPoints response for each path on each update
                msg[1] = [{callback: this._updatePaths.bind(this)}];
            }

            try {
                console.log(action);
                result = this._invokeAutoRouterMethodUnsafe.apply(this, msg);
            } catch(e) {
                // Send error message
                console.error(action, e);
                worker.postMessage(['BugReplayList', this._getActionSequence()]);
            }

            if (respondToAll || (this.respondTo[action] && result)) {
                response.push(result);
                console.log(response);
                this.logger.debug('Response:', response);
                worker.postMessage(response);
            }
        };

        /**
         * Update all the paths on the graph.
         *
         * @return {undefined}
         */
        AutoRouterWorker.prototype._updatePaths = function(paths) {
            this.logger.debug('Updating paths');
            var self = this,
                id,
                points,
                content = [],
                msg = ['routePaths', null];

            msg[1] = paths.map(function (path) {
                return self._invokeAutoRouterMethod('path', [path.id]);
            });

            worker.postMessage(msg);
        };

        _.extend(AutoRouterWorker.prototype, ActionApplier.prototype);

        var autorouterWorker = new AutoRouterWorker();

        autorouterWorker.logger.debug('AR Worker is now listening...');

        // Handle the queued messages
        while (msgQueue.length) {
            autorouterWorker.handleMessage(msgQueue.shift());
        }

        worker.onmessage = autorouterWorker.handleMessage.bind(autorouterWorker);
        autorouterWorker.logger.debug('Ready for requests!');
        worker.postMessage('READY');
    }.bind(this));
};

// Set the WebGMEGlobal.gmeConfig.client config value for use in the loggers
worker.onmessage = function(msg) {
    'use strict';

    WebGMEGlobal.gmeConfig.client = msg.data[0];
    respondToAll = msg.data[1];
    startWorker();
};
