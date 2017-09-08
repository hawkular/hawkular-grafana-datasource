'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.expectRequest = expectRequest;
exports.expectAlertRequest = expectAlertRequest;
exports.expectRequestWithTenant = expectRequestWithTenant;
exports.getSettings = getSettings;
var hProtocol = 'https';
var hHostname = 'test.com';
var hPort = '876';
var hPath = 'hawkular';
var instanceSettings = {
  url: hProtocol + '://' + hHostname + ':' + hPort + '/' + hPath,
  jsonData: {
    tenant: 'test-tenant'
  }
};

function expectRequest(request, verb, path) {
  expect(request.method).to.equal(verb);
  expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);
  expect(request.url).to.equal(instanceSettings.url + '/metrics/' + path);
}

function expectAlertRequest(request, verb, path) {
  expect(request.method).to.equal(verb);
  expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);
  expect(request.url).to.equal(instanceSettings.url + '/alerts/' + path);
}

function expectRequestWithTenant(request, verb, path, tenant) {
  expect(request.method).to.equal(verb);
  expect(request.headers).to.have.property('Hawkular-Tenant', tenant);
  expect(request.url).to.equal(instanceSettings.url + '/metrics/' + path);
}

function getSettings() {
  return instanceSettings;
}
//# sourceMappingURL=test-util.js.map
