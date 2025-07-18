const logger = require('../util/logger');

module.exports = function (RED) {
    const { Camunda8 } = require('@camunda8/sdk');

    function Camunda(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // Validate configuration based on server mode
        if (config.serverMode === 'saas') {
            if (!config.clusterId) {
                node.error('Missing cluster ID for SaaS mode');
                return;
            }
        } else if (config.serverMode === 'self-hosted') {
            if (!config.clusterEndpoint) {
                node.error('Missing cluster endpoint for Self Hosted mode');
                return;
            }
        } else {
            node.error('Invalid server mode. Must be either "saas" or "self-hosted"');
            return;
        }

        // Determine the contact point based on server mode
        let contactPoint;
        if (config.serverMode === 'saas') {
            contactPoint = `${config.clusterId}.zeebe.camunda.io:443`;
        } else {
            contactPoint = config.clusterEndpoint;
        }

        // Map Node-RED configuration to Camunda8 SDK format
        const c8Config = {
            ZEEBE_GRPC_ADDRESS: contactPoint,
            CAMUNDA_SECURE_CONNECTION: Boolean(config.useTls),
        };

        // Add OAuth configuration if provided
        if (config.oAuthUrl && config.oAuthUrl !== '') {
            c8Config.CAMUNDA_OAUTH_URL = config.oAuthUrl;
            c8Config.ZEEBE_CLIENT_ID = config.clientId;
            c8Config.ZEEBE_CLIENT_SECRET = config.clientSecret;
        }

        // Configure logging and callbacks
        const clientOptions = {
            onReady: () => {
                node.log(`Connected to ${contactPoint} (${config.serverMode})`);
                node.emit('ready');
            },
            onConnectionError: (error) => {
                node.log('Connection Error: ' + (error && error.message ? error.message : 'Unknown error'));
                node.emit('connectionError');
            },
            loglevel: 'DEBUG',
            stdout: logger(node, RED.settings.logging),
        };

        if (config.useLongpoll) {
            clientOptions.longPoll = 600000;
        }

        try {
            const c8 = new Camunda8(c8Config);
            node.zbc = c8.getZeebeGrpcApiClient();

            // Apply additional client options that aren't part of the constructor
            if (clientOptions.onReady) {
                node.zbc.onReady = clientOptions.onReady;
            }
            if (clientOptions.onConnectionError) {
                node.zbc.onConnectionError = clientOptions.onConnectionError;
            }
            if (clientOptions.loglevel) {
                node.zbc.loglevel = clientOptions.loglevel;
            }
            if (clientOptions.stdout) {
                node.zbc.stdout = clientOptions.stdout;
            }
            if (clientOptions.longPoll) {
                node.zbc.longPoll = clientOptions.longPoll;
            }
        } catch (err) {
            node.error('Failed to create Camunda client: ' + err.message);
            return;
        }

        node.on('close', function (done) {
            if (node.zbc) {
                return node.zbc.close().then(() => {
                    node.log('All workers closed');
                    done();
                }).catch((err) => {
                    node.error('Error closing Camunda client: ' + err.message);
                    done();
                });
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType('camunda', Camunda);
};
