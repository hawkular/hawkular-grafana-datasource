import {Datasource} from '../module';
import Q from 'q';
import {getSettings, expectRequest} from './test-util';

describe('HawkularDatasource for downsamples', () => {
  let ctx = {};
  const instanceSettings = getSettings();

  beforeEach(() => {
    ctx.$q = Q;
    ctx.backendSrv = {};
    ctx.backendSrv.datasourceRequest = request => {
      return ctx.$q.when({data: {'Implementation-Version': '0.22.0'}})
    };
    ctx.templateSrv = {
      replace: (target, vars) => target
    };
    ctx.ds = new Datasource(instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  it('should return aggregated stats max/stacked', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'max',
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'gauges/stats/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[46, 13]]);
    }).then(v => done(), err => done(err));
  });

  it('should return aggregated stats avg/not stacked', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'avg',
        timeAggFn: 'avg',
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'gauges/stats/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[20.25, 13]]);
    }).then(v => done(), err => done(err));
  });

  it('should return live stats stacked', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        timeAggFn: 'live',
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'gauges/raw/query');
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal('type:memory');

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'myhost.metric.memory.1',
          data: [{
            timestamp: 18,
            value: 21
          }]
        },{
          id: 'myhost.metric.memory.2',
          data: [{
            timestamp: 19,
            value: 25
          }]
        }]
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[46, 18]]);
    }).then(v => done(), err => done(err));
  });

  it('should return live stats not stacked', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        seriesAggFn: 'avg',
        timeAggFn: 'live',
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'gauges/raw/query');
      expect(request.data.limit).to.equal(1);
      expect(request.data.tags).to.equal('type:memory');

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'myhost.metric.memory.1',
          data: [{
            timestamp: 18,
            value: 21
          }]
        },{
          id: 'myhost.metric.memory.2',
          data: [{
            timestamp: 19,
            value: 25
          }]
        }]
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(1);
      expect(result.data[0].datapoints).to.deep.equal([[23, 18]]);
    }).then(v => done(), err => done(err));
  });

  it('should query summed stats avg and percentile', done => {
    let options = {
      range: {
        from: 20,
        to: 30
      },
      targets: [{
        seriesAggFn: 'sum',
        stats: ['avg', '90 %ile'],
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false,
        raw: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'gauges/stats/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
        percentiles: '90',
        buckets: 60,
        stacked: true
      });

      return ctx.$q.when({
        status: 200,
        data: [{
          start: 20,
          end: 25,
          min: 15,
          max: 25,
          avg: 20.25,
          percentiles: [{'value':23.1,'originalQuantile':'90','quantile':90.0}]
        }, {
          start: 25,
          end: 30,
          min: 18,
          max: 28,
          avg: 23.25,
          percentiles: [{'value':26.1,'originalQuantile':'90','quantile':90.0}]
        }]
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(2);
      expect(result.data[1].target).to.equal('avg');
      expect(result.data[1].datapoints).to.deep.equal([[20.25, 20], [23.25, 25]]);
      expect(result.data[0].target).to.equal('90 %ile');
      expect(result.data[0].datapoints).to.deep.equal([[23.1, 20], [26.1, 25]]);
    }).then(v => done(), err => done(err));
  });

  it('should query unmerged stats min and percentile', done => {
    let options = {
      range: {
        from: 20,
        to: 30
      },
      targets: [{
        seriesAggFn: 'none',
        stats: ['min', '95 %ile'],
        tags: [{name: 'type', value: 'memory'}],
        type: 'gauge',
        rate: false,
        raw: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'metrics/stats/query');
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: 'type:memory',
        percentiles: '95',
        buckets: 60,
        types: ['gauge']
      });

      return ctx.$q.when({
        status: 200,
        data: {'gauge':
          { 'gauge_1':
            [{
              start: 20,
              end: 25,
              min: 15,
              max: 25,
              avg: 20.25,
              percentiles: [{'value':23.1,'originalQuantile':'95','quantile':95.0}]
            }, {
              start: 25,
              end: 30,
              min: 18,
              max: 28,
              avg: 23.25,
              percentiles: [{'value':26.1,'originalQuantile':'95','quantile':95.0}]
            }],
            'gauge_2':
            [{
              start: 20,
              end: 25,
              min: 20,
              max: 30,
              avg: 25.25,
              percentiles: [{'value':28.1,'originalQuantile':'95','quantile':95.0}]
            }, {
              start: 25,
              end: 30,
              min: 23,
              max: 33,
              avg: 28.25,
              percentiles: [{'value':31.1,'originalQuantile':'95','quantile':95.0}]
            }]
          }
        }
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(4);
      expect(result.data[1].target).to.equal('gauge_1 [min]');
      expect(result.data[1].datapoints).to.deep.equal([[15, 20], [18, 25]]);
      expect(result.data[0].target).to.equal('gauge_1 [95 %ile]');
      expect(result.data[0].datapoints).to.deep.equal([[23.1, 20], [26.1, 25]]);
      expect(result.data[3].target).to.equal('gauge_2 [min]');
      expect(result.data[3].datapoints).to.deep.equal([[20, 20], [23, 25]]);
      expect(result.data[2].target).to.equal('gauge_2 [95 %ile]');
      expect(result.data[2].datapoints).to.deep.equal([[28.1, 20], [31.1, 25]]);
    }).then(v => done(), err => done(err));
  });
});
