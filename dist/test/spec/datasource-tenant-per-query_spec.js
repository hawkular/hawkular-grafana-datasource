'use strict';

var _module = require('../module');

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _testUtil = require('./test-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('HawkularDatasource tenant per query', function () {
  var ctx = {};
  var instanceSettings = (0, _testUtil.getSettings)();
  // Remove global tenant 
  delete instanceSettings.jsonData.tenant;
  instanceSettings.jsonData.isTenantPerQuery = true;

  beforeEach(function () {
    ctx.$q = _q2.default;
    ctx.backendSrv = {};
    ctx.backendSrv.datasourceRequest = function (request) {
      return ctx.$q.when({ data: { 'Implementation-Version': '0.22.0' } });
    };
    ctx.templateSrv = {
      replace: function replace(target, vars) {
        return target;
      }
    };
    ctx.ds = new _module.Datasource(instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  it('should query raw data with ad-hoc tenant', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        id: 'memory',
        type: 'gauge',
        rate: false,
        tenant: 'ad-hoc'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'POST', 'gauges/raw/query', 'ad-hoc');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        ids: ['memory'],
        order: 'ASC'
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'memory',
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
      expect(result.data).to.have.length(1);
      expect(result.data[0].target).to.equal('memory');
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query raw data with templated tenant', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        id: 'memory',
        type: 'gauge',
        rate: false,
        tenant: '$tenant'
      }]
    };
    ctx.templateSrv.variables = [{
      name: 'tenant'
    }];
    ctx.templateSrv.replace = function (target, vars) {
      expect(target).to.equal('$tenant');
      return '{t1,t2}';
    };

    var ireq = 1;
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'POST', 'gauges/raw/query', 't' + ireq);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        ids: ['memory'],
        order: 'ASC'
      });
      ireq++;

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'memory',
          data: [{
            timestamp: 13,
            value: 3 * ireq
          }, {
            timestamp: 19,
            value: 4 * ireq
          }]
        }]
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(2);
      expect(result.data[0].target).to.equal('[t1] memory');
      expect(result.data[0].datapoints).to.deep.equal([[6, 13], [8, 19]]);
      expect(result.data[1].target).to.equal('[t2] memory');
      expect(result.data[1].datapoints).to.deep.equal([[9, 13], [12, 19]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query annotations with ad-hoc tenant', function (done) {

    var options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: 'my.timeline',
        name: 'Timeline',
        type: 'strings',
        tenant: 'ad-hoc'
      }
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'POST', 'strings/raw/query', 'ad-hoc');

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'my.timeline',
          data: [{
            timestamp: 13,
            value: 'start'
          }, {
            timestamp: 19,
            value: 'stop'
          }]
        }]
      });
    };

    ctx.ds.annotationQuery(options).then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal(options.annotation);
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal('Timeline');
      expect(result[0].tags).to.be.undefined;
      expect(result[0].text).to.equal('start');

      expect(result[1].annotation).to.deep.equal(options.annotation);
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal('Timeline');
      expect(result[1].tags).to.be.undefined;
      expect(result[1].text).to.equal('stop');
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query stats with ad-hoc tenant', function (done) {
    var options = {
      range: {
        from: 20,
        to: 30
      },
      targets: [{
        seriesAggFn: 'none',
        stats: ['min'],
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        raw: false,
        tenant: 'ad-hoc'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'POST', 'metrics/stats/query', 'ad-hoc');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
        buckets: 60,
        types: ['gauge']
      });

      return ctx.$q.when({
        status: 200,
        data: { 'gauge': { 'gauge_1': [{
              start: 20,
              end: 25,
              min: 15,
              max: 25,
              avg: 20.25
            }]
          }
        }
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(1);
      expect(result.data[0].target).to.equal('gauge_1 [min]');
      expect(result.data[0].datapoints).to.deep.equal([[15, 20]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should query stats with templated tenant', function (done) {
    var options = {
      range: {
        from: 20,
        to: 30
      },
      targets: [{
        seriesAggFn: 'none',
        stats: ['min', 'max'],
        tags: [{ name: 'type', value: 'memory' }],
        type: 'gauge',
        rate: false,
        raw: false,
        tenant: '$tenant'
      }]
    };
    ctx.templateSrv.variables = [{
      name: 'tenant'
    }];
    ctx.templateSrv.replace = function (target, vars) {
      expect(target).to.equal('$tenant');
      return '{t1,t2}';
    };

    var ireq = 1;
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'POST', 'metrics/stats/query', 't' + ireq);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
        buckets: 60,
        types: ['gauge']
      });
      ireq++;

      return ctx.$q.when({
        status: 200,
        data: { 'gauge': { 'gauge_1': [{
              start: 20,
              end: 25,
              min: 3 * ireq,
              max: 4 * ireq
            }]
          }
        }
      });
    };

    ctx.ds.query(options).then(function (result) {
      expect(result.data).to.have.length(4);
      expect(result.data[0].target).to.equal('[t1] gauge_1 [max]');
      expect(result.data[0].datapoints).to.deep.equal([[8, 20]]);
      expect(result.data[1].target).to.equal('[t1] gauge_1 [min]');
      expect(result.data[1].datapoints).to.deep.equal([[6, 20]]);
      expect(result.data[2].target).to.equal('[t2] gauge_1 [max]');
      expect(result.data[2].datapoints).to.deep.equal([[12, 20]]);
      expect(result.data[3].target).to.equal('[t2] gauge_1 [min]');
      expect(result.data[3].datapoints).to.deep.equal([[9, 20]]);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should suggest metrics with ad-hoc tenant', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'GET', 'metrics?type=gauge&tags=host=cartago', 'ad-hoc');
      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'gauge_1',
          tags: {
            'host': 'cartago'
          },
          dataRetention: 7,
          type: 'gauge'
        }, {
          id: 'gauge_2',
          tags: {
            'host': 'cartago'
          },
          dataRetention: 7,
          type: 'gauge'
        }]
      });
    };

    ctx.ds.suggestMetrics({ type: 'gauge', tagsQL: 'host=cartago', tenant: 'ad-hoc' }).then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'gauge_1', value: 'gauge_1' });
      expect(result[1]).to.deep.equal({ text: 'gauge_2', value: 'gauge_2' });
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should get tags suggestions with ad-hoc tenant', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'GET', 'gauges/tags/host:*', 'ad-hoc');

      return ctx.$q.when({
        status: 200,
        data: {
          'host': ['cartago', 'rio']
        }
      });
    };

    ctx.ds.suggestTags({ type: 'gauge', tenant: 'ad-hoc' }, 'host').then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'cartago', value: 'cartago' });
      expect(result[1]).to.deep.equal({ text: 'rio', value: 'rio' });
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should get tag keys suggestions with ad-hoc tenant', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequestWithTenant)(request, 'GET', 'metrics/tags', 'ad-hoc');
      return ctx.$q.when({
        status: 200,
        data: ['host', 'app']
      });
    };

    ctx.ds.suggestTagKeys({ tenant: 'ad-hoc' }).then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'host', value: 'host' });
      expect(result[1]).to.deep.equal({ text: 'app', value: 'app' });
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });
});
//# sourceMappingURL=datasource-tenant-per-query_spec.js.map
