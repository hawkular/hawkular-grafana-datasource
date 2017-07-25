const hProtocol = 'https';
const hHostname = 'test.com';
const hPort = '876';
const hPath = 'hawkular/metrics';
const instanceSettings = {
  url: hProtocol + '://' + hHostname + ':' + hPort + '/' + hPath,
  jsonData: {
    tenant: 'test-tenant'
  }
};

export function expectRequest(request, verb, path) {
    expect(request.method).to.equal(verb);
    expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);

    const parser = document.createElement('a');
    parser.href = request.url;

    expect(parser).to.have.property('protocol', hProtocol + ':');
    expect(parser).to.have.property('hostname', hHostname);
    expect(parser).to.have.property('port', hPort);
    expect(parser).to.have.property('pathname', path);
}

export function getSettings() {
  return instanceSettings;
}
