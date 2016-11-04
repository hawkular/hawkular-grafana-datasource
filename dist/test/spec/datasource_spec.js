"use strict";

var _module = require("../module");

var _q = require("q");

var _q2 = _interopRequireDefault(_q);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('HawkularDatasource', function () {
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

  var parsePathElements = function parsePathElements(request) {
    expect(request.method).to.equal('POST');
    expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);

    var parser = document.createElement('a');
    parser.href = request.url;

    expect(parser).to.have.property('protocol', hProtocol + ':');
    expect(parser).to.have.property('hostname', hHostname);
    expect(parser).to.have.property('port', hPort);
    expect(parser).to.have.property('pathname');

    return parser.pathname.split('/').filter(function (e) {
      return e.length != 0;
    });
  };

  beforeEach(function () {
    ctx.$q = _q2.default;
    ctx.backendSrv = {};
    ctx.backendSrv.datasourceRequest = function (request) {
      return ctx.$q.when({ data: { 'Implementation-Version': '1.0.0' } });
    };
    ctx.templateSrv = {
      replace: function replace(target, vars) {
        return target;
      }
    };
    ctx.ds = new _module.Datasource(instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  it('should return an empty array when no targets are set', function (done) {
    ctx.ds.query({ targets: [] }).then(function (result) {
      expect(result).to.have.property('data').with.length(0);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return the server results when a target is set', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        target: 'memory',
        type: 'gauge',
        rate: false,
        queryBy: 'ids'
      }, {
        target: 'packets',
        type: 'counter',
        rate: true,
        queryBy: 'ids'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      var id = pathElements[2] == 'gauges' ? 'memory' : 'packets';

      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements[2]).to.be.oneOf(['gauges', 'counters']);
      if (pathElements[2] == 'gauges') {
        expect(pathElements.slice(3)).to.deep.equal(['raw', 'query']);
        expect(request.data).to.deep.equal({
          start: options.range.from,
          end: options.range.to,
          ids: [id],
          order: 'ASC'
        });
      } else {
        expect(pathElements.slice(3)).to.deep.equal(['rate', 'query']);
        expect(request.data).to.deep.equal({
          start: options.range.from,
          end: options.range.to,
          ids: [id],
          order: 'ASC'
        });
      }

      return ctx.$q.when({
        status: 200,
        data: [{
          id: id,
          data: [{
            timestamp: 13,
            value: 15
          }, {
            timestamp: 19,
            value: 21
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(2);
      expect(result.data.map(function (t) {
        return t.target;
      })).to.include.members(['memory', 'packets']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[15, 13], [21, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return multiple results with templated target', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        target: '$app/memory',
        type: 'gauge',
        rate: false,
        queryBy: 'ids'
      }]
    };

    ctx.templateSrv.replace = function (target, vars) {
      expect(target).to.equal('$app');
      return "{app_1,app_2}";
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      expect(request.url).to.have.string("/gauges/raw/query");
      expect(request.data.ids).to.include.members(['app_1/memory', 'app_2/memory']);
      return ctx.$q.when({
        status: 200,
        data: [{
          id: "app_1/memory",
          data: [{
            timestamp: 13,
            value: 15
          }, {
            timestamp: 19,
            value: 21
          }]
        }, {
          id: "app_2/memory",
          data: [{
            timestamp: 13,
            value: 28
          }, {
            timestamp: 19,
            value: 32
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(2);
      expect(result.data.map(function (t) {
        return t.target;
      })).to.include.members(['app_1/memory', 'app_2/memory']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[28, 13], [32, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query by tags', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        tags: [{ name: 'type', value: 'memory' }, { name: 'host', value: 'myhost' }],
        type: 'gauge',
        rate: false,
        queryBy: 'tags'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'raw', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type:memory,host:myhost",
        order: 'ASC'
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "myhost.metric.memory.1",
          data: [{
            timestamp: 13,
            value: 15
          }, {
            timestamp: 19,
            value: 21
          }]
        }, {
          id: "myhost.metric.memory.2",
          data: [{
            timestamp: 13,
            value: 20
          }, {
            timestamp: 19,
            value: 25
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(2);
      expect(result.data.map(function (t) {
        return t.target;
      })).to.include.members(['myhost.metric.memory.1', 'myhost.metric.memory.2']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[20, 13], [25, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return aggregated stats max/stacked', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'max',
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        queryBy: 'tags'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'stats', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type:memory",
        buckets: 1,
        stacked: true
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          start: 13,
          end: 19,
          min: 35,
          max: 46,
          avg: 40.5
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[46, 13]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return aggregated stats avg/not stacked', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'avg',
        timeAggFn: 'avg',
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        queryBy: 'tags'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'stats', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type:memory",
        buckets: 1,
        stacked: false
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          start: 13,
          end: 19,
          min: 15,
          max: 25,
          avg: 20.25
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[20.25, 13]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return live stats stacked', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'live',
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        queryBy: 'tags'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'raw', 'query']);
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal("type:memory");

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "myhost.metric.memory.1",
          data: [{
            timestamp: 18,
            value: 21
          }]
        }, {
          id: "myhost.metric.memory.2",
          data: [{
            timestamp: 19,
            value: 25
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[46, 18]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should return live stats not stacked', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'avg',
        timeAggFn: 'live',
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        queryBy: 'tags'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'raw', 'query']);
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal("type:memory");

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "myhost.metric.memory.1",
          data: [{
            timestamp: 18,
            value: 21
          }]
        }, {
          id: "myhost.metric.memory.2",
          data: [{
            timestamp: 19,
            value: 25
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[23, 18]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query availability', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        target: 'myapp/health',
        type: 'availability',
        queryBy: 'ids'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      var pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['availability', 'raw', 'query']);

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "myapp/health",
          data: [{
            timestamp: 13,
            value: 'up'
          }, {
            timestamp: 19,
            value: 'down'
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].target).to.equal('myapp/health');
      expect(result.data[0].datapoints).to.deep.equal([[1, 13], [0, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });
});
//# sourceMappingURL=datasource_spec.js.map
