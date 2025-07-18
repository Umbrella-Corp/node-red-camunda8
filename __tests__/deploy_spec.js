const helper = require('node-red-node-test-helper');
const deployNode = require('../src/nodes/deploy.js');
const camundaNode = require('../src/nodes/camunda');

helper.init(require.resolve('node-red'));

describe('deploy node', () => {
    beforeEach((done) => {
        jest.resetAllMocks();
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload();
        helper.stopServer(done);
    });

    it('should call zbc.deployResource', (done) => {
        const flow = [
            {
                id: 'n1',
                type: 'camunda',
                name: 'camunda',
                serverMode: 'self-hosted',
                clusterEndpoint: 'localhost:1234',
            },
            {
                id: 'n2',
                type: 'deploy',
                name: 'deploy',
                camunda: 'n1',
                wires: [['n3']],
            },
            { id: 'n3', type: 'helper' },
        ];

        helper.settings({ userDir: '.' });

        helper.load([camundaNode, deployNode], flow, () => {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');
            const n3 = helper.getNode('n3');

            n3.on('input', (msg) => {
                Promise.resolve().then(() => {
                    expect(n1.zbc.deployResource).toHaveBeenCalledTimes(1);
                    expect(n1.zbc.deployResource).toHaveBeenCalledWith(
                        expect.objectContaining({
                            name: expect.stringMatching(/^test.bpmn$/),
                            process: expect.any(Buffer),
                        }),
                    );
                    expect(msg.payload.bpmnProcessId).toEqual('my-process' );
                    done();
                });
            });

            n2.receive({
                payload: {
                    resourceType: 'process',
                    definition: '<xml />',
                    resourceName: 'test.bpmn',
                },
            });
        });
    });
});
