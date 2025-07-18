const helper = require('node-red-node-test-helper');
const cancelProcessInstanceNode = require('../src/nodes/cancel-process-instance.js');
const camundaNode = require('../src/nodes/camunda');

helper.init(require.resolve('node-red'));

describe('cancel-process-instance node', () => {
    beforeEach((done) => {
        jest.resetAllMocks();
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload();
        helper.stopServer(done);
    });

    it('should call zbc.cancelProcessInstance with correct parameters', (done) => {
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
                type: 'cancel-process-instance',
                name: 'cancel-process-instance',
                camunda: 'n1',
                wires: [['n3']],
            },
            { id: 'n3', type: 'helper' },
        ];

        helper.settings({ userDir: '.' });

        helper.load([camundaNode, cancelProcessInstanceNode], flow, () => {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');
            const n3 = helper.getNode('n3');

            // Mock the cancelProcessInstance method
            n1.zbc = {
                cancelProcessInstance: jest.fn().mockResolvedValue({ cancelled: true }),
            };

            n3.on('input', (msg) => {
                Promise.resolve().then(() => {
                    expect(n1.zbc.cancelProcessInstance).toHaveBeenCalledTimes(1);
                    expect(n1.zbc.cancelProcessInstance).toHaveBeenCalledWith('12345678901234567');
                    expect(msg.payload.processInstanceKey).toEqual('12345678901234567');
                    expect(msg.payload.cancelled).toBe(true);
                    expect(msg.payload.result).toEqual({ cancelled: true });
                    done();
                });
            });

            n2.receive({
                payload: {
                    processInstanceKey: '12345678901234567',
                },
            });
        });
    });

    it('should handle missing processInstanceKey error', (done) => {
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
                type: 'cancel-process-instance',
                name: 'cancel-process-instance',
                camunda: 'n1',
            },
        ];

        helper.load([camundaNode, cancelProcessInstanceNode], flow, () => {
            const n2 = helper.getNode('n2');

            // Listen for error events
            n2.on('call:error', (err) => {
                expect(err).toContain('Missing processInstanceKey in payload');
                done();
            });

            // Send message without processInstanceKey
            n2.receive({
                payload: {},
            });
        });
    });

    it('should handle Zeebe client errors', (done) => {
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
                type: 'cancel-process-instance',
                name: 'cancel-process-instance',
                camunda: 'n1',
            },
        ];

        helper.load([camundaNode, cancelProcessInstanceNode], flow, () => {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            // Mock the cancelProcessInstance method to throw an error
            n1.zbc = {
                cancelProcessInstance: jest.fn().mockRejectedValue(new Error('Process instance not found')),
            };

            n2.on('call:error', (err) => {
                expect(err).toContain('Process instance not found');
                done();
            });

            n2.receive({
                payload: {
                    processInstanceKey: '12345678901234567',
                },
            });
        });
    });
});
