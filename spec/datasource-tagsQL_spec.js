import {Datasource} from "../module";
import Q from "q";

describe('HawkularDatasource with tagsQL', function () {
  var ctx = {};
  var hProtocol = 'https';
  var hHostname = 'test.com';
  var hPort = '876';
  var hPath = 'hawkular/metrics';
  var instanceSettings = {
    url: hProtocol + '://' + hHostname + ':' + hPort + '/' + hPath,
    jsonData: {
      tenant: 'test-tenant'
    }
  };

  var parsePathElements = function(request) {
    expect(request.method).to.equal('POST');
    expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);

    var parser = document.createElement('a');
    parser.href = request.url;

    expect(parser).to.have.property('protocol', hProtocol + ':');
    expect(parser).to.have.property('hostname', hHostname);
    expect(parser).to.have.property('port', hPort);
    expect(parser).to.have.property('pathname');

    return parser.pathname.split('/').filter(e => e.length != 0);
  }

  beforeEach(function () {
    ctx.$q = Q;
    ctx.backendSrv = {};
    ctx.backendSrv.datasourceRequest = function (request) {
      return ctx.$q.when({data: {'Implementation-Version': '0.24.0'}})
    };
    ctx.templateSrv = {
        replace: function(target, vars) {
          return target;
        }
    };
    ctx.ds = new Datasource(instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  it('should return an empty array when no targets are set', function (done) {
    ctx.ds.query({targets: []}).then(function (result) {
      expect(result).to.have.property('data').with.length(0);
    }).then(v => done(), err => done(err));
  });

  it('should query by tags QL', function (done) {
    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        tagsQL: "type=memory AND host=myhost",
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      let pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'raw', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type=memory AND host=myhost",
        order: 'ASC'
      });

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(v => done(), err => done(err));
  });

  it('should return aggregated stats by tags QL', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'max',
        tagsQL: "type=memory",
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      let pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'stats', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type=memory",
        buckets: 1,
        stacked: true
      });

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(v => done(), err => done(err));
  });

  it('should return live stats with tagsQL', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'live',
        tagsQL: "type=memory",
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      let pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'raw', 'query']);
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal("type=memory");

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(v => done(), err => done(err));
  });
});
