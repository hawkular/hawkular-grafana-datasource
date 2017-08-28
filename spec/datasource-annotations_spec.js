import {Datasource} from '../module';
import Q from 'q';
import {getSettings, expectRequest, expectAlertRequest} from './test-util';

describe('HawkularDatasource annotations', () => {
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

  it('should query annotations without tags', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: 'my.timeline',
        name: 'Timeline',
        type: 'strings'
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'strings/raw/query');

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

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: 'my.timeline', name: 'Timeline', type: 'strings' });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal('Timeline');
      expect(result[0].tags).to.be.undefined;
      expect(result[0].text).to.equal('start');

      expect(result[1].annotation).to.deep.equal({ query: 'my.timeline', name: 'Timeline', type: 'strings' });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal('Timeline');
      expect(result[1].tags).to.be.undefined;
      expect(result[1].text).to.equal('stop');
    }).then(v => done(), err => done(err));
  });

  it('should query annotations with tags', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: 'my.timeline',
        name: 'Timeline',
        type: 'strings'
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'strings/raw/query');

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'my.timeline',
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
      expect(result[0].annotation).to.deep.equal({ query: 'my.timeline', name: 'Timeline', type: 'strings' });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal('Timeline');
      expect(result[0].tags).to.equal('myItem start');
      expect(result[0].text).to.equal('start');

      expect(result[1].annotation).to.deep.equal({ query: 'my.timeline', name: 'Timeline', type: 'strings' });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal('Timeline');
      expect(result[1].tags).to.equal('myItem stop');
      expect(result[1].text).to.equal('stop');
    }).then(v => done(), err => done(err));
  });

  it('should resolve variables in annotations', done => {
    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: '$who.timeline',
        name: 'Timeline',
        type: 'strings'
      }
    };

    ctx.templateSrv.variables = [{
      name: 'who'
    }];
    ctx.templateSrv.replace = (target, vars) => {
      expect(target).to.equal('$who');
      return '{your,my}';
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'strings/raw/query');
      expect(request.data.ids).to.deep.equal(['your.timeline', 'my.timeline']);

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'your.timeline',
          data: [{
            timestamp: 15,
            value: 'start'
          }]
        },{
          id: 'my.timeline',
          data: [{
            timestamp: 13,
            value: 'start'
          }]
        }]
      });
    };

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: '$who.timeline', name: 'Timeline', type: 'strings' });
      expect(result[0].time).to.equal(15);
      expect(result[0].title).to.equal('Timeline');
      expect(result[0].tags).to.equal('your.timeline');
      expect(result[0].text).to.equal('start');

      expect(result[1].annotation).to.deep.equal({ query: '$who.timeline', name: 'Timeline', type: 'strings' });
      expect(result[1].time).to.equal(13);
      expect(result[1].title).to.equal('Timeline');
      expect(result[1].tags).to.equal('my.timeline');
      expect(result[1].text).to.equal('start');
    }).then(v => done(), err => done(err));
  });

  it('should query annotations from avails', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: 'my.avail',
        name: 'Avail',
        type: 'availability'
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectRequest(request, 'POST', 'availability/raw/query');

      return ctx.$q.when({
        status: 200,
        data: [{
          id: 'my.avail',
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

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: 'my.avail', name: 'Avail', type: 'availability' });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal('Avail');
      expect(result[0].tags).to.be.undefined;
      expect(result[0].text).to.equal('up');

      expect(result[1].annotation).to.deep.equal({ query: 'my.avail', name: 'Avail', type: 'availability' });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal('Avail');
      expect(result[1].tags).to.be.undefined;
      expect(result[1].text).to.equal('down');
    }).then(v => done(), err => done(err));
  });

  it('should query annotations from alerts', done => {

    let options = {
      range: {
        from: 15,
        to: 30
      },
      annotation: {
        query: 'my.trigger',
        name: 'Alert',
        type: 'alert'
      }
    };

    ctx.backendSrv.datasourceRequest = request => {
      expectAlertRequest(request, 'GET', 'events');

      return ctx.$q.when({
        status: 200,
        data: [{
          ctime: 13,
          status: 'OPEN',
          text: 'Some text'
        }, {
          ctime: 19,
          status: 'OPEN',
          text: 'Some text'
        }]
      });
    };

    ctx.ds.annotationQuery(options).then(result => {
      expect(result).to.have.length(2);
      expect(result[0].annotation).to.deep.equal({ query: 'my.trigger', name: 'Alert', type: 'alert' });
      expect(result[0].time).to.equal(13);
      expect(result[0].title).to.equal('Alert');
      expect(result[0].tags).to.equal('OPEN');
      expect(result[0].text).to.equal('Some text');

      expect(result[1].annotation).to.deep.equal({ query: 'my.trigger', name: 'Alert', type: 'alert' });
      expect(result[1].time).to.equal(19);
      expect(result[1].title).to.equal('Alert');
      expect(result[1].tags).to.equal('OPEN');
      expect(result[1].text).to.equal('Some text');
    }).then(v => done(), err => done(err));
  });
});
