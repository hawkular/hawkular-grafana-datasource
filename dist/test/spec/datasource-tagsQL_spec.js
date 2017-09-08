'use strict';

var _module = require('../module');

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _testUtil = require('./test-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('HawkularDatasource with tagsQL', function () {
  var ctx = {};
  var instanceSettings = (0, _testUtil.getSettings)();

  beforeEach(function () {
    ctx.$q = _q2.default;
    ctx.backendSrv = {};
    ctx.backendSrv.datasourceRequest = function (request) {
      return ctx.$q.when({ data: { 'Implementation-Version': '0.24.0' } });
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

  it('should query by tags QL', function (done) {
    var options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        tagsQL: 'type=memory AND host=myhost',
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'POST', 'gauges/raw/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type=memory AND host=myhost',
        order: 'ASC'
      });

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
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
        tagsQL: 'type=memory',
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'POST', 'gauges/stats/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type=memory',
        buckets: 1,
        stacked: true
      });

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
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
        tagsQL: 'type=memory',
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = function (request) {
      (0, _testUtil.expectRequest)(request, 'POST', 'gauges/raw/query');
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal('type=memory');

      return ctx.$q.when({
        status: 200,
        data: []
      });
    };

    ctx.ds.query(options).then(function (v) {
      return done();
    }, function (err) {
      return done(err);
    });
  });
});
//# sourceMappingURL=datasource-tagsQL_spec.js.map
