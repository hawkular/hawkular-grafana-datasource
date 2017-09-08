'use strict';

var _module = require('../module');

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _testUtil = require('./test-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('HawkularDatasource', function () {
  var ctx = {};
  var instanceSettings = (0, _testUtil.getSettings)();

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
        id: 'memory',
        type: 'gauge',
        rate: false
      }, {
        id: 'packets',
        type: 'counter',
        rate: true
      }]
    };

    var first = true;
    var id = void 0;
    ctx.backendSrv.datasourceRequest = function (request) {
      if (first) {
        first = false;
        id = 'memory';
        (0, _testUtil.expectRequest)(request, 'POST', 'gauges/raw/query');
        expect(request.data).to.deep.equal({
          start: options.range.from,
          end: options.range.to,
          ids: [id],
          order: 'ASC'
        });
      } else {
        id = 'packets';
        (0, _testUtil.expectRequest)(request, 'POST', 'counters/rate/query');
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
        id: '$app/memory',
        type: 'gauge',
        rate: false
      }]
    };

    ctx.templateSrv.variables = [{
      name: 'app'
    }];
    ctx.templateSrv.replace = function (target, vars) {
      expect(target).to.equal('$app');
      return '{app_1,app_2}';
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      expect(request.url).to.have.string('gauges/raw/query');
      expect(request.data.ids).to.include.members(['app_1/memory', 'app_2/memory']);
      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'app_1/memory',
          data: [{
            timestamp: 13,
            value: 15
          }, {
            timestamp: 19,
            value: 21
          }]
        }, {
          id: 'app_2/memory',
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
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'POST', 'gauges/raw/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory,host:myhost',
        order: 'ASC'
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'myhost.metric.memory.1',
          data: [{
            timestamp: 13,
            value: 15
          }, {
            timestamp: 19,
            value: 21
          }]
        }, {
          id: 'myhost.metric.memory.2',
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

  it('should query availability', function (done) {
    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        id: 'myapp/health',
        type: 'availability'
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'POST', 'availability/raw/query');
      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'myapp/health',
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

  it('should suggest metrics', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'GET', 'metrics?type=gauge&tags=host=cartago');
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

    ctx.ds.suggestMetrics({ type: 'gauge', tagsQL: 'host=cartago' }).then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'gauge_1', value: 'gauge_1' });
      expect(result[1]).to.deep.equal({ text: 'gauge_2', value: 'gauge_2' });
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should get tags suggestions', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'GET', 'gauges/tags/host:*');

      return ctx.$q.when({
        status: 200,
        data: {
          'host': ['cartago', 'rio']
        }
      });
    };

    ctx.ds.suggestTags({ type: 'gauge' }, 'host').then(function (result) {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'cartago', value: 'cartago' });
      expect(result[1]).to.deep.equal({ text: 'rio', value: 'rio' });
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should get no suggestions on unknown tag', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'GET', 'gauges/tags/host:*');
      return ctx.$q.when({
        status: 204,
        data: {}
      });
    };
    ctx.ds.suggestTags({ type: 'gauge' }, 'host').then(function (result) {
      expect(result).to.have.length(0);
    }).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });

  it('should get tag keys suggestions', function (done) {
    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'GET', 'metrics/tags');
      return ctx.$q.when({
        status: 200,
        data: ['host', 'app']
      });
    };

    ctx.ds.suggestTagKeys({}).then(function (result) {
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
//# sourceMappingURL=datasource_spec.js.map
