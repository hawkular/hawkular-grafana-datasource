import {Datasource} from "../module";
import Q from "q";

describe('HawkularDatasource', () => {
  let ctx = {};
  let hProtocol = 'https';
  let hHostname = 'test.com';
  let hPort = '876';
  let hPath = 'hawkular/metrics';
  let instanceSettings = {
    url: hProtocol + '://' + hHostname + ':' + hPort + '/' + hPath,
    jsonData: {
      tenant: 'test-tenant'
    }
  };

  let parsePathElements = request => {
    expect(request.method).to.equal('POST');
    expect(request.headers).to.have.property('Hawkular-Tenant', instanceSettings.jsonData.tenant);

    let parser = document.createElement('a');
    parser.href = request.url;

    expect(parser).to.have.property('protocol', hProtocol + ':');
    expect(parser).to.have.property('hostname', hHostname);
    expect(parser).to.have.property('port', hPort);
    expect(parser).to.have.property('pathname');

    return parser.pathname.split('/').filter(e => e.length != 0);
  }

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

  it('should return an empty array when no targets are set', done => {
    ctx.ds.query({targets: []}).then(result => {
      expect(result).to.have.property('data').with.length(0);
    }).then(v => done(), err => done(err));
  });

  it('should return the server results when a target is set', done => {

    let options = {
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

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
      let id = pathElements[2] == 'gauges' ? 'memory' : 'packets';

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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(2);
      expect(result.data.map(t => t.target)).to.include.members(['memory', 'packets']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[15, 13], [21, 19]]);
    }).then(v => done(), err => done(err));
  });

  it('should return multiple results with templated target', done => {

    const options = {
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
    ctx.templateSrv.replace = (target, vars) => {
      expect(target).to.equal('$app');
      return "{app_1,app_2}";
    };

    ctx.backendSrv.datasourceRequest = request => {
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
        },{
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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(2);
      expect(result.data.map(t => t.target)).to.include.members(['app_1/memory', 'app_2/memory']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[28, 13], [32, 19]]);
    }).then(v => done(), err => done(err));
  });

  it('should query by tags', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        tags: [
          {name: 'type', value: 'memory'},
          {name: 'host', value: 'myhost'}
        ],
        type: 'gauge',
        rate: false
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
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
        },{
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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(2);
      expect(result.data.map(t => t.target)).to.include.members(['myhost.metric.memory.1', 'myhost.metric.memory.2']);
      expect(result.data[0].datapoints).to.deep.equal([[15, 13], [21, 19]]);
      expect(result.data[1].datapoints).to.deep.equal([[20, 13], [25, 19]]);
    }).then(v => done(), err => done(err));
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
      const pathElements = parsePathElements(request);
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
      const pathElements = parsePathElements(request);
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
      const pathElements = parsePathElements(request);
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
        },{
          id: "myhost.metric.memory.2",
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
      const pathElements = parsePathElements(request);
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
        },{
          id: "myhost.metric.memory.2",
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

  it('should query availability', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      targets: [{
        id: 'myapp/health',
        type: 'availability'
      }]
    };

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
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

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(1);
      expect(result.data[0].target).to.equal('myapp/health');
      expect(result.data[0].datapoints).to.deep.equal([[1, 13], [0, 19]]);
    }).then(v => done(), err => done(err));
  });

  it('should query annotations without tags', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: "my.timeline",
        name: "Timeline"
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['strings', 'raw', 'query']);

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "my.timeline",
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

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: "my.timeline", name: "Timeline" });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal("Timeline");
      expect(result[0].tags).to.be.undefined;
      expect(result[0].text).to.equal("start");

      expect(result[1].annotation).to.deep.equal({ query: "my.timeline", name: "Timeline" });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal("Timeline");
      expect(result[1].tags).to.be.undefined;
      expect(result[1].text).to.equal("stop");
    }).then(v => done(), err => done(err));
  });

  it('should query annotations with tags', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: "my.timeline",
        name: "Timeline"
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['strings', 'raw', 'query']);

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "my.timeline",
          data: [{
            timestamp: 13,
            value: 'start',
            tags: {
              'item': 'myItem',
              'step': 'start'
            }
          }, {
            timestamp: 19,
            value: 'stop',
            tags: {
              'item': 'myItem',
              'step': 'stop'
            }
          }]
        }]
      });
    };

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: "my.timeline", name: "Timeline" });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal("Timeline");
      expect(result[0].tags).to.equal("myItem start");
      expect(result[0].text).to.equal("start");

      expect(result[1].annotation).to.deep.equal({ query: "my.timeline", name: "Timeline" });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal("Timeline");
      expect(result[1].tags).to.equal("myItem stop");
      expect(result[1].text).to.equal("stop");
    }).then(v => done(), err => done(err));
  });

  it('should get tags suggestions', done => {
    ctx.backendSrv.datasourceRequest = request => {
      let parser = document.createElement('a');
      parser.href = request.url;
      const pathElements = parser.pathname.split('/').filter(e => e.length != 0);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'tags', 'host:*']);

      return ctx.$q.when({
        status: 200,
        data: {
          'host': ['cartago', 'rio']
        }
      });
    };

    ctx.ds.suggestTags('gauge', 'host').then(result => {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'cartago', value: 'cartago' });
      expect(result[1]).to.deep.equal({ text: 'rio', value: 'rio' });
    }).then(v => done(), err => done(err));
  });

  it('should get no suggestions on unknown tag', done => {
    ctx.backendSrv.datasourceRequest = request => {
      let parser = document.createElement('a');
      parser.href = request.url;
      const pathElements = parser.pathname.split('/').filter(e => e.length != 0);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'tags', 'host:*']);
      return ctx.$q.when({
        status: 204,
        data: {}
      });
    };
    ctx.ds.suggestTags('gauge', 'host').then(result => {
      expect(result).to.have.length(0);
    }).then(v => done(), err => done(err));
  });

  it('should get tag keys suggestions', done => {
    ctx.backendSrv.datasourceRequest = request => {
      let parser = document.createElement('a');
      parser.href = request.url;
      const pathElements = parser.pathname.split('/').filter(e => e.length != 0);
      expect(pathElements).to.have.length(4);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['metrics', 'tags']);
      return ctx.$q.when({
        status: 200,
        data: ['host', 'app']
      });
    };

    ctx.ds.suggestTagKeys().then(result => {
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ text: 'host', value: 'host' });
      expect(result[1]).to.deep.equal({ text: 'app', value: 'app' });
    }).then(v => done(), err => done(err));
  });

  it('should resolve variables in annotations', done => {
    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: "$who.timeline",
        name: "Timeline"
      }
    };

    ctx.templateSrv.variables = [{
      name: 'who'
    }];
    ctx.templateSrv.replace = (target, vars) => {
      expect(target).to.equal('$who');
      return "{your,my}";
    };

    ctx.backendSrv.datasourceRequest = request => {
      const pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['strings', 'raw', 'query']);
      expect(request.data.ids).to.deep.equal(['your.timeline', 'my.timeline']);

      return ctx.$q.when({
        status: 200,
        data: [{
          id: "your.timeline",
          data: [{
            timestamp: 15,
            value: 'start'
          }]
        },{
          id: "my.timeline",
          data: [{
            timestamp: 13,
            value: 'start'
          }]
        }]
      });
    };

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: "$who.timeline", name: "Timeline" });
      expect(result[0].time).to.equal(15);
      expect(result[0].title).to.equal("Timeline");
      expect(result[0].tags).to.equal('your.timeline');
      expect(result[0].text).to.equal("start");

      expect(result[1].annotation).to.deep.equal({ query: "$who.timeline", name: "Timeline" });
      expect(result[1].time).to.equal(13);
      expect(result[1].title).to.equal("Timeline");
      expect(result[1].tags).to.equal('my.timeline');
      expect(result[1].text).to.equal("start");
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
      const pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['gauges', 'stats', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type:memory",
        percentiles: "90",
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
          percentiles: [{"value":23.1,"originalQuantile":"90","quantile":90.0}]
        }, {
          start: 25,
          end: 30,
          min: 18,
          max: 28,
          avg: 23.25,
          percentiles: [{"value":26.1,"originalQuantile":"90","quantile":90.0}]
        }]
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(2);
      expect(result.data[1].target).to.equal("avg");
      expect(result.data[1].datapoints).to.deep.equal([[20.25, 20], [23.25, 25]]);
      expect(result.data[0].target).to.equal("90 %ile");
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
      const pathElements = parsePathElements(request);
      expect(pathElements).to.have.length(5);
      expect(pathElements.slice(0, 2)).to.deep.equal(hPath.split('/'));
      expect(pathElements.slice(2)).to.deep.equal(['metrics', 'stats', 'query']);
      expect(request.data).to.deep.equal({
        start: options.range.from,
        end: options.range.to,
        tags: "type:memory",
        percentiles: "95",
        buckets: 60,
        types: ["gauge"]
      });

      return ctx.$q.when({
        status: 200,
        data: {"gauge":
          { "gauge_1":
            [{
              start: 20,
              end: 25,
              min: 15,
              max: 25,
              avg: 20.25,
              percentiles: [{"value":23.1,"originalQuantile":"95","quantile":95.0}]
            }, {
              start: 25,
              end: 30,
              min: 18,
              max: 28,
              avg: 23.25,
              percentiles: [{"value":26.1,"originalQuantile":"95","quantile":95.0}]
            }],
            "gauge_2":
            [{
              start: 20,
              end: 25,
              min: 20,
              max: 30,
              avg: 25.25,
              percentiles: [{"value":28.1,"originalQuantile":"95","quantile":95.0}]
            }, {
              start: 25,
              end: 30,
              min: 23,
              max: 33,
              avg: 28.25,
              percentiles: [{"value":31.1,"originalQuantile":"95","quantile":95.0}]
            }]
          }
        }
      });
    };

    ctx.ds.query(options).then(result => {
      expect(result.data).to.have.length(4);
      expect(result.data[1].target).to.equal("gauge_1 [min]");
      expect(result.data[1].datapoints).to.deep.equal([[15, 20], [18, 25]]);
      expect(result.data[0].target).to.equal("gauge_1 [95 %ile]");
      expect(result.data[0].datapoints).to.deep.equal([[23.1, 20], [26.1, 25]]);
      expect(result.data[3].target).to.equal("gauge_2 [min]");
      expect(result.data[3].datapoints).to.deep.equal([[20, 20], [23, 25]]);
      expect(result.data[2].target).to.equal("gauge_2 [95 %ile]");
      expect(result.data[2].datapoints).to.deep.equal([[28.1, 20], [31.1, 25]]);
    }).then(v => done(), err => done(err));
  });
});
